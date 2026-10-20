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
let orders = [];
let products = [];

const statusNames = { new: "Nuevo", confirmed: "Confirmado", in_production: "En producción", ready: "Listo", completed: "Completado", cancelled: "Cancelado" };
const statusOptions = Object.entries(statusNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function euros(cents) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((Number(cents) || 0) / 100);
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
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.fulfillmentStatus || "new")).length;
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
    const text = [order.id, order.customer?.name, order.customer?.email, ...(order.items || []).map((item) => item.title)].join(" ").toLocaleLowerCase("es");
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
    const paymentLabel = order.paymentStatus === "paid" ? "PAGO CONFIRMADO" : order.paymentStatus === "simulated" ? "PEDIDO SIMULADO · SIN COBRO" : order.paymentStatus === "failed" ? "PAGO FALLIDO" : "PENDIENTE DE PAGO";
    const note = order.adminNote || "";
    return `<article class="order-card" data-order-id="${escapeHtml(order.id)}">
      <div><div class="order-id">${escapeHtml(order.id)}</div><p class="order-meta">${escapeHtml(dateText(order.createdAt))} · ${escapeHtml(itemText || "Sin artículos")}</p><span class="order-payment${order.paymentStatus === "paid" ? " is-paid" : ""}">${paymentLabel}</span></div>
      <div class="order-customer"><strong>${escapeHtml(customer.name || "Cliente sin nombre")}</strong><p class="order-contact">${escapeHtml(customer.email || "Sin email")}<br>${escapeHtml(customer.phone || "Sin teléfono")}</p></div>
      <div class="order-total">${euros(order.totalCents)}<p class="order-meta">${escapeHtml(order.delivery === "shipping" ? "Envío" : "Recogida")} · ${escapeHtml(order.mode === "simulated" ? "Prueba" : "Stripe")}</p></div>
      <div class="order-status"><label for="status-${escapeHtml(order.id)}">Preparación</label><select id="status-${escapeHtml(order.id)}" data-order-status>${statusOptions.replace(`value="${status}"`, `value="${status}" selected`)}</select></div>
      <button class="order-open" type="button" data-open-detail>Ver detalle ${order._open ? "−" : "+"}</button>
      <div class="order-detail" ${order._open ? "" : "hidden"}>
        <div class="detail-section"><h3>Entrega</h3><p>${escapeHtml(address)}</p><p>Subtotal: ${euros(order.subtotalCents)} · Envío: ${euros(order.shippingCents)}</p></div>
        <div class="detail-section"><h3>Artículos</h3><ul>${(order.items || []).map((item) => `<li>${escapeHtml(item.title)} — ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${euros(item.lineTotalCents)}${item.fileName ? ` · <a href="/api/admin/uploads/${encodeURIComponent(item.uploadId)}" download>${escapeHtml(item.fileName)} (descargar referencia)</a>` : ""}${Object.values(item.options || {}).filter(Boolean).length ? ` · ${escapeHtml(Object.values(item.options).filter(Boolean).join(" / "))}` : ""}</li>`).join("")}</ul></div>
        <div class="admin-note"><label for="note-${escapeHtml(order.id)}">Nota interna</label><textarea id="note-${escapeHtml(order.id)}" maxlength="2000" placeholder="Apuntes para el equipo; no se envían al cliente">${escapeHtml(note)}</textarea><button class="quiet-button note-save" type="button" data-save-note>Guardar nota</button></div>
      </div>
    </article>`;
  }).join("");
}

function renderProducts() {
  productsList.innerHTML = products.map((product) => `<tr data-sku="${escapeHtml(product.sku)}">
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
  document.body.dataset.mode = productData.mode;
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
  const button = event.target.closest("[data-save-product]");
  if (!button) return;
  const row = button.closest("[data-sku]");
  const old = products.find((product) => product.sku === row.dataset.sku);
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
