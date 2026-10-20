const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const setupMessage = document.querySelector("#setup-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const ordersList = document.querySelector("#orders-list");
const productsList = document.querySelector("#products-list");
const orderSearch = document.querySelector("#order-search");
const orderFilter = document.querySelector("#order-filter");
const productSearch = document.querySelector("#product-search");
let orders = [];
let products = [];
let catalogSource = "local";

const statusNames = { new: "Nuevo", confirmed: "Confirmado", in_production: "En producción", ready: "Listo", completed: "Completado", cancelled: "Detenido internamente" };
const statusOptions = Object.entries(statusNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function euros(cents) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((Number(cents) || 0) / 100);
}

function money(cents, currency = "EUR") {
  try { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format((Number(cents) || 0) / 100); }
  catch { return euros(cents); }
}

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "No se pudo completar la solicitud.");
  return data;
}

function showLogin(configured = true) {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  setupMessage.hidden = configured;
  loginForm.hidden = !configured;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

function notify(message, isError = false) {
  dashboardMessage.textContent = message;
  dashboardMessage.classList.toggle("is-error", isError);
  if (message) window.setTimeout(() => { if (dashboardMessage.textContent === message) dashboardMessage.textContent = ""; }, 4500);
}

function renderStats() {
  const activeOrders = orders.filter((order) => !order.cancelledAt && !["FULFILLED", "CANCELLED"].includes(order.shopifyFulfillmentStatus) && !["completed", "cancelled"].includes(order.fulfillmentStatus || "new")).length;
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid").length;
  const activeProducts = products.filter((product) => product.active !== false).length;
  const stats = [
    ["Pedidos totales", orders.length], ["Por gestionar", activeOrders],
    ["Pagos confirmados", paidOrders], ["Productos activos", `${activeProducts} / ${products.length}`]
  ];
  document.querySelector("#stats-grid").innerHTML = stats.map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
  document.querySelector("#orders-tab-count").textContent = orders.length;
  document.querySelector("#products-tab-count").textContent = products.length;
}

function renderOrders() {
  const query = orderSearch.value.trim().toLocaleLowerCase("es");
  const selectedStatus = orderFilter.value;
  const filtered = orders.filter((order) => {
    const status = order.fulfillmentStatus || "new";
    const text = [order.id, order.orderName, order.customer?.name, order.customer?.email, order.customer?.phone, order.address?.city, order.address?.postalCode, ...(order.tags || []), ...(order.items || []).flatMap((item) => [item.title, item.sku])].join(" ").toLocaleLowerCase("es");
    return (selectedStatus === "all" || status === selectedStatus) && (!query || text.includes(query));
  });
  if (!filtered.length) {
    ordersList.innerHTML = `<div class="empty-state">${orders.length ? "No hay pedidos que coincidan con la búsqueda." : "Todavía no hay pedidos registrados."}</div>`;
    return;
  }
  ordersList.innerHTML = filtered.map((order) => {
    const status = order.fulfillmentStatus || "new";
    const customer = order.customer || {};
    const itemText = (order.items || []).map((item) => `${item.title} × ${item.quantity}`).join(" · ");
    const address = order.address ? [order.address.line1, order.address.line2, order.address.city, order.address.province, order.address.postalCode, order.address.country].filter(Boolean).join(", ") : "Recogida en el taller";
    const paymentLabels = { paid: "PAGO CONFIRMADO", partially_paid: "PAGO PARCIAL", pending: "PENDIENTE DE PAGO", authorized: "PAGO AUTORIZADO", partially_refunded: "REEMBOLSO PARCIAL", refunded: "REEMBOLSADO", voided: "ANULADO", expired: "CADUCADO", simulated: "PEDIDO SIMULADO · SIN COBRO", failed: "PAGO FALLIDO" };
    const paymentLabel = paymentLabels[order.paymentStatus] || "ESTADO DE PAGO NO DISPONIBLE";
    const note = order.adminNote || "";
    const shopifyActions = order.source === "shopify" && !order.cancelledAt && !order.cancelPending ? `<div class="shopify-order-actions"><strong>Acciones reales de Shopify</strong><div>${order.shopifyFulfillmentStatus !== "FULFILLED" ? `<button class="quiet-button" type="button" data-shopify-fulfill ${order.paymentStatus !== "paid" && order.paymentStatus !== "partially_paid" ? "disabled" : ""}>Marcar artículos preparados</button>` : ""}<button class="quiet-button danger-button" type="button" data-shopify-cancel>Cancelar, reembolsar y reponer stock</button></div><small>La preparación no avisa al cliente. La cancelación no envía una notificación al cliente.</small></div>` : "";
    return `<article class="order-card" data-order-id="${escapeHtml(order.id)}">
      <div><div class="order-id">${escapeHtml(order.orderName || order.id)}</div><p class="order-meta">${escapeHtml(dateText(order.createdAt))} · ${escapeHtml(itemText || "Sin artículos")}</p><span class="order-payment${order.paymentStatus === "paid" ? " is-paid" : ""}">${paymentLabel}</span></div>
      <div class="order-customer"><strong>${escapeHtml(customer.name || "Cliente sin nombre")}</strong><p class="order-contact">${escapeHtml(customer.email || "Sin email")}<br>${escapeHtml(customer.phone || "Sin teléfono")}</p></div>
      <div class="order-total">${money(order.totalCents, order.currency)}<p class="order-meta">${escapeHtml(order.delivery === "shipping" ? "Envío" : "Recogida")} · ${escapeHtml(order.source === "shopify" ? `Shopify · ${order.shopifyFulfillmentStatus || "Sin preparar"}` : order.mode === "simulated" ? "Prueba" : "Stripe")}</p></div>
      <div class="order-status"><label for="status-${escapeHtml(order.id)}">Estado interno de producción</label><select id="status-${escapeHtml(order.id)}" data-order-status ${order.cancelledAt ? "disabled" : ""}>${statusOptions.replace(`value="${status}"`, `value="${status}" selected`)}</select></div>
      <button class="order-open" type="button" data-open-detail>Ver detalle ${order._open ? "−" : "+"}</button>
      <div class="order-detail" ${order._open ? "" : "hidden"}>
        <div class="detail-section"><h3>Entrega</h3><p>${escapeHtml(address)}</p><p>Subtotal: ${money(order.subtotalCents, order.currency)} · Envío: ${money(order.shippingCents, order.currency)}</p></div>
        <div class="detail-section"><h3>Artículos</h3><ul>${(order.items || []).map((item) => `<li>${escapeHtml(item.title)} — ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${money(item.lineTotalCents, order.currency)}${item.fileName ? ` · <a href="/api/admin/uploads/${encodeURIComponent(item.uploadId)}" download>${escapeHtml(item.fileName)} (descargar referencia)</a>` : ""}${Object.values(item.options || {}).filter(Boolean).length ? ` · ${escapeHtml(Object.values(item.options).filter(Boolean).join(" / "))}` : ""}</li>`).join("")}</ul></div>
        ${shopifyActions}
        <div class="admin-note"><label for="note-${escapeHtml(order.id)}">Nota interna</label><textarea id="note-${escapeHtml(order.id)}" maxlength="2000" placeholder="Apuntes para el equipo; no se envían al cliente">${escapeHtml(note)}</textarea><button class="quiet-button note-save" type="button" data-save-note>Guardar nota</button></div>
      </div>
    </article>`;
  }).join("");
}

function renderProducts() {
  const query = productSearch.value.trim().toLocaleLowerCase("es");
  const visibleProducts = products.filter((product) => {
    const variantTerms = (product.variants || []).flatMap((variant) => [variant.sku, variant.barcode, variant.title]);
    const text = [product.title, product.sku, product.handle, product.id, product.category, product.vendor, ...(product.tags || []), ...variantTerms].join(" ").toLocaleLowerCase("es");
    return !query || text.includes(query);
  });
  const header = document.querySelector(".product-table thead");
  if (catalogSource === "shopify") {
    header.innerHTML = "<tr><th>Producto</th><th>Marca y tipo</th><th>Etiquetas y estado</th><th>Variantes, precio e inventario</th><th></th></tr>";
    productsList.innerHTML = visibleProducts.map((product) => `<tr data-sku="${escapeHtml(product.id)}" class="shopify-product-row">
      <td><label class="shopify-product-field">Nombre<input type="text" data-field="title" value="${escapeHtml(product.title)}" maxlength="255"></label><label class="shopify-product-field">Descripción HTML<textarea data-field="descriptionHtml" maxlength="40000">${escapeHtml(product.descriptionHtml)}</textarea></label><span class="product-sku">${escapeHtml(product.handle)} · ${escapeHtml(product.id)}</span></td>
      <td><label class="shopify-product-field">Marca<input type="text" data-field="vendor" value="${escapeHtml(product.vendor)}" maxlength="255"></label><label class="shopify-product-field">Tipo<input type="text" data-field="category" value="${escapeHtml(product.category)}" maxlength="255"></label></td>
      <td><label class="shopify-product-field">Etiquetas, separadas por comas<input type="text" data-field="tags" value="${escapeHtml(product.tags.join(", "))}" maxlength="2000"></label><label class="shopify-product-field">Publicación<select data-field="status"><option value="ACTIVE" ${product.status === "ACTIVE" ? "selected" : ""}>Activo</option><option value="DRAFT" ${product.status === "DRAFT" ? "selected" : ""}>Borrador</option><option value="ARCHIVED" ${product.status === "ARCHIVED" ? "selected" : ""}>Archivado</option></select></label><span class="product-sku">Inventario total: ${escapeHtml(product.totalInventory)}</span></td>
      <td><div class="variant-editor">${product.variants.map((variant) => `<div class="variant-row" data-variant-id="${escapeHtml(variant.id)}"><strong>${escapeHtml(variant.title)}</strong><span>${escapeHtml(variant.inventoryQuantity)} unidades totales · ${variant.inventoryTracked ? "inventario por ubicación" : "seguimiento de stock desactivado"}</span><label>Precio <input type="number" data-variant-price min="0" step="0.01" value="${escapeHtml(variant.price)}"></label><label>Precio comparativo <input type="number" data-variant-compare min="0" step="0.01" value="${escapeHtml(variant.compareAtPrice)}" placeholder="Sin precio"></label><label>SKU <input type="text" data-variant-sku maxlength="100" value="${escapeHtml(variant.sku)}"></label><label>Código de barras <input type="text" data-variant-barcode maxlength="100" value="${escapeHtml(variant.barcode)}"></label>${variant.inventoryTracked ? `<div class="inventory-editor">${variant.inventoryLocations.map((location) => `<div class="inventory-location"><span><strong>${escapeHtml(location.name)}</strong> · ${escapeHtml(location.available)} disponibles</span><label for="delta-${escapeHtml(variant.id)}-${escapeHtml(location.id)}">Ajuste</label><input id="delta-${escapeHtml(variant.id)}-${escapeHtml(location.id)}" type="number" step="1" min="-10000" max="10000" data-inventory-delta placeholder="+ / −"><button type="button" data-adjust-inventory data-location-id="${escapeHtml(location.id)}">Aplicar</button></div>`).join("") || `<span>Sin ubicaciones de inventario.</span>`}</div>` : ""}</div>`).join("")}</div></td>
      <td><button class="product-save" type="button" data-save-product>Guardar</button></td>
    </tr>`).join("");
    document.querySelector("#pricing-mode").textContent = "CATÁLOGO SHOPIFY";
    return;
  }
  header.innerHTML = "<tr><th>Producto y SKU</th><th>Categoría</th><th>Precio de demostración</th><th>Tarifa Stripe</th><th>Estado</th><th></th></tr>";
  productsList.innerHTML = visibleProducts.map((product) => `<tr data-sku="${escapeHtml(product.sku)}">
    <td><input type="text" data-field="title" value="${escapeHtml(product.title)}" maxlength="120" aria-label="Nombre de ${escapeHtml(product.sku)}"><span class="product-sku">${escapeHtml(product.sku)} · ${escapeHtml(product.unit)} · ${escapeHtml(product.model)}</span></td>
    <td><input type="text" data-field="category" value="${escapeHtml(product.category)}" maxlength="80" aria-label="Categoría de ${escapeHtml(product.title)}"></td>
    <td><label class="price-input"><span class="visually-hidden">Precio de demostración</span><input type="number" data-field="demoRate" min="0.01" step="0.01" value="${(product.demoRate / 100).toFixed(2)}"></label></td>
    <td><label class="price-input"><span class="visually-hidden">Tarifa Stripe</span><input type="number" data-field="stripeRate" min="0.50" step="0.01" value="${product.stripeRateCents ? (product.stripeRateCents / 100).toFixed(2) : ""}" placeholder="Sin configurar"></label></td>
    <td class="check-cell"><label><span class="visually-hidden">Producto activo</span><input type="checkbox" data-field="active" ${product.active === false ? "" : "checked"}></label></td>
    <td><button class="product-save" type="button" data-save-product>Guardar</button></td>
  </tr>`).join("");
  document.querySelector("#pricing-mode").textContent = document.body.dataset.mode === "stripe" ? "MODO STRIPE" : "MODO DE PRUEBA";
}

async function loadData() {
  const [orderData, productData] = await Promise.all([api("/api/admin/orders"), api("/api/admin/products")]);
  orders = orderData.orders;
  products = productData.products;
  catalogSource = productData.source || "local";
  document.body.dataset.mode = productData.mode;
  const integrationStatus = document.querySelector("#integration-status");
  integrationStatus.textContent = productData.source === "shopify"
    ? "Conectado a Shopify. Pedidos y catálogo se leen directamente de la tienda. El estado de producción del panel es interno; el estado de preparación real aparece indicado como Shopify. Para consultar pedidos anteriores a los últimos 60 días, Shopify debe conceder read_all_orders. Los ajustes de stock requieren write_inventory."
    : "Modo local: se muestran los pedidos y productos guardados en este prototipo. Configura Shopify para administrar el catálogo y los pedidos de la tienda real.";
  integrationStatus.classList.toggle("is-shopify", productData.source === "shopify");
  renderStats();
  renderOrders();
  renderProducts();
}

document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-admin-view]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
  const productsView = button.dataset.adminView === "products";
  document.querySelector("#orders-view").hidden = productsView;
  document.querySelector("#products-view").hidden = !productsView;
  notify("");
}));

orderSearch.addEventListener("input", renderOrders);
orderFilter.addEventListener("change", renderOrders);
productSearch.addEventListener("input", renderProducts);
document.querySelector("[data-refresh]").addEventListener("click", () => loadData().then(() => notify("Datos actualizados.")).catch((error) => notify(error.message, true)));
document.querySelector("#logout-button").addEventListener("click", async () => {
  await api("/api/admin/session", { method: "DELETE" }).catch(() => {});
  showLogin(true);
});

ordersList.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-order-id]");
  if (!card) return;
  const order = orders.find((entry) => entry.id === card.dataset.orderId);
  if (!order) return;
  if (event.target.closest("[data-open-detail]")) {
    order._open = !order._open;
    renderOrders();
    return;
  }
  const fulfillButton = event.target.closest("[data-shopify-fulfill]");
  if (fulfillButton) {
    if (!window.confirm(`¿Marcar en Shopify como preparados todos los artículos pendientes del pedido ${order.orderName || order.id}? No se enviará un aviso al cliente.`)) return;
    fulfillButton.disabled = true;
    try {
      const result = await api(`/api/admin/orders/${encodeURIComponent(order.id)}/fulfill`, { method: "POST" });
      Object.assign(order, result.order);
      renderOrders();
      renderStats();
      notify(`Preparación actualizada en Shopify: ${order.orderName || order.id}.`);
    } catch (error) { notify(error.message, true); fulfillButton.disabled = false; }
    return;
  }
  const cancelButton = event.target.closest("[data-shopify-cancel]");
  if (cancelButton) {
    if (!window.confirm(`Vas a cancelar ${order.orderName || order.id}, devolver al medio de pago original el importe pendiente de reembolso, reponer el stock y conservar el pedido cancelado en Shopify. ¿Continuar?`)) return;
    cancelButton.disabled = true;
    try {
      const result = await api(`/api/admin/orders/${encodeURIComponent(order.id)}/cancel`, { method: "POST" });
      Object.assign(order, result.order);
      order.cancelPending = result.job?.done === false;
      renderOrders();
      renderStats();
      notify(order.cancelPending ? `Shopify está procesando la cancelación de ${order.orderName || order.id}.` : `Pedido cancelado en Shopify: ${order.orderName || order.id}.`);
    } catch (error) { notify(error.message, true); cancelButton.disabled = false; }
    return;
  }
  if (event.target.closest("[data-save-note]")) {
    const note = card.querySelector("textarea").value;
    try {
      await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: "PATCH", body: JSON.stringify({ adminNote: note }) });
      order.adminNote = note;
      notify(`Nota guardada para ${order.id}.`);
    } catch (error) { notify(error.message, true); }
  }
});

ordersList.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-order-status]")) return;
  const card = event.target.closest("[data-order-id]");
  const order = orders.find((entry) => entry.id === card.dataset.orderId);
  try {
    const result = await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: "PATCH", body: JSON.stringify({ fulfillmentStatus: event.target.value }) });
    Object.assign(order, result.order);
    renderOrders();
    renderStats();
    notify(`Estado actualizado: ${order.id}.`);
  } catch (error) { notify(error.message, true); renderOrders(); }
});

productsList.addEventListener("click", async (event) => {
  const inventoryButton = event.target.closest("[data-adjust-inventory]");
  if (inventoryButton) {
    const productRow = inventoryButton.closest("[data-sku]");
    const variantRow = inventoryButton.closest("[data-variant-id]");
    const deltaInput = inventoryButton.parentElement.querySelector("[data-inventory-delta]");
    const delta = Number(deltaInput.value);
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 10000) return notify("Escribe un ajuste entero distinto de cero, entre −10.000 y 10.000.", true);
    inventoryButton.disabled = true;
    try {
      const productName = products.find((product) => product.id === productRow.dataset.sku)?.title || "Producto";
      await api(`/api/admin/products/${encodeURIComponent(productRow.dataset.sku)}/inventory`, { method: "POST", body: JSON.stringify({ variantId: variantRow.dataset.variantId, locationId: inventoryButton.dataset.locationId, delta }) });
      await loadData();
      notify(`Ajuste de inventario guardado para ${productName}.`);
    } catch (error) { notify(error.message, true); inventoryButton.disabled = false; }
    return;
  }
  const button = event.target.closest("[data-save-product]");
  if (!button) return;
  const row = button.closest("[data-sku]");
  const old = products.find((product) => product.sku === row.dataset.sku);
  if (catalogSource === "shopify") {
    const product = products.find((entry) => entry.id === row.dataset.sku);
    const body = {
      title: row.querySelector('[data-field="title"]').value.trim(),
      descriptionHtml: row.querySelector('[data-field="descriptionHtml"]').value,
      vendor: row.querySelector('[data-field="vendor"]').value.trim(),
      category: row.querySelector('[data-field="category"]').value.trim(),
      tags: row.querySelector('[data-field="tags"]').value.split(",").map((tag) => tag.trim()).filter(Boolean),
      status: row.querySelector('[data-field="status"]').value,
      variants: [...row.querySelectorAll("[data-variant-id]")].map((variant) => ({
        id: variant.dataset.variantId,
        price: variant.querySelector("[data-variant-price]").value,
        compareAtPrice: variant.querySelector("[data-variant-compare]").value,
        sku: variant.querySelector("[data-variant-sku]").value,
        barcode: variant.querySelector("[data-variant-barcode]").value
      }))
    };
    button.disabled = true;
    try {
      const result = await api(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      Object.assign(product, result.product);
      renderProducts();
      renderStats();
      notify(`${product.title} actualizado en Shopify.`);
    } catch (error) { notify(error.message, true); button.disabled = false; }
    return;
  }
  const demoValue = Number(row.querySelector('[data-field="demoRate"]').value);
  const stripeInput = row.querySelector('[data-field="stripeRate"]');
  const stripeValue = stripeInput.value === "" ? null : Number(stripeInput.value);
  const body = {
    title: row.querySelector('[data-field="title"]').value.trim(),
    category: row.querySelector('[data-field="category"]').value.trim(),
    demoRateCents: Math.round(demoValue * 100),
    stripeRateCents: stripeValue === null ? null : Math.round(stripeValue * 100),
    active: row.querySelector('[data-field="active"]').checked
  };
  button.disabled = true;
  try {
    const result = await api(`/api/admin/products/${encodeURIComponent(old.sku)}`, { method: "PATCH", body: JSON.stringify(body) });
    Object.assign(old, result.product);
    renderProducts();
    renderStats();
    notify(`${old.title} actualizado.`);
  } catch (error) { notify(error.message, true); button.disabled = false; }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password: loginForm.elements.password.value }) });
    loginForm.reset();
    showDashboard();
    await loadData();
  } catch (error) {
    loginMessage.textContent = error.message;
    if (error.message.includes("ADMIN_PASSWORD")) showLogin(false);
  } finally { button.disabled = false; }
});

async function initialize() {
  try {
    const session = await api("/api/admin/session");
    if (!session.configured) return showLogin(false);
    if (!session.authenticated) return showLogin(true);
    showDashboard();
    await loadData();
  } catch (error) {
    showLogin(false);
    setupMessage.hidden = false;
    setupMessage.textContent = `No se pudo conectar con el servidor: ${error.message}`;
  }
}

initialize();
