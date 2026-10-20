import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENCY, getPublicCatalog, listAdminProducts, loadProductOverrides, paymentMode, priceCart, updateProduct } from "./server/catalog.mjs";
import { createOrder, createRequest, findOrder, getUpload, listOrders, markEventProcessed, prepareStorage, saveUpload, updateOrder, UPLOAD_DIR } from "./server/storage.mjs";
import { assertStripeReady, createCheckoutSession, retrieveCheckoutSession, verifyStripeSignature } from "./server/stripe.mjs";
import { addShopifyProductImage, adjustShopifyInventory, cancelShopifyOrder, createShopifyVariant, deleteShopifyProductMedia, deleteShopifyVariant, fulfillShopifyOrder, listShopifyOrders, listShopifyProducts, shopifyConfigured, updateShopifyOrder, updateShopifyProduct } from "./server/shopify.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_TOTAL_CENTS = 100_000_000;
const allowedUploads = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".svg", ".ai", ".eps"]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};
const requestWindows = new Map();
const FULFILLMENT_STATUSES = new Set(["new", "confirmed", "in_production", "ready", "completed", "cancelled"]);
const ADMIN_COOKIE = "nenufero_admin";

function loadEnvFile() {
  return readFile(resolve(ROOT, ".env"), "utf8").then((contents) => {
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "");
      process.env[match[1]] = value;
    }
  }).catch(() => {});
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

function fail(response, status, message, code = "request_failed", headers = {}) {
  send(response, status, { error: { code, message } }, headers);
}

async function readBody(request, limit) {
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > limit) throw Object.assign(new Error("El archivo supera el límite permitido."), { status: 413 });
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error("El envío supera el límite permitido."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const contentType = String(request.headers["content-type"] || "").split(";")[0];
  if (contentType !== "application/json") throw Object.assign(new Error("La solicitud debe usar formato JSON."), { status: 415 });
  const body = await readBody(request, MAX_JSON_BYTES);
  try { return JSON.parse(body.toString("utf8")); }
  catch { throw Object.assign(new Error("La solicitud no tiene un formato válido."), { status: 400 }); }
}

function rateLimit(request, limit = 24) {
  const address = request.socket.remoteAddress || "local";
  const now = Date.now();
  const current = requestWindows.get(address);
  if (!current || now - current.startedAt > 60_000) {
    requestWindows.set(address, { startedAt: now, count: 1 });
    if (requestWindows.size > 2000) {
      for (const [ip, window] of requestWindows) if (now - window.startedAt > 60_000) requestWindows.delete(ip);
    }
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; }
  catch { return false; }
}

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, " ").slice(0, max) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

function adminPasswordConfigured() {
  return typeof process.env.ADMIN_PASSWORD === "string" && process.env.ADMIN_PASSWORD.length >= 12;
}

function adminSignature(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isAdminAuthenticated(request) {
  if (!adminPasswordConfigured()) return false;
  const cookieHeader = String(request.headers.cookie || "");
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  if (!cookie) return false;
  const token = cookie.slice(ADMIN_COOKIE.length + 1);
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(adminSignature(payload));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  const expiresAt = Number(payload);
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

function adminCookie(request, maxAge) {
  const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const value = maxAge ? `${expiresAt}.${adminSignature(String(expiresAt))}` : "";
  return `${ADMIN_COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function requireAdmin(request, response) {
  if (!isAdminAuthenticated(request)) {
    fail(response, 401, "Inicia sesión para acceder al panel de administración.", "admin_auth_required");
    return false;
  }
  return true;
}

async function handleAdmin(request, response, url) {
  const path = url.pathname;
  if (path === "/api/admin/session" && request.method === "GET") {
    return send(response, 200, { configured: adminPasswordConfigured(), authenticated: isAdminAuthenticated(request), shopifyConfigured: shopifyConfigured() });
  }
  if (path === "/api/admin/session" && request.method === "POST") {
    if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
    if (!rateLimit(request, 6)) return fail(response, 429, "Demasiados intentos. Espera un minuto.", "rate_limited");
    if (!adminPasswordConfigured()) return fail(response, 503, "Configura ADMIN_PASSWORD (mínimo 12 caracteres) en el entorno del servidor.", "admin_not_configured");
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    const supplied = Buffer.from(typeof body.password === "string" ? body.password : "");
    const expected = Buffer.from(process.env.ADMIN_PASSWORD);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return fail(response, 401, "La contraseña no es correcta.", "invalid_credentials");
    return send(response, 200, { authenticated: true }, { "Set-Cookie": adminCookie(request, 8 * 60 * 60) });
  }
  if (path === "/api/admin/session" && request.method === "DELETE") {
    if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
    return send(response, 200, { authenticated: false }, { "Set-Cookie": adminCookie(request, 0) });
  }
  if (!path.startsWith("/api/admin/")) return false;
  if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
  if (!requireAdmin(request, response)) return;

  if (path === "/api/admin/orders" && request.method === "GET") {
    const localOrders = (await listOrders()).map((order) => ({ ...order, source: "local" }));
    const orders = shopifyConfigured() ? [...await listShopifyOrders(), ...localOrders] : localOrders;
    orders.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return send(response, 200, { orders: orders.map((order) => ({ ...order, fulfillmentStatus: order.fulfillmentStatus || "new" })), source: shopifyConfigured() ? "shopify+local" : "local" });
  }
  const shopifyOrderAction = path.match(/^\/api\/admin\/orders\/(\d{1,24})\/(fulfill|cancel)$/);
  if (shopifyOrderAction && request.method === "POST") {
    if (!shopifyConfigured()) return fail(response, 503, "Configura Shopify para gestionar pedidos de la tienda real.", "shopify_not_configured");
    const [, id, action] = shopifyOrderAction;
    if (action === "fulfill") {
      const order = await fulfillShopifyOrder(id);
      return order ? send(response, 200, { order }) : fail(response, 404, "No encontramos ese pedido.", "order_not_found");
    }
    const result = await cancelShopifyOrder(id);
    return result ? send(response, 200, result) : fail(response, 404, "No encontramos ese pedido.", "order_not_found");
  }
  const orderMatch = path.match(/^\/api\/admin\/orders\/(NEN-[A-Z0-9-]{12,40}|[0-9]{1,24})$/);
  if (orderMatch && request.method === "PATCH") {
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    const allowedStatuses = [...FULFILLMENT_STATUSES];
    if (body.fulfillmentStatus !== undefined && !FULFILLMENT_STATUSES.has(body.fulfillmentStatus)) {
      return fail(response, 422, `Estado no válido. Usa: ${allowedStatuses.join(", ")}.`, "invalid_fulfillment_status");
    }
    if (body.adminNote !== undefined && (typeof body.adminNote !== "string" || body.adminNote.length > 2000)) return fail(response, 422, "La nota no puede superar los 2.000 caracteres.", "invalid_admin_note");
    const updated = orderMatch[1].startsWith("NEN-")
      ? await updateOrder(orderMatch[1], (order) => ({
        ...order,
        ...(body.fulfillmentStatus !== undefined ? { fulfillmentStatus: body.fulfillmentStatus } : {}),
        ...(body.adminNote !== undefined ? { adminNote: cleanText(body.adminNote, 2000) } : {}),
        adminUpdatedAt: new Date().toISOString()
      }))
      : shopifyConfigured() ? await updateShopifyOrder(orderMatch[1], {
        ...(body.fulfillmentStatus !== undefined ? { fulfillmentStatus: body.fulfillmentStatus } : {}),
        ...(body.adminNote !== undefined ? { adminNote: cleanText(body.adminNote, 2000) } : {})
      }) : null;
    return updated ? send(response, 200, { order: { ...updated, fulfillmentStatus: updated.fulfillmentStatus || "new" } }) : fail(response, 404, "No encontramos ese pedido.", "order_not_found");
  }
  if (path === "/api/admin/products" && request.method === "GET") {
    if (shopifyConfigured()) return send(response, 200, { products: await listShopifyProducts(), mode: "shopify", source: "shopify" });
    return send(response, 200, { products: listAdminProducts(), mode: paymentMode(process.env), source: "local" });
  }
  const mediaRoute = path.match(/^\/api\/admin\/products\/(\d{1,24})\/media$/);
  if (mediaRoute && request.method === "POST") {
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    if (typeof body.source !== "string" || body.source.length > 2048 || typeof body.alt !== "string" || body.alt.length > 512) return fail(response, 422, "Indica la URL HTTPS pública y el texto alternativo de la imagen.", "invalid_product_image");
    const product = await addShopifyProductImage(mediaRoute[1], body.source, cleanText(body.alt, 512));
    return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos ese producto en Shopify.", "product_not_found");
  }
  if (mediaRoute && request.method === "DELETE") {
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    if (typeof body.mediaId !== "string" || !body.mediaId.startsWith("gid://shopify/")) return fail(response, 422, "La referencia de imagen no es válida.", "invalid_product_media");
    const product = await deleteShopifyProductMedia(mediaRoute[1], body.mediaId);
    return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos esa imagen en el producto indicado.", "product_media_not_found");
  }
  const variantRoute = path.match(/^\/api\/admin\/products\/(\d{1,24})\/variants(?:\/(\d{1,24}))?$/);
  if (variantRoute && request.method === "POST" && !variantRoute[2]) {
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    const price = Number(body.price);
    const compareAtPrice = body.compareAtPrice === "" || body.compareAtPrice === null || body.compareAtPrice === undefined ? "" : Number(body.compareAtPrice);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000 || (compareAtPrice !== "" && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 1_000_000))) return fail(response, 422, "Revisa el precio de la variante.", "invalid_variant_price");
    if (typeof body.sku !== "string" || body.sku.length > 100 || typeof body.barcode !== "string" || body.barcode.length > 100) return fail(response, 422, "El SKU y el código de barras no pueden superar 100 caracteres.", "invalid_variant_reference");
    if (!Array.isArray(body.optionValues) || body.optionValues.length < 1 || body.optionValues.length > 3 || body.optionValues.some((option) => !option || typeof option.name !== "string" || !option.name.trim() || typeof option.value !== "string" || !option.value.trim())) return fail(response, 422, "Indica valores válidos para las opciones de la variante.", "invalid_variant_options");
    const product = await createShopifyVariant(variantRoute[1], { price: price.toFixed(2), compareAtPrice: compareAtPrice === "" ? "" : compareAtPrice.toFixed(2), sku: body.sku.trim(), barcode: body.barcode.trim(), optionValues: body.optionValues.map(({ name, value }) => ({ name: cleanText(name, 255), value: cleanText(value, 255) })) });
    return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos ese producto en Shopify.", "product_not_found");
  }
  if (variantRoute && request.method === "DELETE" && variantRoute[2]) {
    const product = await deleteShopifyVariant(variantRoute[1], variantRoute[2]);
    return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos esa variante en el producto indicado.", "variant_not_found");
  }
  const inventoryMatch = path.match(/^\/api\/admin\/products\/(\d{1,24})\/inventory$/);
  if (inventoryMatch && request.method === "POST") {
    if (!shopifyConfigured()) return fail(response, 503, "Configura Shopify para ajustar el inventario de la tienda real.", "shopify_not_configured");
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    const variantId = String(body.variantId || "");
    const locationId = String(body.locationId || "");
    const delta = Number(body.delta);
    if (!/^\d{1,24}$/.test(variantId) || !/^gid:\/\/shopify\/Location\/\d+$/.test(locationId) || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 10000) {
      return fail(response, 422, "Indica una variante, ubicación y ajuste entero válido (entre −10.000 y 10.000, sin contar cero).", "invalid_inventory_adjustment");
    }
    const adjustment = await adjustShopifyInventory(inventoryMatch[1], variantId, locationId, delta);
    return adjustment ? send(response, 200, { adjustment }) : fail(response, 404, "No encontramos la variante del producto en Shopify.", "variant_not_found");
  }
  const uploadMatch = path.match(/^\/api\/admin\/uploads\/([a-f0-9-]{36})$/i);
  if (uploadMatch && request.method === "GET") {
    const upload = await getUpload(uploadMatch[1]);
    if (!upload) return fail(response, 404, "No encontramos ese archivo.", "upload_not_found");
    const filePath = resolve(upload.path);
    if (!filePath.startsWith(`${resolve(UPLOAD_DIR)}${sep}`)) return fail(response, 404, "No encontramos ese archivo.", "upload_not_found");
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.fileName || "referencia")}`,
      "Content-Length": upload.bytes,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    });
    const stream = createReadStream(filePath);
    stream.on("error", () => { if (!response.headersSent) fail(response, 404, "No encontramos ese archivo.", "upload_not_found"); else response.destroy(); });
    stream.pipe(response);
    return;
  }
  const productMatch = path.match(/^\/api\/admin\/products\/([a-z0-9-]{1,80})$/);
  if (productMatch && request.method === "PATCH") {
    let body;
    try { body = await readJson(request); }
    catch (error) { return fail(response, error.status || 400, error.message, "invalid_request"); }
    if (shopifyConfigured()) {
      const title = cleanText(body.title, 255);
      const vendor = cleanText(body.vendor, 255);
      const category = cleanText(body.category, 255);
      const descriptionHtml = typeof body.descriptionHtml === "string" ? body.descriptionHtml.slice(0, 40_000) : undefined;
      const tags = Array.isArray(body.tags) && body.tags.length <= 250 ? body.tags.map((tag) => cleanText(tag, 255)).filter(Boolean) : undefined;
      const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(body.status) ? body.status : undefined;
      if (!title || (body.status !== undefined && !status) || (body.tags !== undefined && !tags)) {
        return fail(response, 422, "Revisa el nombre, tipo, marca, etiquetas y estado del producto.", "invalid_product");
      }
      let variants;
      if (body.variants !== undefined) {
        if (!Array.isArray(body.variants) || body.variants.length > 2048) return fail(response, 422, "La lista de variantes no es válida.", "invalid_product_variants");
        variants = [];
        for (const variant of body.variants) {
          if (!variant || typeof variant !== "object" || Array.isArray(variant)) return fail(response, 422, "La lista de variantes no es válida.", "invalid_product_variant");
          const price = Number(variant.price);
          const compareAtPrice = variant.compareAtPrice === "" || variant.compareAtPrice === null ? "" : Number(variant.compareAtPrice);
          if (!/^\d{1,24}$/.test(String(variant.id)) || !Number.isFinite(price) || price < 0 || price > 1_000_000 || (compareAtPrice !== "" && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 1_000_000))) {
            return fail(response, 422, "Revisa el precio de cada variante.", "invalid_product_variant");
          }
          if (typeof variant.sku !== "string" || variant.sku.length > 100 || typeof variant.barcode !== "string" || variant.barcode.length > 100) return fail(response, 422, "El SKU y el código de barras no pueden superar 100 caracteres.", "invalid_product_variant");
          variants.push({ id: String(variant.id), price: price.toFixed(2), compareAtPrice: compareAtPrice === "" ? "" : compareAtPrice.toFixed(2), sku: variant.sku.trim(), barcode: variant.barcode.trim() });
        }
      }
      const product = await updateShopifyProduct(productMatch[1], {
        title, vendor, productType: category, status, tags, descriptionHtml, variants
      });
      return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos ese producto en Shopify.", "product_not_found");
    }
    const title = cleanText(body.title, 120);
    const category = cleanText(body.category, 80);
    const demoRateCents = Number(body.demoRateCents);
    const stripeRateCents = body.stripeRateCents === null || body.stripeRateCents === "" ? null : Number(body.stripeRateCents);
    if (!title || !category || !Number.isSafeInteger(demoRateCents) || demoRateCents < 1 || demoRateCents > MAX_TOTAL_CENTS || (stripeRateCents !== null && (!Number.isSafeInteger(stripeRateCents) || stripeRateCents < 50 || stripeRateCents > MAX_TOTAL_CENTS)) || typeof body.active !== "boolean") {
      return fail(response, 422, "Revisa nombre, categoría, disponibilidad y tarifas.", "invalid_product");
    }
    const product = await updateProduct(productMatch[1], { title, category, demoRate: demoRateCents, stripeRateCents, active: body.active });
    return product ? send(response, 200, { product }) : fail(response, 404, "No encontramos ese producto.", "product_not_found");
  }
  return fail(response, 404, "No encontramos esa ruta del panel.", "not_found");
}

function publicOrder(order) {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    mode: order.mode,
    createdAt: order.createdAt,
    currency: order.currency,
    items: order.items.map(({ sku, title, category, unit, quantity, unitAmountCents, lineTotalCents, options, fileName }) => ({ sku, title, category, unit, quantity, unitAmountCents, lineTotalCents, options, fileName })),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    delivery: order.delivery
  };
}

function orderId() {
  return `NEN-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 16).toUpperCase()}`;
}

async function handleUpload(request, response) {
  if (!rateLimit(request, 8)) return fail(response, 429, "Espera un minuto antes de subir más archivos.", "rate_limited");
  if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
  const originalName = cleanText(decodeURIComponent(String(request.headers["x-upload-name"] || "archivo")), 180).split(/[\\/]/).pop() || "archivo";
  const extension = extname(originalName).toLowerCase();
  if (!allowedUploads.has(extension)) return fail(response, 415, "Formato no admitido. Usa JPG, PNG, WEBP, PDF, SVG, AI o EPS.", "unsupported_file");
  let buffer;
  try { buffer = await readBody(request, MAX_UPLOAD_BYTES); }
  catch (error) { return fail(response, error.status || 413, error.message, "upload_too_large"); }
  if (!buffer.length) return fail(response, 400, "El archivo está vacío.", "empty_file");
  const mime = mimeTypes[extension] || "application/octet-stream";
  const upload = await saveUpload({ fileName: originalName, mime, buffer });
  return send(response, 201, { id: upload.id, fileName: upload.fileName, bytes: upload.bytes });
}

async function handleRequest(request, response) {
  if (!rateLimit(request, 12)) return fail(response, 429, "Espera un minuto antes de volver a enviar la solicitud.", "rate_limited");
  if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
  const body = await readJson(request);
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const service = cleanText(body.service, 100);
  const details = cleanText(body.details, 4000);
  const visit = cleanText(body.visit, 50);
  if (!name || !validEmail(email) || !service || !details) {
    return fail(response, 422, "Completa tu nombre, email, proyecto y una breve descripción.", "invalid_contact");
  }
  let upload = null;
  if (body.uploadId) {
    upload = await getUpload(cleanText(body.uploadId, 80));
    if (!upload) return fail(response, 422, "No encontramos el archivo de referencia. Vuelve a subirlo.", "upload_not_found");
  }
  const requestRecord = {
    id: `NEN-C-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 16).toUpperCase()}`,
    status: "received",
    name,
    email,
    phone,
    service,
    details,
    visit,
    uploadId: upload?.id || "",
    fileName: upload?.fileName || "",
    createdAt: new Date().toISOString()
  };
  await createRequest(requestRecord);
  return send(response, 201, { id: requestRecord.id, status: requestRecord.status });
}

async function handleCheckout(request, response) {
  if (!rateLimit(request, 12)) return fail(response, 429, "Espera un minuto antes de intentarlo de nuevo.", "rate_limited");
  if (!sameOrigin(request)) return fail(response, 403, "No se pudo validar el origen de la solicitud.", "invalid_origin");
  const body = await readJson(request);
  const name = cleanText(body.customer?.name, 120);
  const email = cleanText(body.customer?.email, 254).toLowerCase();
  const phone = cleanText(body.customer?.phone, 40);
  const delivery = body.delivery === "shipping" ? "shipping" : "pickup";
  if (!name || !validEmail(email)) return fail(response, 422, "Escribe tu nombre y un email válido.", "invalid_contact");
  if (phone && phone.replace(/\D/g, "").length < 9) return fail(response, 422, "Escribe un teléfono válido.", "invalid_phone");
  let address = null;
  if (delivery === "shipping") {
    address = {
      line1: cleanText(body.address?.line1, 180),
      line2: cleanText(body.address?.line2, 120),
      postalCode: cleanText(body.address?.postalCode, 16),
      city: cleanText(body.address?.city, 100),
      province: cleanText(body.address?.province, 100),
      country: "ES"
    };
    if (paymentMode(process.env) !== "stripe" && (!address.line1 || !address.postalCode || !address.city || !address.province)) {
      return fail(response, 422, "Completa la dirección de envío.", "invalid_address");
    }
  }
  let pricing;
  try { pricing = priceCart(body.items, process.env); }
  catch (error) { return fail(response, 422, error.message, "invalid_cart"); }
  if (pricing.mode === "stripe") {
    try { assertStripeReady(process.env); }
    catch (error) { return fail(response, 503, error.message, "stripe_not_ready"); }
  }
  for (const item of pricing.items) {
    if (item.uploadId) {
      const upload = await getUpload(item.uploadId);
      if (!upload) return fail(response, 422, "No encontramos uno de los archivos del carrito. Vuelve a subirlo.", "upload_not_found");
      item.fileName = upload.fileName;
    }
  }
  let shippingCents = 0;
  if (delivery === "shipping") {
    const configuredShipping = process.env.STRIPE_SHIPPING_EUR_CENTS;
    shippingCents = pricing.mode === "simulated" ? 590 : (configuredShipping !== undefined && configuredShipping !== "" ? Number(configuredShipping) : NaN);
    if (!Number.isSafeInteger(shippingCents) || shippingCents < 0) {
      return fail(response, 422, "El envío no está configurado para esta tienda. Selecciona recogida en taller o configura su tarifa.", "shipping_not_configured");
    }
  }
  const totalCents = pricing.subtotalCents + shippingCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 50 || totalCents > MAX_TOTAL_CENTS) {
    return fail(response, 422, "El importe total no es válido para completar el pedido.", "invalid_total");
  }
  const uploads = new Map();
  for (const item of pricing.items) if (item.uploadId) uploads.set(item.uploadId, await getUpload(item.uploadId));
  const record = {
    id: orderId(),
    mode: pricing.mode,
    status: pricing.mode === "simulated" ? "simulated_complete" : "awaiting_payment",
    paymentStatus: pricing.mode === "simulated" ? "simulated" : "unpaid",
    currency: CURRENCY,
    createdAt: new Date().toISOString(),
    customer: { name, email, phone },
    address,
    delivery,
    items: pricing.items.map((item) => ({ ...item, fileName: uploads.get(item.uploadId)?.fileName || "" })),
    subtotalCents: pricing.subtotalCents,
    shippingCents,
    totalCents,
    fulfillmentStatus: "new",
    stripeSessionId: ""
  };
  await createOrder(record);
  if (pricing.mode === "simulated") return send(response, 201, { mode: "simulated", order: publicOrder(record) });
  try {
    const session = await createCheckoutSession(record, process.env);
    await updateOrder(record.id, (order) => ({ ...order, stripeSessionId: session.id, status: "awaiting_payment" }));
    return send(response, 201, { mode: "stripe", orderId: record.id, checkoutUrl: session.url });
  } catch (error) {
    await updateOrder(record.id, (order) => ({ ...order, status: "checkout_failed", paymentStatus: "unpaid" }));
    console.error("Stripe checkout error:", error.message);
    return fail(response, 502, "Stripe no pudo iniciar el pago. Revisa la configuración e inténtalo de nuevo.", "stripe_checkout_failed");
  }
}

async function handleStripeSession(url, response) {
  if (paymentMode(process.env) !== "stripe") return fail(response, 404, "No hay una sesión Stripe activa.", "not_found");
  let session;
  try { session = await retrieveCheckoutSession(url.searchParams.get("session_id") || "", process.env); }
  catch { return fail(response, 400, "No se pudo verificar el pago con Stripe.", "session_verification_failed"); }
  const id = session.metadata?.nenufero_order_id;
  const order = id ? await findOrder(id) : null;
  if (!order || order.stripeSessionId !== session.id || session.currency !== CURRENCY || session.amount_total !== order.totalCents) {
    return fail(response, 404, "No encontramos un pedido válido asociado a ese pago.", "order_not_found");
  }
  if (session.payment_status === "paid") {
    const address = session.shipping_details?.address || session.customer_details?.address || null;
    await updateOrder(id, (current) => ({ ...current, status: "paid", paymentStatus: "paid", stripePaymentIntentId: session.payment_intent || "", paidAt: new Date().toISOString(), address: address ? { line1: address.line1 || "", line2: address.line2 || "", city: address.city || "", province: address.state || "", postalCode: address.postal_code || "", country: address.country || "" } : current.address }));
  }
  const updated = await findOrder(id);
  return send(response, 200, { order: publicOrder(updated) });
}

async function handleStripeWebhook(request, response) {
  if (paymentMode(process.env) !== "stripe" || !process.env.STRIPE_WEBHOOK_SECRET) return fail(response, 503, "Los webhooks de Stripe no están configurados.", "webhook_not_ready");
  let raw;
  try { raw = await readBody(request, 1024 * 1024); }
  catch (error) { return fail(response, error.status || 413, error.message); }
  if (!verifyStripeSignature(raw.toString("utf8"), request.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET)) {
    return fail(response, 400, "La firma del webhook no es válida.", "invalid_signature");
  }
  let event;
  try { event = JSON.parse(raw.toString("utf8")); }
  catch { return fail(response, 400, "El evento de Stripe no tiene un formato válido.", "invalid_event"); }
  if (!event.id || !event.type) return fail(response, 400, "Faltan datos del evento de Stripe.", "invalid_event");
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data?.object;
    const orderId = session?.metadata?.nenufero_order_id;
    const order = orderId ? await findOrder(orderId) : null;
    if (order && order.stripeSessionId === session.id && session.currency === CURRENCY && session.amount_total === order.totalCents) {
      if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && session.payment_status === "paid") {
        const address = session.shipping_details?.address || session.customer_details?.address || null;
        await updateOrder(order.id, (current) => ({ ...current, status: "paid", paymentStatus: "paid", stripePaymentIntentId: session.payment_intent || "", paidAt: new Date().toISOString(), address: address ? { line1: address.line1 || "", line2: address.line2 || "", city: address.city || "", province: address.state || "", postalCode: address.postal_code || "", country: address.country || "" } : current.address }));
      } else if (event.type === "checkout.session.async_payment_failed") {
        await updateOrder(order.id, (current) => ({ ...current, status: "payment_failed", paymentStatus: "failed" }));
      } else if (event.type === "checkout.session.expired") {
        await updateOrder(order.id, (current) => ({ ...current, status: "checkout_expired", paymentStatus: "unpaid" }));
      }
    }
  }
  await markEventProcessed(event.id);
  return send(response, 200, { received: true });
}

async function api(request, response, url) {
  const path = url.pathname;
  if (path.startsWith("/api/admin/")) {
    try { return await handleAdmin(request, response, url); }
    catch (error) {
      console.error("Admin API error:", error);
      return fail(response, error.status || 500, error.status ? error.message : "No se pudo completar la acción del panel.", error.code || "admin_server_error");
    }
  }
  try {
    if (request.method === "GET" && path === "/api/config") return send(response, 200, getPublicCatalog(process.env));
    if (request.method === "GET" && path === "/api/health") return send(response, 200, { ok: true, paymentMode: paymentMode(process.env) });
    if (request.method === "POST" && path === "/api/uploads") return await handleUpload(request, response);
    if (request.method === "POST" && path === "/api/requests") return await handleRequest(request, response);
    if (request.method === "POST" && path === "/api/checkout") return await handleCheckout(request, response);
    if (request.method === "POST" && path === "/api/stripe/webhook") return await handleStripeWebhook(request, response);
    if (request.method === "GET" && path === "/api/stripe/session") return await handleStripeSession(url, response);
    const orderMatch = path.match(/^\/api\/orders\/(NEN-[A-Z0-9-]{12,40})$/);
    if (request.method === "GET" && orderMatch) {
      const order = await findOrder(orderMatch[1]);
      if (!order) return fail(response, 404, "No encontramos ese pedido.", "order_not_found");
      return send(response, 200, { order: publicOrder(order) });
    }
    return fail(response, 404, "No encontramos esa ruta.", "not_found");
  } catch (error) {
    console.error("API request error:", error);
    return fail(response, error.status || 500, error.status ? error.message : "No se pudo procesar la solicitud. Inténtalo de nuevo.", "server_error");
  }
}

function secureHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self' https://checkout.stripe.com; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(response, 405, "Método no permitido.", "method_not_allowed", { Allow: "GET, HEAD" });
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return fail(response, 400, "La ruta no es válida.", "invalid_path"); }
  if (decoded.split("/").some((part) => part.startsWith(".") && part.length > 1) || ["data", "server", "node_modules"].includes(decoded.split("/")[1])) {
    return fail(response, 404, "No encontramos esa página.", "not_found");
  }
  if (["/server.mjs", "/package.json", "/.env.example", "/README.md", "/AGENTS.md"].includes(decoded)) {
    return fail(response, 404, "No encontramos esa página.", "not_found");
  }
  let file = resolve(ROOT, `.${decoded}`);
  if (!file.startsWith(`${ROOT}${sep}`) && file !== ROOT) return fail(response, 404, "No encontramos esa página.", "not_found");
  if (decoded.endsWith("/")) file = resolve(file, "index.html");
  try {
    const info = await readFile(file);
    const contentType = mimeTypes[extname(file).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": contentType.startsWith("text/") || contentType.includes("javascript") ? "no-cache" : "public, max-age=3600" });
    response.end(request.method === "HEAD" ? undefined : info);
  } catch {
    fail(response, 404, "No encontramos esa página.", "not_found");
  }
}

await loadEnvFile();
await prepareStorage();
await loadProductOverrides();
if (paymentMode(process.env) === "stripe") {
  try { assertStripeReady(process.env); }
  catch (error) { console.warn(`Stripe sigue desactivado hasta completar la configuración: ${error.message}`); }
}

const server = createServer(async (request, response) => {
  secureHeaders(response);
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) return api(request, response, url);
  return serveStatic(request, response, url.pathname);
});

const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`Nenufero está listo en http://${host}:${port} · pagos ${paymentMode(process.env) === "stripe" ? "Stripe" : "simulados"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
