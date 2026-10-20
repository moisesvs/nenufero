import { createHmac, timingSafeEqual } from "node:crypto";
import { listShopifyOrders, listShopifyProducts, shopifyConfigured, updateShopifyOrder, updateShopifyProduct } from "../../server/shopify.mjs";

const COOKIE_NAME = "nenufero_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const STATUSES = new Set(["new", "confirmed", "in_production", "ready", "completed", "cancelled"]);
const loginAttempts = new Map();

function response(statusCode, body, headers = {}) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", ...headers }, body: JSON.stringify(body) };
}

function failure(statusCode, message, code) {
  return response(statusCode, { error: { message, code } });
}

function adminConfigured() {
  return typeof process.env.ADMIN_PASSWORD === "string" && process.env.ADMIN_PASSWORD.length >= 12 && typeof process.env.ADMIN_SESSION_SECRET === "string" && process.env.ADMIN_SESSION_SECRET.length >= 32;
}

function signature(payload) {
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "").update(payload).digest("base64url");
}

function authenticated(event) {
  if (!adminConfigured()) return false;
  const cookie = String(event.headers?.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return false;
  const token = cookie.slice(COOKIE_NAME.length + 1);
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const expiresAt = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(expiresAt));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) && Number(expiresAt) > Math.floor(Date.now() / 1000);
}

function sessionCookie(event, maxAge) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const value = maxAge ? `${expiresAt}.${signature(expiresAt)}` : "";
  const forwardedProto = String(event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${COOKIE_NAME}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${forwardedProto === "https" ? "; Secure" : ""}`;
}

function routePath(event) {
  const incoming = event.path || new URL(event.rawUrl).pathname;
  return incoming.replace(/^\/.netlify\/functions\/admin/, "/api/admin");
}

function sameOrigin(event) {
  const origin = event.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === event.headers?.host; }
  catch { return false; }
}

function requestBody(event) {
  if (!event.body || typeof event.body !== "string") return {};
  if (Buffer.byteLength(event.body) > 1_000_000) throw Object.assign(new Error("El envío supera el límite permitido."), { statusCode: 413 });
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body); }
  catch { throw Object.assign(new Error("La solicitud no tiene un formato JSON válido."), { statusCode: 400 }); }
}

function cleanText(value, max = 255) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, " ").slice(0, max) : "";
}

function limitedLogin(event) {
  const key = event.headers?.["x-nf-client-connection-ip"] || "unknown";
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.started > 60_000) {
    loginAttempts.set(key, { started: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 6;
}

async function patchProduct(id, body) {
  const title = cleanText(body.title, 255);
  const vendor = cleanText(body.vendor, 255);
  const category = cleanText(body.category, 255);
  const descriptionHtml = typeof body.descriptionHtml === "string" ? body.descriptionHtml.slice(0, 40_000) : undefined;
  const tags = Array.isArray(body.tags) && body.tags.length <= 250 ? body.tags.map((tag) => cleanText(tag, 255)).filter(Boolean) : undefined;
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(body.status) ? body.status : undefined;
  if (!title || (body.status !== undefined && !status) || (body.tags !== undefined && !tags)) return failure(422, "Revisa el nombre, tipo, marca, etiquetas y estado del producto.", "invalid_product");
  let variants;
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length > 2048) return failure(422, "La lista de variantes no es válida.", "invalid_product_variants");
    variants = [];
    for (const variant of body.variants) {
      if (!variant || typeof variant !== "object" || Array.isArray(variant)) return failure(422, "La lista de variantes no es válida.", "invalid_product_variant");
      const price = Number(variant.price);
      const compareAt = variant.compareAtPrice === "" || variant.compareAtPrice === null ? "" : Number(variant.compareAtPrice);
      if (!/^\d{1,24}$/.test(String(variant.id)) || !Number.isFinite(price) || price < 0 || price > 1_000_000 || (compareAt !== "" && (!Number.isFinite(compareAt) || compareAt < 0 || compareAt > 1_000_000))) return failure(422, "Revisa el precio de cada variante.", "invalid_product_variant");
      if (typeof variant.sku !== "string" || variant.sku.length > 100 || typeof variant.barcode !== "string" || variant.barcode.length > 100) return failure(422, "El SKU y el código de barras no pueden superar 100 caracteres.", "invalid_product_variant");
      variants.push({ id: String(variant.id), price: price.toFixed(2), compareAtPrice: compareAt === "" ? "" : compareAt.toFixed(2), sku: variant.sku.trim(), barcode: variant.barcode.trim() });
    }
  }
  const product = await updateShopifyProduct(id, { title, vendor, productType: category, status, tags, descriptionHtml, variants });
  return product ? response(200, { product }) : failure(404, "No encontramos ese producto en Shopify.", "product_not_found");
}

export async function handler(event) {
  const path = routePath(event);
  const method = event.httpMethod || "GET";
  if (!path.startsWith("/api/admin/")) return failure(404, "No encontramos esa ruta del panel.", "not_found");
  if (!sameOrigin(event)) return failure(403, "No se pudo validar el origen de la solicitud.", "invalid_origin");

  if (path === "/api/admin/session" && method === "GET") return response(200, { configured: adminConfigured(), authenticated: authenticated(event), shopifyConfigured: shopifyConfigured() });
  if (path === "/api/admin/session" && method === "POST") {
    if (limitedLogin(event)) return failure(429, "Demasiados intentos. Espera un minuto.", "rate_limited");
    if (!adminConfigured()) return failure(503, "Configura ADMIN_PASSWORD y ADMIN_SESSION_SECRET en las variables seguras del servidor.", "admin_not_configured");
    let body;
    try { body = requestBody(event); }
    catch (error) { return failure(error.statusCode || 400, error.message, "invalid_request"); }
    const supplied = Buffer.from(typeof body.password === "string" ? body.password : "");
    const expected = Buffer.from(process.env.ADMIN_PASSWORD);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return failure(401, "La contraseña no es correcta.", "invalid_credentials");
    return response(200, { authenticated: true }, { "Set-Cookie": sessionCookie(event, SESSION_SECONDS) });
  }
  if (path === "/api/admin/session" && method === "DELETE") return response(200, { authenticated: false }, { "Set-Cookie": sessionCookie(event, 0) });
  if (!authenticated(event)) return failure(401, "Inicia sesión para acceder al panel de administración.", "admin_auth_required");
  if (!shopifyConfigured()) return failure(503, "Configura la conexión de Shopify en el servidor para administrar la tienda real.", "shopify_not_configured");

  try {
    if (path === "/api/admin/orders" && method === "GET") return response(200, { orders: await listShopifyOrders(), source: "shopify" });
    const orderMatch = path.match(/^\/api\/admin\/orders\/(\d{1,24})$/);
    if (orderMatch && method === "PATCH") {
      const body = requestBody(event);
      if (body.fulfillmentStatus !== undefined && !STATUSES.has(body.fulfillmentStatus)) return failure(422, "El estado interno no es válido.", "invalid_fulfillment_status");
      if (body.adminNote !== undefined && (typeof body.adminNote !== "string" || body.adminNote.length > 2000)) return failure(422, "La nota no puede superar los 2.000 caracteres.", "invalid_admin_note");
      const order = await updateShopifyOrder(orderMatch[1], {
        ...(body.fulfillmentStatus !== undefined ? { fulfillmentStatus: body.fulfillmentStatus } : {}),
        ...(body.adminNote !== undefined ? { adminNote: cleanText(body.adminNote, 2000) } : {})
      });
      return order ? response(200, { order }) : failure(404, "No encontramos ese pedido.", "order_not_found");
    }
    if (path === "/api/admin/products" && method === "GET") return response(200, { products: await listShopifyProducts(), mode: "shopify", source: "shopify" });
    const productMatch = path.match(/^\/api\/admin\/products\/(\d{1,24})$/);
    if (productMatch && method === "PATCH") return await patchProduct(productMatch[1], requestBody(event));
    return failure(404, "No encontramos esa ruta del panel.", "not_found");
  } catch (error) {
    return failure(error.status || 500, error.status ? error.message : "No se pudo completar la acción en Shopify.", error.code || "admin_server_error");
  }
}
