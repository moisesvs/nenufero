(() => {
  const config = window.nenuferoTheme || {};
  const root = (config.routes?.root || "/").replace(/\/?$/, "/");
  const endpoint = (path) => `${root}${path}`;
  const drawer = document.querySelector("[data-cart-drawer]");
  const scrim = document.querySelector("[data-cart-scrim]");
  let previousFocus = null;

  const toggleMenu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggleMenu && nav) {
    toggleMenu.addEventListener("click", () => {
      const open = toggleMenu.getAttribute("aria-expanded") === "true";
      toggleMenu.setAttribute("aria-expanded", String(!open));
      toggleMenu.setAttribute("aria-label", open ? "Abrir menú" : "Cerrar menú");
      nav.classList.toggle("is-open", !open);
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      toggleMenu.setAttribute("aria-expanded", "false");
      toggleMenu.setAttribute("aria-label", "Abrir menú");
      nav.classList.remove("is-open");
    }));
  }

  function showDrawer() {
    if (!drawer || !scrim) return;
    previousFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add("is-visible"));
    document.body.style.overflow = "hidden";
    drawer.querySelector("[data-cart-close]")?.focus();
  }

  function hideDrawer() {
    if (!drawer || !scrim) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("is-visible");
    document.body.style.overflow = "";
    window.setTimeout(() => { scrim.hidden = true; }, 560);
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  document.querySelectorAll("[data-cart-open]").forEach((button) => button.addEventListener("click", showDrawer));
  document.querySelectorAll("[data-cart-close]").forEach((button) => button.addEventListener("click", hideDrawer));
  scrim?.addEventListener("click", hideDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer?.classList.contains("is-open")) hideDrawer();
  });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function money(cents) {
    const format = config.moneyFormat || "${{amount}}";
    const value = Number(cents) / 100;
    const locale = document.documentElement.lang || "es-ES";
    const amount = value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const amountNoDecimals = value.toLocaleString(locale, { maximumFractionDigits: 0 });
    const commaAmount = amount.replace(/\./g, "#").replace(/,/g, ".").replace(/#/g, ",");
    const commaNoDecimals = amountNoDecimals.replace(/\./g, "#").replace(/,/g, ".").replace(/#/g, ",");
    const values = { amount_with_comma_separator: commaAmount, amount_no_decimals_with_comma_separator: commaNoDecimals, amount_no_decimals: amountNoDecimals, amount };
    return format.replace(/\{\{\s*(amount_no_decimals_with_comma_separator|amount_with_comma_separator|amount_no_decimals|amount)\s*\}\}/g, (_, token) => values[token]);
  }

  function updateDrawer(cart) {
    document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = cart.item_count; });
    document.querySelectorAll("[data-cart-open]").forEach((node) => { node.setAttribute("aria-label", `Abrir carrito, ${cart.item_count} productos`); });
    drawer?.querySelectorAll("[data-drawer-count]").forEach((node) => { node.textContent = `(${cart.item_count})`; });
    if (!drawer) return;
    const container = drawer.querySelector("[data-cart-items]");
    const empty = drawer.querySelector("[data-cart-empty]");
    const checkout = drawer.querySelector("[data-cart-checkout]");
    empty.hidden = cart.item_count > 0;
    checkout.setAttribute("aria-disabled", String(cart.item_count === 0));
    checkout.tabIndex = cart.item_count === 0 ? -1 : 0;
    container.replaceChildren(...cart.items.map((item) => {
      const row = element("article", "bag-item");
      row.dataset.cartKey = item.key;
      const link = element("a");
      link.href = item.url;
      if (item.image) {
        const image = element("img");
        image.src = item.image;
        image.alt = item.product_title;
        image.loading = "lazy";
        link.append(image);
      }
      const detail = element("div");
      const titleLink = element("a");
      titleLink.href = item.url;
      titleLink.append(element("h3", "", item.product_title));
      const variant = element("p", "", `${item.variant_title && item.variant_title !== "Default Title" ? `${item.variant_title} · ` : ""}${money(item.final_price)}`);
      const label = element("label", "drawer-item-quantity", "Cantidad");
      const quantity = element("input");
      quantity.type = "number";
      quantity.min = "0";
      quantity.value = item.quantity;
      quantity.setAttribute("aria-label", `Cantidad de ${item.product_title}`);
      quantity.dataset.cartQuantity = "";
      label.append(quantity);
      const remove = element("button", "remove-item", "Quitar");
      remove.type = "button";
      remove.dataset.cartRemove = "";
      detail.append(titleLink, variant, label, remove);
      row.append(link, detail, element("span", "bag-item-total", money(item.final_line_price)));
      return row;
    }));
  }

  async function getCart() {
    const response = await fetch(endpoint("cart.js"), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("No se pudo actualizar el carrito.");
    return response.json();
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest(".product-form");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const message = form.querySelector("[data-product-message]");
    form.classList.add("is-loading");
    if (button) button.disabled = true;
    if (message) message.textContent = "Añadiendo al carrito…";
    try {
      const response = await fetch(endpoint("cart/add.js"), {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message || "No se pudo añadir este producto.");
      updateDrawer(await getCart());
      if (message) message.textContent = "Añadido al carrito.";
      showDrawer();
    } catch (error) {
      if (message) message.textContent = error.message;
      else {
        const errorNote = element("p", "form-error", error.message);
        errorNote.setAttribute("role", "alert");
        form.append(errorNote);
      }
    } finally {
      form.classList.remove("is-loading");
      if (button) button.disabled = false;
      const variantSelect = form.querySelector("select[name='id']");
      if (variantSelect && button) button.disabled = variantSelect.selectedOptions[0]?.dataset.available === "false";
    }
  });

  document.addEventListener("change", async (event) => {
    const quantity = event.target.closest("[data-cart-quantity]");
    if (!quantity) return;
    const row = quantity.closest("[data-cart-key]");
    if (!row) return;
    quantity.disabled = true;
    try {
      const response = await fetch(endpoint("cart/change.js"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: row.dataset.cartKey, quantity: Math.max(0, Number(quantity.value) || 0) })
      });
      const cart = await response.json();
      if (!response.ok) throw new Error(cart.description || "No se pudo actualizar el carrito.");
      updateDrawer(cart);
    } catch (error) {
      quantity.disabled = false;
      quantity.setAttribute("aria-invalid", "true");
    }
  });

  document.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-cart-remove]");
    if (!remove) return;
    const row = remove.closest("[data-cart-key]");
    if (!row) return;
    remove.disabled = true;
    try {
      const response = await fetch(endpoint("cart/change.js"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: row.dataset.cartKey, quantity: 0 })
      });
      const cart = await response.json();
      if (!response.ok) throw new Error("No se pudo quitar el producto.");
      updateDrawer(cart);
    } catch {
      remove.disabled = false;
    }
  });

  document.querySelectorAll("[data-product-section] select[name='id']").forEach((select) => select.addEventListener("change", () => {
    const option = select.selectedOptions[0];
    const section = select.closest("[data-product-section]");
    const price = section.querySelector("[data-product-price]");
    const compare = section.querySelector("[data-product-compare]");
    const button = section.querySelector(".product-submit");
    if (price && option?.dataset.price) price.textContent = option.dataset.price;
    if (compare) {
      compare.textContent = option?.dataset.comparePrice || "";
      compare.hidden = !option?.dataset.comparePrice;
    }
    if (button) {
      const available = option?.dataset.available === "true";
      button.disabled = !available;
      button.firstChild.textContent = available ? "Añadir al carrito " : "Agotado ";
    }
  }));

  document.querySelectorAll("[data-sort-by]").forEach((select) => select.addEventListener("change", () => select.closest("form")?.requestSubmit()));

  document.querySelectorAll("[data-whatsapp-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const error = form.querySelector("[data-form-error]");
    error.textContent = "";
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const phone = String(data.get("phone") || "").trim();
    if (phone.replace(/\D/g, "").length < 9) {
      error.textContent = "Escribe un teléfono válido para que podamos responderte.";
      form.elements.phone.focus();
      return;
    }
    const recipient = String(config.whatsapp || "").replace(/\D/g, "");
    if (!recipient) {
      error.textContent = "No se ha configurado el teléfono de contacto de Nenufero.";
      return;
    }
    const message = [`Hola, soy ${String(data.get("name")).trim()}.`, `Quería consultar un proyecto de ${String(data.get("service")).toLowerCase()}.`, `Mi teléfono es ${phone}.`, `Detalles: ${String(data.get("details")).trim()}`].join("\n");
    window.open(`https://wa.me/${recipient}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }));

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver((entries, currentObserver) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    }), { threshold: .12 });
    document.querySelectorAll(".service-card,.product-card,.step,.quote-heading,.quote-form,.review-list,.faq-list").forEach((node) => {
      node.classList.add("reveal");
      observer.observe(node);
    });
    const wordObserver = new IntersectionObserver((entries, currentObserver) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-on");
        currentObserver.unobserve(entry.target);
      }
    }), { rootMargin: "-22% 0px -62% 0px", threshold: .2 });
    document.querySelectorAll(".word-step").forEach((word) => wordObserver.observe(word));
  }
})();
