const store = window.NenuferoStore;
const app = document.querySelector("#commerce-app");
const page = document.body.dataset.commercePage;
const HOME = "../index.html";
const HUB = "/tienda/index.html";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function header() {
  const count = store.read().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const labels = { cart: "Carrito", checkout: "Finalizar compra", confirmation: "Confirmación" };
  const pageNavigation = `<nav class="store-page-navigation" aria-label="Navegación de la página"><a class="store-page-back" href="${HOME}#inicio"><span aria-hidden="true">←</span> Volver al inicio</a><div class="store-page-links"><a href="${HOME}#servicios">Servicios</a><a href="${HUB}">Tienda online</a><a href="${HOME}#proceso">Cómo trabajamos</a><a href="/faq.html">Preguntas frecuentes</a></div><span class="store-page-current" aria-current="page">${labels[page] || "Tienda online"}</span></nav>`;
  return `<div class="store-announcement"><span>Estudio de impresión y rotulación en Madrid</span><a href="https://wa.me/34673629342" target="_blank" rel="noreferrer">Hablemos de tu proyecto <span aria-hidden="true">↗</span></a></div><header class="site-header store-site-header"><button class="menu-toggle store-menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span></button><a class="wordmark brand-lockup store-brand-lockup" href="${HOME}#inicio" aria-label="Nenufero, inicio"><img class="brand-symbol" src="../public/assets/nenufero-logo.png" alt=""><span class="wordmark-name">NENUFERO</span></a><nav class="main-nav store-main-nav" aria-label="Navegación principal"><a href="${HOME}#servicios">Servicios</a><a href="${HUB}">Tienda online</a><a href="${HOME}#proceso">Cómo trabajamos</a><a href="/faq.html">Preguntas frecuentes</a><a href="${HOME}#contacto">Contacto</a></nav><a class="header-store-link store-quick-link" href="${HUB}"><span>Comprar online</span><span aria-hidden="true">↗</span></a><a class="header-cart-link store-cart-link" href="/tienda/carrito.html" aria-label="Ver mi pedido, ${count} productos"><span>Mi pedido</span><b data-order-count>${count}</b></a></header>${pageNavigation}`;
}

document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".store-menu-toggle");
  if (!toggle) return;
  const open = toggle.getAttribute("aria-expanded") === "true";
  const nav = document.querySelector(".store-main-nav");
  toggle.setAttribute("aria-expanded", String(!open));
  toggle.setAttribute("aria-label", open ? "Abrir menú" : "Cerrar menú");
  nav?.classList.toggle("is-open", !open);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".store-main-nav a")) return;
  const toggle = document.querySelector(".store-menu-toggle");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Abrir menú");
  document.querySelector(".store-main-nav")?.classList.remove("is-open");
});

function footer() {
  return `<footer class="commerce-footer"><a href="${HUB}">Seguir comprando <span>↗</span></a><p>¿Tienes una consulta? <a href="https://wa.me/34673629342" target="_blank" rel="noreferrer">Habla con el taller</a></p></footer>`;
}

function optionsText(options = {}) {
  return Object.values(options).filter(Boolean).join(" · ");
}

function unitPrice(product, item) {
  if (!product?.available || !Number.isSafeInteger(product.unitAmountCents)) return null;
  if (product.model !== "area") return product.unitAmountCents;
  const widthMm = Number(item.options?.widthMm);
  const heightMm = Number(item.options?.heightMm);
  if (!widthMm || !heightMm) return null;
  return Math.max(1, Math.ceil(product.unitAmountCents * widthMm * heightMm / 1_000_000));
}

function emptyState() {
  return `<section class="commerce-empty"><span class="eyebrow">Tu carrito</span><h1>Empieza con una idea.</h1><p>Aún no has añadido productos. Elige una categoría y configura tu pedido.</p><a class="button button-blue" href="${HUB}">Explorar tienda online <span>↗</span></a></section>`;
}

function renderCart(config) {
  const items = store.read();
  if (!items.length) return `${header()}<main class="commerce-shell">${emptyState()}</main>${footer()}`;
  const products = new Map(config.products.map((product) => [product.sku, product]));
  let subtotal = 0;
  const lines = items.map((item) => {
    const product = products.get(item.sku);
    const cents = unitPrice(product, item);
    const lineTotal = cents === null ? null : Math.round(cents * Number(item.quantity));
    if (lineTotal !== null) subtotal += lineTotal;
    const description = optionsText(item.options);
    return `<article class="commerce-line"><div class="commerce-line-main"><span class="eyebrow">${esc(product?.category || "Nenufero")}</span><h2>${esc(product?.title || "Producto")}</h2>${description ? `<p>${esc(description)}</p>` : ""}${item.fileName ? `<small>Archivo de referencia: ${esc(item.fileName)}</small>` : ""}<button class="commerce-remove" type="button" data-remove-item="${esc(item.id)}">Quitar</button></div><label class="commerce-quantity">${product?.model === "meter" ? "Metros" : "Unidades"}<input type="number" min="${product?.model === "meter" ? "0.1" : "1"}" step="${product?.model === "meter" ? "0.1" : "1"}" value="${esc(item.quantity)}" data-item-quantity="${esc(item.id)}" aria-label="Cantidad de ${esc(product?.title || "producto")}"></label><div class="commerce-line-price">${lineTotal === null ? "Precio por configurar" : store.money(lineTotal)}</div></article>`;
  }).join("");
  const priceNote = config.demo ? `<p class="demo-warning">${esc(config.notice)}</p>` : "";
  const canContinue = items.every((item) => unitPrice(products.get(item.sku), item) !== null);
  return `${header()}<main class="commerce-shell"><div class="commerce-title-row"><div><p class="eyebrow">Paso 1 de 2 · Tu selección</p><h1>Revisa tu pedido.</h1></div><span class="commerce-count">${items.length} ${items.length === 1 ? "producto" : "productos"}</span></div>${priceNote}<div class="commerce-layout"><section class="commerce-lines" aria-label="Productos en el carrito">${lines}<a class="continue-shopping" href="${HUB}">← Añadir otro producto</a></section><aside class="commerce-summary"><p class="eyebrow">Resumen</p><div class="summary-row"><span>Subtotal</span><strong>${store.money(subtotal)}</strong></div><div class="summary-row"><span>Envío</span><span>Se calcula en el siguiente paso</span></div><div class="summary-total"><span>Total estimado</span><strong>${store.money(subtotal)}</strong></div><a class="button button-blue checkout-button${canContinue ? "" : " is-disabled"}" href="${canContinue ? "/tienda/checkout.html" : "#"}"${canContinue ? "" : " aria-disabled=\"true\""}>Continuar al checkout <span>↗</span></a><p class="summary-trust">Tus precios se validan en el servidor antes de confirmar.</p></aside></div></main>${footer()}`;
}

function renderCheckout(config) {
  const items = store.read();
  if (!items.length) return `${header()}<main class="commerce-shell">${emptyState()}</main>${footer()}`;
  const products = new Map(config.products.map((product) => [product.sku, product]));
  const subtotal = items.reduce((sum, item) => {
    const cents = unitPrice(products.get(item.sku), item);
    return sum + (cents === null ? 0 : Math.round(cents * Number(item.quantity)));
  }, 0);
  const lines = items.map((item) => {
    const product = products.get(item.sku);
    const cents = unitPrice(product, item);
    return `<div class="checkout-summary-line"><span>${esc(product?.title || "Producto")} <small>× ${esc(item.quantity)} ${esc(product?.unit || "")}</small></span><strong>${cents === null ? "—" : store.money(Math.round(cents * Number(item.quantity)))}</strong></div>`;
  }).join("");
  const demo = config.mode === "simulated";
  const shipDisabled = !config.shippingAvailable;
  const paymentLabel = demo ? "Completar compra de prueba" : "Continuar a Stripe";
  return `${header()}<main class="commerce-shell"><div class="commerce-title-row"><div><p class="eyebrow">Paso 2 de 2 · Tus datos y pago</p><h1>Ya casi está.</h1></div><a class="back-to-cart" href="/tienda/carrito.html">← Volver al carrito</a></div>${demo ? `<p class="demo-warning">${esc(config.notice)} El checkout simulado no envía un pedido al taller.</p>` : `<p class="secure-note"><span aria-hidden="true">✓</span> El pago se procesa de forma segura en Stripe.</p>`}<div class="checkout-layout"><form class="checkout-form" id="checkout-form" novalidate><section class="checkout-step"><span class="checkout-step-number">01</span><div class="checkout-step-content"><h2>Datos de contacto</h2><p>Te enviaremos el resumen del pedido a este email.</p><div class="checkout-fields"><label>Nombre y apellidos<input name="name" autocomplete="name" required maxlength="120"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" placeholder="Opcional" maxlength="40"></label></div></div></section><section class="checkout-step"><span class="checkout-step-number">02</span><div class="checkout-step-content"><h2>Entrega</h2><div class="delivery-options"><label class="delivery-choice"><input type="radio" name="delivery" value="pickup" checked><span><b>Recogida en el taller</b><small>Calle La del Manojo de Rosas 81, Madrid · Sin coste</small></span><strong>Gratis</strong></label><label class="delivery-choice${shipDisabled ? " is-unavailable" : ""}"><input type="radio" name="delivery" value="shipping"${shipDisabled ? " disabled" : ""}><span><b>Envío estándar</b><small>${demo ? "Importe de prueba; no es una tarifa real." : shipDisabled ? "Configura la tarifa de envío para activar esta opción." : "La dirección se confirma en Stripe."}</small></span><strong>${config.shippingAvailable ? store.money(config.shippingCents) : "—"}</strong></label></div><div class="checkout-fields shipping-address-fields" data-shipping-address hidden><label class="wide">Dirección<input name="addressLine1" autocomplete="address-line1" maxlength="180"></label><label class="wide">Piso, puerta, etc. <span>Opcional</span><input name="addressLine2" autocomplete="address-line2" maxlength="120"></label><label>Código postal<input name="postalCode" autocomplete="postal-code" maxlength="16"></label><label>Ciudad<input name="city" autocomplete="address-level2" maxlength="100"></label><label class="wide">Provincia<input name="province" autocomplete="address-level1" maxlength="100"></label></div>${!demo && !shipDisabled ? `<p class="delivery-note" data-stripe-delivery hidden>Stripe te pedirá la dirección de entrega en la siguiente pantalla.</p>` : ""}</div></section><section class="checkout-step payment-step"><span class="checkout-step-number">03</span><div class="checkout-step-content"><h2>${demo ? "Pago de prueba" : "Pago seguro"}</h2><p>${demo ? "No se solicitarán datos bancarios ni se realizará ningún cargo." : "Tras revisar tus datos, continuarás al checkout alojado por Stripe."}</p><div class="payment-method-card"><span class="payment-check">✓</span><span><b>${demo ? "Simulación de compra" : "Stripe Checkout"}</b><small>${demo ? "Sin cobro · Pedido guardado solo en este entorno" : "Tarjeta y métodos disponibles en tu cuenta Stripe"}</small></span><span class="stripe-wordmark">${demo ? "TEST" : "stripe"}</span></div></div></section><p class="checkout-error" data-checkout-error role="alert"></p><button class="button button-blue checkout-submit" type="submit">${paymentLabel} <span>↗</span></button><p class="checkout-legal">Al continuar aceptas que estos datos se utilicen para gestionar este pedido.</p></form><aside class="checkout-recap"><p class="eyebrow">Resumen del pedido</p>${lines}<div class="summary-row"><span>Subtotal</span><strong>${store.money(subtotal)}</strong></div><div class="summary-row"><span>Entrega</span><strong data-shipping-total>—</strong></div><div class="summary-total"><span>Total</span><strong data-checkout-total>${store.money(subtotal)}</strong></div>${demo ? `<p class="demo-warning compact">Precios y envío de ejemplo. No representan tarifas reales.</p>` : ""}</aside></div></main>${footer()}`;
}

function renderConfirmation(order, pending = false) {
  if (!order) return `${header()}<main class="commerce-shell"><section class="commerce-empty"><span class="eyebrow">Estado del pedido</span><h1>No encontramos la compra.</h1><p>Vuelve al carrito para revisar los productos seleccionados.</p><a class="button button-blue" href="/tienda/carrito.html">Volver al carrito <span>↗</span></a></section></main>${footer()}`;
  const demo = order.mode === "simulated";
  const paid = order.paymentStatus === "paid";
  const simulated = order.paymentStatus === "simulated";
  const title = simulated ? "Simulación completada." : paid ? "Pago confirmado." : pending ? "Estamos verificando el pago." : "El pago no se completó.";
  const text = simulated
    ? "El flujo de compra se completó como prueba. No se realizó ningún cargo y este pedido no se ha enviado al taller."
    : paid
      ? "Stripe confirmó el pago. Tu pedido quedó registrado con esta referencia."
      : pending
        ? "Stripe todavía está confirmando el pago. Puedes actualizar el estado en unos segundos."
        : "No vemos un pago confirmado. Puedes volver al carrito e intentarlo de nuevo.";
  const items = order.items.map((item) => `<div class="checkout-summary-line"><span>${esc(item.title)} <small>× ${esc(item.quantity)} ${esc(item.unit)}</small></span><strong>${store.money(item.lineTotalCents)}</strong></div>`).join("");
  return `${header()}<main class="commerce-shell"><section class="confirmation-card"><span class="confirmation-mark">${simulated || paid ? "✓" : "…"}</span><p class="eyebrow">${simulated ? "COMPRA DE PRUEBA" : paid ? "PAGO SEGURO · STRIPE" : "ESTADO DEL PAGO"}</p><h1>${title}</h1><p class="confirmation-copy">${text}</p><div class="confirmation-reference"><span>Referencia del pedido</span><strong>${esc(order.id)}</strong></div><div class="confirmation-items">${items}</div><div class="summary-total"><span>Total ${demo ? "de ejemplo" : "pagado"}</span><strong>${store.money(order.totalCents)}</strong></div><div class="confirmation-actions">${pending ? `<button type="button" class="button button-blue" data-refresh-session>Actualizar estado</button>` : ""}<a class="button ${pending ? "button-outline" : "button-dark"}" href="${HUB}">Volver a la tienda <span>↗</span></a></div></section></main>${footer()}`;
}

function renderError(message) {
  return `${header()}<main class="commerce-shell"><section class="commerce-empty"><span class="eyebrow">Tienda online</span><h1>No pudimos cargar el checkout.</h1><p>${esc(message)}</p><a class="button button-blue" href="${HUB}">Volver a la tienda <span>↗</span></a></section></main>${footer()}`;
}

function bindCartPage(config) {
  app.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => {
    store.remove(button.dataset.removeItem);
    mount(config);
  }));
  app.querySelectorAll("[data-item-quantity]").forEach((input) => input.addEventListener("change", () => {
    const quantity = Number(input.value);
    const product = config.products.find((item) => item.sku === store.read().find((line) => line.id === input.dataset.itemQuantity)?.sku);
    if (!Number.isFinite(quantity) || quantity < (product?.model === "meter" ? 0.1 : 1) || quantity > 100) {
      input.value = store.read().find((line) => line.id === input.dataset.itemQuantity)?.quantity || 1;
      return;
    }
    store.setQuantity(input.dataset.itemQuantity, quantity);
    mount(config);
  }));
}

function bindCheckout(config) {
  const form = app.querySelector("#checkout-form");
  if (!form) return;
  const shipFields = form.querySelector("[data-shipping-address]");
  const stripeDelivery = form.querySelector("[data-stripe-delivery]");
  const shippingTotal = app.querySelector("[data-shipping-total]");
  const total = app.querySelector("[data-checkout-total]");
  const subtotal = store.read().reduce((sum, item) => {
    const product = config.products.find((entry) => entry.sku === item.sku);
    const unit = unitPrice(product, item);
    return sum + (unit === null ? 0 : Math.round(unit * Number(item.quantity)));
  }, 0);
  function updateDelivery() {
    const shipping = form.elements.delivery.value === "shipping";
    shipFields.hidden = !(shipping && config.mode === "simulated");
    shipFields.querySelectorAll("input").forEach((input) => { input.required = shipping && config.mode === "simulated" && input.name !== "addressLine2"; });
    if (stripeDelivery) stripeDelivery.hidden = !(shipping && config.mode === "stripe");
    const fee = shipping && config.shippingAvailable ? config.shippingCents : 0;
    shippingTotal.textContent = shipping ? (config.shippingAvailable ? store.money(fee) : "Por configurar") : "Gratis";
    total.textContent = store.money(subtotal + fee);
  }
  form.querySelectorAll('input[name="delivery"]').forEach((radio) => radio.addEventListener("change", updateDelivery));
  updateDelivery();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = form.querySelector("[data-checkout-error]");
    error.textContent = "";
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    const previousLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = config.mode === "stripe" ? "Conectando con Stripe…" : "Guardando pedido de prueba…";
    const data = new FormData(form);
    const address = {
      line1: data.get("addressLine1"), line2: data.get("addressLine2"),
      postalCode: data.get("postalCode"), city: data.get("city"), province: data.get("province")
    };
    try {
      const result = await store.api("/api/checkout", {
        items: store.read().map(({ sku, quantity, options, uploadId }) => ({ sku, quantity, options, uploadId })),
        customer: { name: data.get("name"), email: data.get("email"), phone: data.get("phone") },
        delivery: data.get("delivery"), address
      });
      if (result.mode === "stripe") {
        if (!result.checkoutUrl || !result.checkoutUrl.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe no devolvió un enlace de pago válido.");
        window.location.assign(result.checkoutUrl);
        return;
      }
      store.write([]);
      window.location.assign(`/tienda/confirmacion.html?order=${encodeURIComponent(result.order.id)}`);
    } catch (caught) {
      error.textContent = caught.message || "No se pudo completar el pedido.";
      button.disabled = false;
      button.innerHTML = previousLabel;
    }
  });
}

async function loadConfirmation() {
  const query = new URLSearchParams(location.search);
  const orderId = query.get("order");
  const sessionId = query.get("session_id");
  if (orderId) {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "No encontramos el pedido.");
    store.write([]);
    return { order: data.order, pending: false };
  }
  if (sessionId) {
    const response = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "No se pudo consultar el estado del pago.");
    if (data.order.paymentStatus === "paid") store.write([]);
    return { order: data.order, pending: data.order.paymentStatus === "unpaid" && data.order.status !== "checkout_expired" };
  }
  return { order: null, pending: false };
}

function mount(config) {
  if (page === "cart") {
    app.innerHTML = renderCart(config);
    bindCartPage(config);
    if (new URLSearchParams(location.search).get("checkout") === "cancelled") {
      app.querySelector(".commerce-title-row")?.insertAdjacentHTML("afterend", `<p class="checkout-cancelled">El pago se canceló. Tu carrito sigue guardado.</p>`);
    }
  } else if (page === "checkout") {
    app.innerHTML = renderCheckout(config);
    bindCheckout(config);
  }
}

(async () => {
  try {
    if (page === "confirmation") {
      const state = await loadConfirmation();
      app.innerHTML = renderConfirmation(state.order, state.pending);
      app.querySelector("[data-refresh-session]")?.addEventListener("click", () => location.reload());
      return;
    }
    const config = await store.config();
    mount(config);
  } catch (error) {
    app.innerHTML = renderError(error.message || "Comprueba que el servidor local esté iniciado.");
  }
})();
