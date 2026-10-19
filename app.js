const WHATSAPP_NUMBER = "34673629342";

const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  menuButton.setAttribute("aria-label", open ? "Abrir menú" : "Cerrar menú");
  mainNav.classList.toggle("is-open", !open);
});
mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Abrir menú");
  mainNav.classList.remove("is-open");
}));

const sizeButtons = [...document.querySelectorAll(".size-option")];
const sizeHint = document.querySelector(".size-hint");
let selectedSize = "";
sizeButtons.forEach((button) => button.addEventListener("click", () => {
  selectedSize = button.dataset.size;
  sizeButtons.forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
  sizeHint.textContent = `Talla ${selectedSize} seleccionada. Se confirmará según disponibilidad.`;
}));

let quantity = 1;
const quantityOutput = document.querySelector(".quantity-value");
document.querySelectorAll(".quantity-step").forEach((button) => button.addEventListener("click", () => {
  quantity = Math.max(1, Math.min(20, quantity + Number(button.dataset.step)));
  quantityOutput.value = quantity;
  quantityOutput.textContent = quantity;
}));

const cart = [];
const drawer = document.querySelector(".bag-drawer");
const scrim = document.querySelector(".drawer-scrim");
const emptyBag = document.querySelector(".empty-bag");
const bagItems = document.querySelector(".bag-items");
const checkoutButton = document.querySelector(".checkout-button");
let lastFocus = null;

function renderCart() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelector(".bag-count").textContent = count;
  document.querySelector(".drawer-total-count").textContent = `(${count})`;
  emptyBag.hidden = count > 0;
  checkoutButton.disabled = count === 0;
  bagItems.replaceChildren(...cart.map((item, index) => {
    const row = document.createElement("article");
    row.className = `bag-item${item.image ? "" : " bag-item-text"}`;
    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name;
      row.append(image);
    }
    const info = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = item.name;
    const detail = document.createElement("p");
    detail.textContent = `${item.details} · Precio por confirmar`;
    const remove = document.createElement("button");
    remove.className = "remove-item";
    remove.type = "button";
    remove.textContent = "Quitar del pedido";
    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      renderCart();
    });
    info.append(name, detail, remove);
    const amount = document.createElement("span");
    amount.className = "bag-item-quantity";
    amount.textContent = `× ${item.quantity}`;
    row.append(image, info, amount);
    return row;
  }));
}

function openDrawer() {
  lastFocus = document.activeElement;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add("is-visible"));
  document.body.style.overflow = "hidden";
  document.querySelector(".drawer-close").focus();
}

function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  scrim.classList.remove("is-visible");
  document.body.style.overflow = "";
  window.setTimeout(() => { scrim.hidden = true; }, 550);
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

document.querySelector(".bag-button").addEventListener("click", openDrawer);
document.querySelector(".drawer-close").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);
document.querySelector(".continue-shopping").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer(); });

document.querySelector(".add-to-bag").addEventListener("click", () => {
  if (!selectedSize) {
    sizeHint.textContent = "Elige una talla para añadir la prenda a tu consulta.";
    sizeHint.classList.add("form-error");
    document.querySelector(".sizes").scrollIntoView({ behavior: "smooth", block: "center" });
    sizeButtons[0].focus();
    return;
  }
  sizeHint.classList.remove("form-error");
  const details = `Talla ${selectedSize}`;
  const existing = cart.find((item) => item.name === "Camiseta Nenufero" && item.details === details);
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else cart.push({ name: "Camiseta Nenufero", details, quantity, image: "public/assets/camiseta-azul.png" });
  quantity = 1;
  quantityOutput.value = quantity;
  quantityOutput.textContent = quantity;
  renderCart();
  openDrawer();
});

checkoutButton.addEventListener("click", () => {
  if (!cart.length) return;
  const lines = cart.map((item) => `${item.name} · ${item.details} · cantidad ${item.quantity}`);
  const message = `Hola, quiero preparar este pedido con Nenufero:\n${lines.join("\n")}\n¿Me podéis confirmar precio, disponibilidad y la forma de pago?`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

document.querySelectorAll("[data-material-form]").forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  const product = values.product;
  const quantity = Math.max(1, Math.min(999, Number(values.quantity) || 1));
  const details = Object.entries(values).filter(([key]) => !["product", "quantity"].includes(key) && values[key]).map(([key, value]) => `${({ type: "Material", finish: "Acabado", width: "Ancho", height: "Alto", thickness: "Grosor" })[key] || key}: ${value}`).join(" · ");
  const existing = cart.find((item) => item.name === product && item.details === details);
  if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
  else cart.push({ name: product, details, quantity });
  renderCart();
  openDrawer();
}));

document.querySelectorAll("[data-service]").forEach((card) => card.addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const select = document.querySelector('[name="service"]');
  const service = card.dataset.service;
  const serviceAliases = {
    Rotulación: "Vinilos, lonas o gran formato",
    Impresión: "Otro proyecto",
    Textil: "Camisetas, tazas o productos personalizados",
    "Impresión UVI": "Camisetas, tazas o productos personalizados",
    "Gran formato": "Vinilos, lonas o gran formato",
    "Presencia digital": "Quiero asesoramiento"
  };
  const option = [...select.options].find((entry) => entry.textContent === (serviceAliases[service] || service));
  if (option) select.value = option.value;
  document.querySelector("#presupuesto").scrollIntoView({ behavior: "smooth" });
  window.setTimeout(() => select.focus({ preventScroll: true }), 450);
}));

document.querySelector("#quote-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = form.querySelector(".form-error");
  error.textContent = "";
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const phone = String(data.get("phone")).trim();
  if (phone.replace(/\D/g, "").length < 9) {
    error.textContent = "Escribe un teléfono válido para que podamos responderte.";
    form.elements.phone.focus();
    return;
  }
  const selectedFile = data.get("reference");
  if (selectedFile instanceof File && selectedFile.size > 20 * 1024 * 1024) {
    error.textContent = "El archivo supera el máximo de 20 MB. Elige una versión más ligera.";
    form.elements.reference.focus();
    return;
  }
  const email = String(data.get("email") || "").trim();
  const visit = String(data.get("visit") || "");
  const message = [
    `Hola, soy ${String(data.get("name")).trim()}.`,
    `Quería consultar un proyecto de ${String(data.get("service")).toLowerCase()}.`,
    `Mi teléfono es ${phone}.`,
    email ? `Mi email es ${email}.` : "",
    visit ? `Me gustaría solicitar una visita el ${new Date(visit).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}.` : "",
    selectedFile instanceof File && selectedFile.name ? `Archivo de referencia: ${selectedFile.name} (lo adjuntaré en WhatsApp).` : "",
    `Detalles: ${String(data.get("details")).trim()}`
  ].filter(Boolean).join("\n");
  sendWhatsAppMessage(message, selectedFile instanceof File && selectedFile.name ? selectedFile : null);
});

async function sendWhatsAppMessage(message, file = null) {
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "Consulta Nenufero", text: message, files: [file] });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function prepareReferenceInput(input, preview) {
  if (!input || !preview) return;
  input.addEventListener("change", () => {
  preview.replaceChildren();
  const file = input.files?.[0];
  if (!file) { preview.textContent = "Todavía no has seleccionado ningún archivo."; return; }
  if (file.size > 20 * 1024 * 1024) {
    input.value = "";
    preview.textContent = "El archivo supera 20 MB. Selecciona uno más ligero.";
    preview.classList.add("form-error");
    return;
  }
  preview.classList.remove("form-error");
  if (file.type.startsWith("image/")) {
    const previewImage = document.createElement("img");
    previewImage.alt = "Vista previa de la imagen seleccionada";
    previewImage.src = URL.createObjectURL(file);
    preview.append(previewImage);
  }
  const description = document.createElement("span");
  description.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  preview.append(description);
  });
}

prepareReferenceInput(document.querySelector("[data-reference-file]"), document.querySelector("[data-reference-preview]"));

const visitDate = document.querySelector("[data-visit-date]");
const localDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
visitDate.min = localDateTime;

const sizeDialog = document.querySelector(".size-dialog");
document.querySelector(".size-guide-trigger").addEventListener("click", () => sizeDialog.showModal());
document.querySelector(".dialog-close").addEventListener("click", () => sizeDialog.close());
sizeDialog.addEventListener("click", (event) => { if (event.target === sizeDialog) sizeDialog.close(); });

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .15 });
  document.querySelectorAll(".service-card,.manifesto-inner,.product-layout,.step,.quote-heading,.quote-form,.review-list,.faq-list").forEach((element) => {
    element.classList.add("reveal");
    observer.observe(element);
  });
  const wordObserver = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-on");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "-22% 0px -62% 0px", threshold: .2 });
  document.querySelectorAll(".word-step").forEach((word) => wordObserver.observe(word));
}
