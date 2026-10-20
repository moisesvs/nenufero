const pageId = document.body.dataset.experience;
const app = document.querySelector("#experience-app");
const store = window.NenuferoStore;
let storeConfig = null;

function productSku(formData) {
  if (pageId === "personalizados") {
    return ({ "Camiseta": "camiseta", "Sudadera": "sudadera", "Taza": "taza", "Bolsa de tela": "bolsa", "Objeto personalizado": "objeto" })[formData.get("product")];
  }
  if (pageId === "granformato") return "gran-formato";
  if (pageId === "vinilo") {
    return ({ "Vinilo de corte": "vinilo-corte", "Vinilo de impresión": "vinilo-impreso", "Vinilo transparente": "vinilo-transparente", "Vinilo para escaparate": "vinilo-escaparate" })[formData.get("type")];
  }
  if (pageId === "pvc") return String(formData.get("material") || "").startsWith("PVC") ? "pvc-m2" : "metacrilato-m2";
  if (pageId === "laser") return "corte-laser";
  return null;
}

function itemOptions(form) {
  const options = {};
  for (const field of form.querySelectorAll("input:not([type=file]), select, textarea")) {
    if (!field.value || ["name", "phone", "email", "quantity", "visit"].includes(field.name)) continue;
    const label = field.closest("label")?.childNodes[0]?.textContent.trim() || field.name;
    if (field.name === "width" || field.name === "height") {
      options[label] = `${field.value} ${pageId === "granformato" ? "cm" : "mm"}`;
      const millimeters = pageId === "granformato" ? Number(field.value) * 10 : Number(field.value);
      options[`${field.name}Mm`] = String(Math.round(millimeters));
    } else if (field.name !== "details") {
      options[label] = field.value;
    } else if (field.value.trim()) {
      options["Nota para el taller"] = field.value.trim();
    }
  }
  return options;
}

function computedUnit(product, options) {
  if (!product?.available || !Number.isSafeInteger(product.unitAmountCents)) return null;
  if (product.model !== "area") return product.unitAmountCents;
  const widthMm = Number(options.widthMm);
  const heightMm = Number(options.heightMm);
  if (!widthMm || !heightMm) return null;
  return Math.max(1, Math.ceil(product.unitAmountCents * widthMm * heightMm / 1_000_000));
}

function setMode(config) {
  storeConfig = config;
  const badge = document.querySelector("[data-mode-badge]");
  if (badge) badge.textContent = config.mode === "simulated" ? "PEDIDO DE PRUEBA" : "PAGO CON STRIPE";
  const note = document.querySelector("[data-mode-note]");
  if (note) note.textContent = config.notice;
  const drawerNote = document.querySelector("[data-drawer-note]");
  if (drawerNote) drawerNote.textContent = config.mode === "simulated"
    ? "Modo de prueba: no hay cobros reales ni se envía el pedido al taller."
    : "El total se valida en el servidor antes de continuar al pago seguro con Stripe.";
  updatePricePreview();
}

function updatePricePreview() {
  const form = document.querySelector("[data-experience-form][data-kind=purchase]");
  const box = form?.querySelector("[data-price-preview]");
  if (!form || !box || !storeConfig) return;
  const data = new FormData(form);
  const sku = productSku(data);
  const product = storeConfig.products.find((entry) => entry.sku === sku);
  const options = itemOptions(form);
  const unit = computedUnit(product, options);
  if (!product || unit === null) {
    box.hidden = true;
    return;
  }
  const quantity = Math.max(0, Number(data.get("quantity")) || 1);
  const total = Math.round(unit * quantity);
  box.hidden = false;
  box.querySelector("[data-price-label]").textContent = storeConfig.mode === "simulated" ? "Total de demostración" : "Total orientativo";
  box.querySelector("[data-price-value]").textContent = store.money(total);
  box.querySelector("[data-price-unit]").textContent = `${store.money(unit)} por ${product.unit}${product.model === "area" ? " · calcula el área de cada pieza" : ""}`;
}

function header(count = 0) {
  return `<div class="store-announcement"><span>Estudio de impresión y rotulación en Madrid</span><a href="https://wa.me/34673629342" target="_blank" rel="noreferrer">Hablemos de tu proyecto <span aria-hidden="true">↗</span></a></div><header class="site-header store-site-header"><button class="menu-toggle store-menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span></button><a class="wordmark brand-lockup store-brand-lockup" href="../index.html#inicio" aria-label="Nenufero, inicio"><img class="brand-symbol" src="../public/assets/nenufero-logo.png" alt=""><span class="wordmark-name">NENUFERO</span></a><nav class="main-nav store-main-nav" aria-label="Navegación principal"><a href="../index.html#servicios">Servicios</a><a href="index.html" aria-current="page">Tienda online</a><a href="../index.html#proceso">Cómo trabajamos</a><a href="../faq.html">Preguntas frecuentes</a><a href="../index.html#contacto">Contacto</a></nav><a class="header-store-link store-quick-link" href="index.html"><span>Comprar online</span><span aria-hidden="true">↗</span></a><button class="header-cart-link store-cart-link" type="button" data-open-order aria-label="Ver mi pedido, ${count} productos"><span>Mi pedido</span><b data-order-count>${count}</b></button></header>`;
}

function footer() {
  return `<footer class="store-footer"><a class="store-logo" href="../index.html"><img src="../public/assets/nenufero-logo.png" alt=""><b>NENUFERO</b></a><p>Ideas que se ven. Marcas que se recuerdan.<br>Diseñado y producido en Madrid.</p><div><a href="https://wa.me/34673629342" target="_blank" rel="noreferrer">WhatsApp ↗</a><a href="/tienda/carrito.html">Mi carrito ↗</a><a href="https://maps.google.com/?q=Calle+La+del+Manojo+de+Rosas+81+Madrid" target="_blank" rel="noreferrer">Visítanos ↗</a></div></footer>`;
}

function drawerMarkup() {
  return `<div class="order-overlay" data-order-overlay hidden></div><aside class="order-drawer" data-order-drawer aria-hidden="true"><div class="drawer-top"><div><p class="eyebrow">TU SELECCIÓN</p><h2>Mi pedido <span data-drawer-count>(0)</span></h2></div><button type="button" data-close-order aria-label="Cerrar pedido">×</button></div><div class="drawer-items" data-drawer-items></div><div class="drawer-bottom"><p data-drawer-note>El pedido se valida antes del pago.</p><a class="button button-blue" href="/tienda/carrito.html">Revisar carrito y pagar ↗</a></div></aside>`;
}

function orderAmount(item) {
  const product = storeConfig?.products.find((entry) => entry.sku === item.sku);
  const unit = computedUnit(product, item.options || {});
  return unit === null ? null : Math.round(unit * Number(item.quantity || 1));
}

function renderOrder() {
  const items = store.read();
  const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  document.querySelectorAll("[data-order-count]").forEach((node) => { node.textContent = Number.isInteger(count) ? count : count.toFixed(1); });
  const countLabel = document.querySelector("[data-drawer-count]");
  const container = document.querySelector("[data-drawer-items]");
  if (!container) return;
  if (countLabel) countLabel.textContent = `(${Number.isInteger(count) ? count : count.toFixed(1)})`;
  container.innerHTML = items.length ? items.map((item) => {
    const product = storeConfig?.products.find((entry) => entry.sku === item.sku);
    const amount = orderAmount(item);
    return `<article class="drawer-line"><div><b>${esc(product?.title || "Producto")}</b><p>${esc(Object.values(item.options || {}).filter(Boolean).join(" · "))}</p><small>${amount === null ? "Precio pendiente de configurar" : store.money(amount)}${item.fileName ? ` · Archivo: ${esc(item.fileName)}` : ""}</small></div><button type="button" data-remove-line="${esc(item.id)}" aria-label="Quitar ${esc(product?.title || "producto")}">×</button></article>`;
  }).join("") : `<div class="drawer-empty"><span>✳</span><h3>Aún no has añadido nada.</h3><p>Elige una categoría y configura tu primer pedido.</p><a href="index.html">Explorar tienda ↗</a></div>`;
  container.querySelectorAll("[data-remove-line]").forEach((button) => button.addEventListener("click", () => {
    store.remove(button.dataset.removeLine);
    renderOrder();
  }));
}

app.insertAdjacentHTML("beforebegin", header(store.read().reduce((sum, item) => sum + Number(item.quantity || 0), 0)));
app.innerHTML = pageId === "hub" ? renderHub() : renderExperience(journeys[pageId] || journeys.proyecto);
document.body.insertAdjacentHTML("beforeend", `${footer()}${drawerMarkup()}`);

const menuToggle = document.querySelector(".store-menu-toggle");
const storeNav = document.querySelector(".store-main-nav");
menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  menuToggle.setAttribute("aria-label", open ? "Abrir menú" : "Cerrar menú");
  storeNav.classList.toggle("is-open", !open);
});
storeNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menú");
  storeNav.classList.remove("is-open");
}));

const orderDrawer = document.querySelector("[data-order-drawer]");
const overlay = document.querySelector("[data-order-overlay]");
function showOrder() {
  renderOrder();
  orderDrawer.classList.add("is-open");
  orderDrawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  document.body.classList.add("drawer-active");
}
function hideOrder() {
  orderDrawer.classList.remove("is-open");
  orderDrawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.classList.remove("drawer-active");
}
document.querySelector("[data-open-order]").addEventListener("click", showOrder);
document.querySelector("[data-close-order]").addEventListener("click", hideOrder);
overlay.addEventListener("click", hideOrder);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideOrder(); });
window.addEventListener("nenufero:cart-updated", renderOrder);

document.querySelectorAll("[data-reference-file]").forEach((input) => input.addEventListener("change", () => {
  const preview = input.closest(".file-field").querySelector("[data-file-preview]");
  const file = input.files?.[0];
  preview.replaceChildren();
  if (!file) { preview.textContent = "Opcional"; return; }
  if (file.size > FILE_LIMIT) {
    input.value = "";
    preview.textContent = "Máximo 20 MB";
    preview.classList.add("file-error");
    return;
  }
  preview.classList.remove("file-error");
  if (file.type.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Vista previa de la referencia";
    preview.append(image);
  }
  const fileName = document.createElement("span");
  fileName.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
  preview.append(fileName);
}));

function cartLine(form, data, sku, uploaded) {
  const quantity = Number(data.get("quantity")) || 1;
  return {
    sku,
    quantity,
    options: itemOptions(form),
    uploadId: uploaded?.id || "",
    fileName: uploaded?.fileName || ""
  };
}

document.querySelectorAll("[data-experience-form]").forEach((form) => {
  form.addEventListener("input", updatePricePreview);
  form.addEventListener("change", updatePricePreview);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = form.querySelector("[data-form-error]");
    error.textContent = "";
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    const original = button.innerHTML;
    const data = new FormData(form);
    const file = data.get("reference");
    if (file instanceof File && file.size > FILE_LIMIT) {
      error.textContent = "El archivo supera 20 MB. Elige una versión más ligera.";
      return;
    }
    if (data.get("phone") && String(data.get("phone")).replace(/\D/g, "").length < 9) {
      error.textContent = "Escribe un teléfono válido para que podamos responderte.";
      form.elements.phone?.focus();
      return;
    }
    button.disabled = true;
    button.textContent = file instanceof File && file.name ? "Subiendo referencia…" : "Guardando…";
    try {
      const uploaded = file instanceof File && file.name ? await store.upload(file) : null;
      if (form.dataset.kind === "quote") {
        const result = await store.api("/api/requests", {
          name: data.get("name"), email: data.get("email"), phone: data.get("phone"),
          service: journeys[pageId]?.category || "Proyecto a medida",
          details: [...form.querySelectorAll("input:not([type=file]),select,textarea")]
            .filter((field) => field.value && !["name", "phone", "email", "visit"].includes(field.name))
            .map((field) => `${field.closest("label")?.childNodes[0]?.textContent.trim() || field.name}: ${field.value}`).join("\n"),
          visit: data.get("visit"), uploadId: uploaded?.id || ""
        });
        error.classList.remove("experience-error");
        error.classList.add("request-saved");
        error.textContent = `Solicitud de prueba guardada: ${result.id}. No se ha enviado al taller.`;
        button.textContent = "Solicitud guardada";
        return;
      }
      const sku = productSku(data);
      const product = storeConfig?.products.find((entry) => entry.sku === sku);
      if (!product || !product.available) throw new Error("El precio de este producto aún no está configurado.");
      if (computedUnit(product, itemOptions(form)) === null) throw new Error("Completa las medidas para calcular el importe de prueba.");
      store.add(cartLine(form, data, sku, uploaded));
      button.disabled = false;
      button.innerHTML = original;
      showOrder();
    } catch (caught) {
      error.textContent = caught.message || "No se pudo guardar el producto. Inténtalo de nuevo.";
      button.disabled = false;
      button.innerHTML = original;
    }
  });
});

async function initializeStore() {
  try {
    const config = await store.config();
    setMode(config);
    renderOrder();
    if (pageId === "hub") {
      const notice = document.createElement("p");
      notice.className = "commerce-mode-note hub-mode-note";
      notice.textContent = config.mode === "simulated" ? config.notice : "Los precios se muestran con las tarifas configuradas en el servidor.";
      document.querySelector(".hub-hero")?.insertAdjacentElement("afterend", notice);
    }
  } catch (error) {
    const note = document.querySelector("[data-mode-note]");
    if (note) note.textContent = "Inicia el servidor Node de Nenufero para activar el carrito y el checkout.";
  }
}
initializeStore();
