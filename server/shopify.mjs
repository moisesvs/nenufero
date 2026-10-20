import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

const STATUS_TAG_PREFIX = "nenufero:estado:";
const ADMIN_NOTE_MARKER = "\n\n[NENUFERO ADMIN]\n";

export function shopifyConfigured(env = process.env) {
  return Boolean(String(env.SHOPIFY_STORE_DOMAIN || "").trim() && String(env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim());
}

function shopifyConfig(env = process.env) {
  const domain = String(env.SHOPIFY_STORE_DOMAIN || "").trim().toLowerCase();
  const token = String(env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  const version = String(env.SHOPIFY_API_VERSION || "2026-10").trim();
  if (!domain || !token) throw Object.assign(new Error("Configura SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_ACCESS_TOKEN en el entorno del servidor."), { status: 503, code: "shopify_not_configured" });
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw Object.assign(new Error("SHOPIFY_STORE_DOMAIN debe ser el dominio .myshopify.com de la tienda."), { status: 503, code: "invalid_shopify_domain" });
  if (!/^\d{4}-(01|04|07|10)$/.test(version)) throw Object.assign(new Error("SHOPIFY_API_VERSION no tiene un formato trimestral válido."), { status: 503, code: "invalid_shopify_api_version" });
  return { domain, token, version };
}

async function graphql(query, variables = {}, retry = 0) {
  const { domain, token, version } = shopifyConfig();
  let response;
  try {
    response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    throw Object.assign(new Error("No se pudo conectar con Shopify. Revisa la conexión y vuelve a intentarlo."), { status: 502, code: "shopify_unreachable" });
  }
  if (response.status === 429 && retry < 3) {
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** retry)));
    return graphql(query, variables, retry + 1);
  }
  if (response.status === 401 || response.status === 403) throw Object.assign(new Error("Shopify rechazó el acceso. Revisa el token y los permisos de la aplicación."), { status: 502, code: "shopify_access_denied" });
  if (!response.ok) throw Object.assign(new Error(`Shopify respondió con el estado ${response.status}.`), { status: 502, code: "shopify_api_error" });
  let payload;
  try { payload = await response.json(); }
  catch { throw Object.assign(new Error("Shopify devolvió una respuesta no válida."), { status: 502, code: "shopify_invalid_response" }); }
  if (payload.errors?.length) {
    if (retry < 3 && payload.errors.some((error) => /throttl|rate limit/i.test(error.message || ""))) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** retry)));
      return graphql(query, variables, retry + 1);
    }
    const denied = payload.errors.some((error) => /access denied|permission|scope/i.test(error.message || ""));
    const message = denied
      ? "La aplicación Shopify no tiene los permisos necesarios. Revisa los scopes indicados en la guía del proyecto."
      : String(payload.errors[0].message || "Shopify no pudo completar la consulta.").slice(0, 400);
    throw Object.assign(new Error(message), { status: 502, code: denied ? "shopify_scope_missing" : "shopify_graphql_error" });
  }
  return payload.data;
}

function userErrors(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  if (errors.length) throw Object.assign(new Error(errors.map((error) => error.message).join(" · ").slice(0, 600)), { status: 422, code: "shopify_validation_error" });
  return payload?.[key];
}

function moneyToCents(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function adminNoteFromShopify(note = "") {
  const index = note.indexOf(ADMIN_NOTE_MARKER);
  return index < 0 ? "" : note.slice(index + ADMIN_NOTE_MARKER.length).trim();
}

function noteForShopify(note = "", adminNote = "") {
  const index = note.indexOf(ADMIN_NOTE_MARKER);
  const publicNote = (index < 0 ? note : note.slice(0, index)).trim();
  return adminNote ? `${publicNote}${ADMIN_NOTE_MARKER}${adminNote}` : publicNote;
}

function orderStatus(tags = [], fulfillment = "") {
  if (fulfillment === "CANCELLED") return "cancelled";
  if (fulfillment === "FULFILLED") return "completed";
  const value = tags.find((tag) => tag.startsWith(STATUS_TAG_PREFIX))?.slice(STATUS_TAG_PREFIX.length);
  if (["new", "confirmed", "in_production", "ready", "completed", "cancelled"].includes(value)) return value;
  return ({ FULFILLED: "completed", PARTIALLY_FULFILLED: "in_production", IN_PROGRESS: "in_production", UNFULFILLED: "confirmed", CANCELLED: "cancelled" })[fulfillment] || "new";
}

const ORDER_FIELDS = `
  id legacyResourceId name createdAt updatedAt cancelledAt email phone note tags
  displayFinancialStatus displayFulfillmentStatus
  currentSubtotalPriceSet { shopMoney { amount currencyCode } }
  currentShippingPriceSet { shopMoney { amount currencyCode } }
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  customer { displayName email phone }
  shippingAddress { address1 address2 city province zip country }
  billingAddress { address1 address2 city province zip country }
  lineItems(first: 250) { nodes { title quantity currentQuantity sku variantTitle originalUnitPriceSet { shopMoney { amount currencyCode } } priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount currencyCode } } customAttributes { key value } } pageInfo { hasNextPage endCursor } }
`;

async function completeOrderItems(order) {
  const items = [...order.lineItems.nodes];
  let after = order.lineItems.pageInfo.endCursor;
  while (order.lineItems.pageInfo.hasNextPage) {
    const data = await graphql(`query OrderItems($id: ID!, $after: String) { order(id: $id) { lineItems(first: 250, after: $after) { nodes { title quantity currentQuantity sku variantTitle originalUnitPriceSet { shopMoney { amount currencyCode } } priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount currencyCode } } customAttributes { key value } } pageInfo { hasNextPage endCursor } } } }`, { id: order.id, after });
    if (!data.order) break;
    items.push(...data.order.lineItems.nodes);
    order.lineItems.pageInfo = data.order.lineItems.pageInfo;
    after = data.order.lineItems.pageInfo.endCursor;
  }
  return items;
}

function normalizeOrder(order, lineItems = order.lineItems.nodes) {
  const items = lineItems.map((item) => ({
    title: item.title,
    quantity: item.currentQuantity ?? item.quantity,
    sku: item.sku || "",
    unit: item.variantTitle || "unidad",
    unitAmountCents: moneyToCents(item.originalUnitPriceSet?.shopMoney?.amount),
    lineTotalCents: moneyToCents(item.priceAfterAllDiscountsBeforeTaxesSet?.shopMoney?.amount),
    options: Object.fromEntries((item.customAttributes || []).map(({ key, value }) => [key, value]))
  }));
  const address = order.shippingAddress || order.billingAddress;
  return {
    id: String(order.legacyResourceId), source: "shopify", shopifyGid: order.id,
    orderName: order.name, createdAt: order.createdAt, updatedAt: order.updatedAt,
    fulfillmentStatus: orderStatus(order.tags, order.displayFulfillmentStatus), shopifyFulfillmentStatus: order.displayFulfillmentStatus,
    cancelledAt: order.cancelledAt || null,
    paymentStatus: String(order.displayFinancialStatus || "pending").toLowerCase(),
    customer: { name: order.customer?.displayName || "Cliente", email: order.email || order.customer?.email || "", phone: order.phone || order.customer?.phone || "" },
    address: address ? { line1: address.address1, line2: address.address2, city: address.city, province: address.province, postalCode: address.zip, country: address.country } : null,
    items,
    subtotalCents: moneyToCents(order.currentSubtotalPriceSet?.shopMoney?.amount),
    shippingCents: moneyToCents(order.currentShippingPriceSet?.shopMoney?.amount),
    totalCents: moneyToCents(order.currentTotalPriceSet?.shopMoney?.amount),
    currency: order.currentTotalPriceSet?.shopMoney?.currencyCode || "EUR",
    delivery: order.shippingAddress ? "shipping" : "pickup",
    note: order.note || "", adminNote: adminNoteFromShopify(order.note || ""), tags: order.tags || []
  };
}

export async function listShopifyOrders() {
  const orders = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await graphql(`query AdminOrders($after: String) { orders(first: 100, after: $after, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } pageInfo { hasNextPage endCursor } } }`, { after });
    for (const order of data.orders.nodes) orders.push(normalizeOrder(order, await completeOrderItems(order)));
    hasNextPage = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
  }
  return orders;
}

const VARIANT_FIELDS = `id legacyResourceId title sku barcode price compareAtPrice inventoryQuantity inventoryPolicy taxable weight weightUnit selectedOptions { name value } inventoryItem { id tracked inventoryLevels(first: 100) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } pageInfo { hasNextPage endCursor } } }`;
const PRODUCT_MEDIA_FIELDS = `id alt mediaContentType status preview { status image { url altText } }`;
const PRODUCT_FIELDS = `id legacyResourceId title handle descriptionHtml vendor productType status tags totalInventory featuredImage { url altText } options { id name values } media(first: 100) { nodes { ${PRODUCT_MEDIA_FIELDS} } pageInfo { hasNextPage endCursor } } variants(first: 100) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } }`;

async function completeVariants(product) {
  const variants = [...product.variants.nodes];
  let after = product.variants.pageInfo.endCursor;
  while (product.variants.pageInfo.hasNextPage) {
    const data = await graphql(`query ProductVariants($id: ID!, $after: String) { product(id: $id) { variants(first: 250, after: $after) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } } } }`, { id: product.id, after });
    if (!data.product) break;
    variants.push(...data.product.variants.nodes);
    product.variants.pageInfo = data.product.variants.pageInfo;
    after = data.product.variants.pageInfo.endCursor;
  }
  return variants;
}

async function completeMedia(product) {
  const media = [...product.media.nodes];
  let after = product.media.pageInfo.endCursor;
  while (product.media.pageInfo.hasNextPage) {
    const data = await graphql(`query ProductMedia($id: ID!, $after: String) { product(id: $id) { media(first: 100, after: $after) { nodes { ${PRODUCT_MEDIA_FIELDS} } pageInfo { hasNextPage endCursor } } } }`, { id: product.id, after });
    if (!data.product) break;
    media.push(...data.product.media.nodes);
    product.media.pageInfo = data.product.media.pageInfo;
    after = product.media.pageInfo.endCursor;
  }
  return media;
}

function normalizeProduct(product, variants = product.variants.nodes, media = product.media.nodes) {
  return {
    id: String(product.legacyResourceId), source: "shopify", title: product.title,
    handle: product.handle, descriptionHtml: product.descriptionHtml || "", vendor: product.vendor || "",
    category: product.productType || "", status: product.status, active: product.status === "ACTIVE",
    tags: product.tags || [], totalInventory: product.totalInventory || 0,
    image: product.featuredImage?.url || "", imageAlt: product.featuredImage?.altText || "",
    media: media.map((item) => ({ id: item.id, alt: item.alt || "", type: item.mediaContentType, status: item.status, url: item.preview?.image?.url || "", imageAlt: item.preview?.image?.altText || "" })),
    options: (product.options || []).map((option) => ({ id: option.id, name: option.name, values: option.values || [] })),
    variants: variants.map((variant) => ({
      id: String(variant.legacyResourceId), title: variant.title, sku: variant.sku || "", barcode: variant.barcode || "",
      price: variant.price, compareAtPrice: variant.compareAtPrice || "", inventoryQuantity: variant.inventoryQuantity,
      inventoryPolicy: variant.inventoryPolicy, taxable: variant.taxable, weight: variant.weight, weightUnit: variant.weightUnit,
      selectedOptions: variant.selectedOptions || [],
      inventoryTracked: variant.inventoryItem?.tracked ?? false,
      inventoryItemId: variant.inventoryItem?.id || "",
      inventoryLocations: (variant.inventoryItem?.inventoryLevels?.nodes || []).map((level) => ({
        id: level.location.id,
        name: level.location.name,
        available: level.quantities.find((quantity) => quantity.name === "available")?.quantity ?? 0
      }))
    }))
  };
}

export async function listShopifyProducts() {
  const products = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await graphql(`query AdminProducts($after: String) { products(first: 100, after: $after, sortKey: TITLE, reverse: false) { nodes { ${PRODUCT_FIELDS} } pageInfo { hasNextPage endCursor } } }`, { after });
    for (const product of data.products.nodes) {
      const variants = product.variants.pageInfo.hasNextPage ? await completeVariants(product) : product.variants.nodes;
      products.push(normalizeProduct(product, variants, await completeMedia(product)));
    }
    hasNextPage = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return products;
}

export async function updateShopifyOrder(legacyId, fields) {
  const id = `gid://shopify/Order/${legacyId}`;
  const orderData = await graphql(`query AdminOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id });
  const order = orderData.order;
  if (!order) return null;
  const input = { id };
  if (fields.adminNote !== undefined) input.note = noteForShopify(order.note || "", fields.adminNote);
  if (fields.fulfillmentStatus !== undefined) {
    input.tags = [...(order.tags || []).filter((tag) => !tag.startsWith(STATUS_TAG_PREFIX)), `${STATUS_TAG_PREFIX}${fields.fulfillmentStatus}`];
  }
  const data = await graphql(`mutation UpdateAdminOrder($input: OrderInput!) { orderUpdate(input: $input) { order { id } userErrors { field message } } }`, { input });
  userErrors(data, "orderUpdate");
  const refreshed = await graphql(`query AdminOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id });
  return refreshed.order ? normalizeOrder(refreshed.order, await completeOrderItems(refreshed.order)) : null;
}

async function shopifyOrderByLegacyId(legacyId) {
  const id = `gid://shopify/Order/${legacyId}`;
  const refreshed = await graphql(`query AdminOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id });
  return refreshed.order ? normalizeOrder(refreshed.order, await completeOrderItems(refreshed.order)) : null;
}

export async function fulfillShopifyOrder(legacyId) {
  const id = `gid://shopify/Order/${legacyId}`;
  const data = await graphql(`query AdminFulfillmentOrders($id: ID!) { order(id: $id) { cancelledAt displayFinancialStatus fulfillmentOrders(first: 100) { nodes { id status assignedLocation { location { id } } } pageInfo { hasNextPage endCursor } } } }`, { id });
  const order = data.order;
  if (!order) return null;
  if (order.cancelledAt) throw Object.assign(new Error("No se puede preparar un pedido cancelado."), { status: 409, code: "order_cancelled" });
  if (!["PAID", "PARTIALLY_PAID"].includes(order.displayFinancialStatus)) throw Object.assign(new Error("Shopify solo permite marcar como preparados aquí los pedidos pagados o pagados parcialmente."), { status: 409, code: "order_not_paid" });
  const fulfillmentOrders = [...order.fulfillmentOrders.nodes];
  if (order.fulfillmentOrders.pageInfo.hasNextPage) throw Object.assign(new Error("Este pedido tiene muchas ubicaciones de preparación. Complétalo desde Shopify."), { status: 409, code: "too_many_fulfillment_orders" });
  const open = fulfillmentOrders.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status) && item.assignedLocation?.location?.id);
  if (!open.length) throw Object.assign(new Error("Shopify no muestra artículos pendientes de preparación en este pedido."), { status: 409, code: "nothing_to_fulfill" });
  const groups = new Map();
  for (const fulfillmentOrder of open) {
    const locationId = fulfillmentOrder.assignedLocation.location.id;
    groups.set(locationId, [...(groups.get(locationId) || []), fulfillmentOrder]);
  }
  for (const group of groups.values()) {
    const result = await graphql(`mutation CreateFulfillment($fulfillment: FulfillmentInput!) { fulfillmentCreate(fulfillment: $fulfillment) { fulfillment { id status } userErrors { field message } } }`, {
      fulfillment: { lineItemsByFulfillmentOrder: group.map(({ id: fulfillmentOrderId }) => ({ fulfillmentOrderId })), notifyCustomer: false }
    });
    userErrors(result, "fulfillmentCreate");
  }
  return shopifyOrderByLegacyId(legacyId);
}

export async function cancelShopifyOrder(legacyId) {
  const id = `gid://shopify/Order/${legacyId}`;
  const result = await graphql(`mutation CancelOrder($orderId: ID!) { orderCancel(orderId: $orderId, notifyCustomer: false, refundMethod: { originalPaymentMethodsRefund: true }, restock: true, reason: OTHER, staffNote: "Cancelación solicitada desde el panel de administración Nenufero") { job { id done } orderCancelUserErrors { field message code } userErrors { field message } } }`, { orderId: id });
  const payload = result.orderCancel;
  const errors = [...(payload?.orderCancelUserErrors || []), ...(payload?.userErrors || [])];
  if (errors.length) throw Object.assign(new Error(errors.map((error) => error.message).join(" · ").slice(0, 600)), { status: 422, code: "shopify_cancel_error" });
  const order = await shopifyOrderByLegacyId(legacyId);
  return order ? { order, job: payload.job } : null;
}

export async function updateShopifyProduct(legacyId, fields) {
  const id = `gid://shopify/Product/${legacyId}`;
  const productData = await graphql(`query AdminProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id });
  const current = productData.product;
  if (!current) return null;
  const variants = current.variants.pageInfo.hasNextPage ? await completeVariants(current) : current.variants.nodes;
  const productInput = { id };
  for (const field of ["title", "descriptionHtml", "vendor", "productType", "status", "tags"]) {
    if (fields[field] !== undefined) productInput[field] = fields[field];
  }
  if (Object.keys(productInput).length > 1) {
    const result = await graphql(`mutation UpdateAdminProduct($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id } userErrors { field message } } }`, { product: productInput });
    userErrors(result, "productUpdate");
  }
  if (Array.isArray(fields.variants)) {
    const currentIds = new Set(variants.map((variant) => String(variant.legacyResourceId)));
    if (fields.variants.some((variant) => !currentIds.has(String(variant.id)))) throw Object.assign(new Error("La lista de variantes contiene una referencia que no pertenece a este producto."), { status: 422, code: "invalid_product_variant" });
    const variantInput = fields.variants.map((variant) => ({
      id: `gid://shopify/ProductVariant/${variant.id}`,
      ...(variant.price !== undefined ? { price: variant.price } : {}),
      ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice || null } : {}),
      ...(variant.sku !== undefined ? { inventoryItem: { sku: variant.sku } } : {}),
      ...(variant.barcode !== undefined ? { barcode: variant.barcode || null } : {})
    }));
    for (let index = 0; index < variantInput.length; index += 250) {
      const result = await graphql(`mutation UpdateAdminVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) { product { id } userErrors { field message } } }`, { productId: id, variants: variantInput.slice(index, index + 250) });
      userErrors(result, "productVariantsBulkUpdate");
    }
  }
  const refreshed = await graphql(`query AdminProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id });
  const product = refreshed.product;
  if (!product) return null;
  const refreshedVariants = product.variants.pageInfo.hasNextPage ? await completeVariants(product) : product.variants.nodes;
  return normalizeProduct(product, refreshedVariants, await completeMedia(product));
}

export async function createShopifyVariant(productLegacyId, input) {
  const productId = `gid://shopify/Product/${productLegacyId}`;
  const data = await graphql(`query AdminProductForVariant($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  const product = data.product;
  if (!product) return null;
  const options = product.options || [];
  if (!options.length || options.every((option) => option.name === "Title")) throw Object.assign(new Error("Este producto solo tiene la opción predeterminada. Configura primero sus opciones en Shopify."), { status: 409, code: "product_has_no_variant_options" });
  const optionValues = options.map((option) => option.name === "Title" ? { name: "Title", value: "Default Title" } : input.optionValues.find((value) => value.name === option.name));
  if (input.optionValues.length !== options.filter((option) => option.name !== "Title").length || optionValues.some((value) => !value?.value)) throw Object.assign(new Error("Debes indicar un valor para cada opción del producto."), { status: 422, code: "invalid_variant_options" });
  const existingVariants = product.variants.pageInfo.hasNextPage ? await completeVariants(product) : product.variants.nodes;
  const duplicate = existingVariants.some((variant) => options.every((option) => variant.selectedOptions.find((selected) => selected.name === option.name)?.value === optionValues.find((value) => value.name === option.name)?.value));
  if (duplicate) throw Object.assign(new Error("Ya existe una variante con esa combinación de opciones."), { status: 409, code: "duplicate_variant" });
  const result = await graphql(`mutation CreateAdminVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkCreate(productId: $productId, variants: $variants) { product { id } productVariants { id } userErrors { field message } } }`, {
    productId,
    variants: [{
      price: input.price,
      compareAtPrice: input.compareAtPrice || null,
      barcode: input.barcode || null,
      inventoryItem: { sku: input.sku },
      optionValues: optionValues.filter((option) => option.name !== "Title").map(({ name, value }) => ({ optionName: name, name: value }))
    }]
  });
  userErrors(result, "productVariantsBulkCreate");
  const refreshed = await graphql(`query AdminProductForVariant($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  if (!refreshed.product) return null;
  const variants = refreshed.product.variants.pageInfo.hasNextPage ? await completeVariants(refreshed.product) : refreshed.product.variants.nodes;
  return normalizeProduct(refreshed.product, variants, await completeMedia(refreshed.product));
}

export async function deleteShopifyVariant(productLegacyId, variantLegacyId) {
  const productId = `gid://shopify/Product/${productLegacyId}`;
  const variantId = `gid://shopify/ProductVariant/${variantLegacyId}`;
  const data = await graphql(`query AdminProductBeforeVariantDelete($id: ID!) { product(id: $id) { variants(first: 100) { nodes { id } pageInfo { hasNextPage endCursor } } } }`, { id: productId });
  if (!data.product) return null;
  const variants = [...data.product.variants.nodes];
  if (data.product.variants.pageInfo.hasNextPage) throw Object.assign(new Error("Este producto tiene muchas variantes para borrar desde aquí."), { status: 409, code: "too_many_product_variants" });
  if (!variants.some((variant) => variant.id === variantId)) return null;
  if (variants.length <= 1) throw Object.assign(new Error("Shopify requiere que cada producto conserve al menos una variante."), { status: 409, code: "last_product_variant" });
  const result = await graphql(`mutation DeleteAdminVariant($productId: ID!, $variantsIds: [ID!]!) { productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) { product { id } userErrors { field message } } }`, { productId, variantsIds: [variantId] });
  userErrors(result, "productVariantsBulkDelete");
  const refreshed = await graphql(`query AdminProductAfterVariantDelete($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  if (!refreshed.product) return null;
  const remaining = refreshed.product.variants.pageInfo.hasNextPage ? await completeVariants(refreshed.product) : refreshed.product.variants.nodes;
  return normalizeProduct(refreshed.product, remaining, await completeMedia(refreshed.product));
}

export async function addShopifyProductImage(productLegacyId, source, alt) {
  let url;
  try { url = new URL(source); }
  catch { throw Object.assign(new Error("La dirección de imagen no es válida."), { status: 422, code: "invalid_product_image_url" }); }
  if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname) || ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) || /\.(local|localhost|internal|test)$/.test(url.hostname.toLowerCase())) throw Object.assign(new Error("La imagen debe estar en una dirección HTTPS pública."), { status: 422, code: "invalid_product_image_url" });
  const productId = `gid://shopify/Product/${productLegacyId}`;
  const result = await graphql(`mutation AddProductImage($product: ProductUpdateInput!, $media: [CreateMediaInput!]) { productUpdate(product: $product, media: $media) { product { id } userErrors { field message } } }`, {
    product: { id: productId }, media: [{ originalSource: url.toString(), alt, mediaContentType: "IMAGE" }]
  });
  userErrors(result, "productUpdate");
  const refreshed = await graphql(`query ProductAfterMediaChange($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  if (!refreshed.product) return null;
  const variants = refreshed.product.variants.pageInfo.hasNextPage ? await completeVariants(refreshed.product) : refreshed.product.variants.nodes;
  return normalizeProduct(refreshed.product, variants, await completeMedia(refreshed.product));
}

export async function deleteShopifyProductMedia(productLegacyId, mediaId) {
  const productId = `gid://shopify/Product/${productLegacyId}`;
  const data = await graphql(`query AdminProductBeforeMediaDelete($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  const product = data.product;
  if (!product) return null;
  const media = await completeMedia(product);
  if (!media.some((item) => item.id === mediaId)) return null;
  const result = await graphql(`mutation DeleteProductMedia($productId: ID!, $mediaIds: [ID!]!) { productDeleteMedia(productId: $productId, mediaIds: $mediaIds) { deletedMediaIds mediaUserErrors { field message } } }`, { productId, mediaIds: [mediaId] });
  const errors = result.productDeleteMedia?.mediaUserErrors || [];
  if (errors.length) throw Object.assign(new Error(errors.map((error) => error.message).join(" · ").slice(0, 600)), { status: 422, code: "shopify_media_validation_error" });
  const refreshed = await graphql(`query ProductAfterMediaChange($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id: productId });
  if (!refreshed.product) return null;
  const variants = refreshed.product.variants.pageInfo.hasNextPage ? await completeVariants(refreshed.product) : refreshed.product.variants.nodes;
  return normalizeProduct(refreshed.product, variants, await completeMedia(refreshed.product));
}

export async function adjustShopifyInventory(productId, variantId, locationId, delta) {
  const variantGid = `gid://shopify/ProductVariant/${variantId}`;
  const data = await graphql(`query AdminVariantInventory($id: ID!) { productVariant(id: $id) { product { legacyResourceId } inventoryItem { id tracked inventoryLevels(first: 100) { nodes { location { id } } } } } }`, { id: variantGid });
  const variant = data.productVariant;
  if (!variant || String(variant.product.legacyResourceId) !== String(productId)) return null;
  const inventoryItemId = variant.inventoryItem?.id;
  if (!inventoryItemId || !variant.inventoryItem.tracked) throw Object.assign(new Error("Esta variante no tiene el seguimiento de inventario activado en Shopify."), { status: 422, code: "inventory_not_tracked" });
  if (!variant.inventoryItem.inventoryLevels.nodes.some((level) => level.location.id === locationId)) throw Object.assign(new Error("La variante no tiene inventario en esa ubicación. Revisa sus ubicaciones en Shopify."), { status: 422, code: "inventory_location_unavailable" });
  const idempotencyKey = randomUUID();
  const result = await graphql(`mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!, $idempotencyKey: String!) { inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) { inventoryAdjustmentGroup { changes { delta quantityAfterChange } } userErrors { field message } } }`, {
    idempotencyKey,
    input: { reason: "correction", name: "available", referenceDocumentUri: `nenufero://admin/inventory-adjustment/${idempotencyKey}`, changes: [{ inventoryItemId, locationId, delta, changeFromQuantity: null }] }
  });
  userErrors(result, "inventoryAdjustQuantities");
  return result.inventoryAdjustQuantities?.inventoryAdjustmentGroup || null;
}

export { STATUS_TAG_PREFIX };
