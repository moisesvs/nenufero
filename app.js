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
    row.className = "bag-item";
    const image = document.createElement("img");
    image.src = "public/assets/camiseta-azul.png";
    image.alt = "Camiseta azul de referencia";
    const info = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = "Camiseta Nenufero";
    const detail = document.createElement("p");
    detail.textContent = `Talla ${item.size} · Precio por confirmar`;
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
  const existing = cart.find((item) => item.size === selectedSize);
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else cart.push({ size: selectedSize, quantity });
  quantity = 1;
  quantityOutput.value = quantity;
  quantityOutput.textContent = quantity;
  renderCart();
  openDrawer();
});

checkoutButton.addEventListener("click", () => {
  if (!cart.length) return;
  const lines = cart.map((item) => `Camiseta Nenufero · talla ${item.size} · cantidad ${item.quantity}`);
  const message = `Hola, quiero consultar este pedido de la colección Nenufero:\n${lines.join("\n")}\n¿Me podéis confirmar precio y disponibilidad?`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

document.querySelectorAll("[data-service]").forEach((card) => card.addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const select = document.querySelector('[name="service"]');
  const service = card.dataset.service;
  const option = [...select.options].find((entry) => entry.textContent === service);
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
  const message = [
    `Hola, soy ${String(data.get("name")).trim()}.`,
    `Quería consultar un proyecto de ${String(data.get("service")).toLowerCase()}.`,
    `Mi teléfono es ${phone}.`,
    `Detalles: ${String(data.get("details")).trim()}`
  ].join("\n");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

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
