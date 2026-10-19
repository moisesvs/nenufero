(() => {
  const KEY = "nenufero-site-presentation-v1";
  const DEFAULTS = {
    brandName: "NENUFERO",
    tagline: "Ideas que se ven. Marcas que se recuerdan.",
    headline: ["Tu marca,", "en todas partes."],
    intro: "Rotulación, impresión y personalización para negocios que quieren hacerse notar. Diseñado y producido en Madrid.",
    logo: "",
    services: [
      { title: "Rotulación y rótulos", tag: "01 / EN LA CALLE", description: "Vehículos, escaparates y espacios que trabajan para ti incluso cuando tú no estás.", href: "tienda/rotulos-luminosos.html" },
      { title: "Textil y objetos", tag: "02 / A TU MANERA", description: "Camisetas, tazas y artículos personalizados para tu marca.", href: "tienda/personalizados.html" },
      { title: "Gran formato y vinilo", tag: "03 / TINTA A LO GRANDE", description: "Vinilos, lonas y gráficas para escaparates, espacios y eventos.", href: "tienda/gran-formato.html" },
      { title: "PVC, metacrilato y láser", tag: "04 / CORTE Y FRESADO", description: "Piezas a medida, corte láser y fresado para dar forma a tu proyecto.", href: "tienda/pvc-metacrilato.html" }
    ],
    slides: [
      { image: "", title: "01 / ROTULACIÓN Y RÓTULOS", caption: "DISEÑO · FABRICACIÓN · MONTAJE" },
      { image: "", title: "02 / TEXTIL Y OBJETOS", caption: "CAMISETAS · TAZAS · REGALOS" },
      { image: "", title: "03 / GRAN FORMATO", caption: "VINILOS · LONAS · GRÁFICA" },
      { image: "", title: "04 / MATERIALES Y CORTE", caption: "PVC · METACRILATO · LÁSER" }
    ]
  };

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return structuredClone(DEFAULTS);
      return {
        ...structuredClone(DEFAULTS), ...saved,
        headline: Array.isArray(saved.headline) ? saved.headline.slice(0, 2) : DEFAULTS.headline,
        services: Array.isArray(saved.services) ? DEFAULTS.services.map((item, index) => ({ ...item, ...(saved.services[index] || {}) })) : DEFAULTS.services,
        slides: Array.isArray(saved.slides) ? DEFAULTS.slides.map((item, index) => ({ ...item, ...(saved.slides[index] || {}) })) : DEFAULTS.slides
      };
    } catch { return structuredClone(DEFAULTS); }
  }

  const settings = getSettings();
  if (!document.body.classList.contains("customizer-page")) document.title = `${settings.brandName} | Rotulación e impresión`;
  document.querySelectorAll(".wordmark-name").forEach((node) => { node.textContent = settings.brandName; });
  document.querySelectorAll(".brand-symbol").forEach((image) => { if (settings.logo) image.src = settings.logo; });
  document.querySelectorAll("[data-site-tagline]").forEach((node) => { node.textContent = settings.tagline; });
  const footerTagline = document.querySelector("[data-site-footer-tagline]");
  if (footerTagline) footerTagline.textContent = settings.tagline;
  document.querySelectorAll("[data-headline-line]").forEach((node) => { node.textContent = settings.headline[Number(node.dataset.headlineLine)] || ""; });
  const intro = document.querySelector("[data-site-intro]");
  if (intro) intro.textContent = settings.intro;

  document.querySelectorAll("[data-editable-service]").forEach((card) => {
    const service = settings.services[Number(card.dataset.editableService)];
    if (!service) return;
    card.querySelector("[data-service-title]").textContent = service.title;
    card.querySelector("[data-service-description]").textContent = service.description;
    card.querySelector("[data-service-tag]").textContent = service.tag;
    card.href = service.href;
    card.dataset.service = service.title;
  });

  document.querySelectorAll("[data-gallery-slide]").forEach((slide, index) => {
    const setting = settings.slides[index];
    if (!setting) return;
    const image = slide.querySelector("[data-gallery-image]") || slide.querySelector("img");
    const art = slide.querySelector(".gallery-art");
    if (setting.image && image) {
      image.src = setting.image;
      image.hidden = false;
      if (art) art.hidden = true;
    } else if (art && slide.querySelector("[data-gallery-image]")) {
      image.hidden = true;
      art.hidden = false;
    }
    const labels = slide.querySelectorAll(".image-label span");
    if (labels[0]) labels[0].textContent = setting.title;
    if (labels[1]) labels[1].textContent = setting.caption;
  });

  window.NenuferoPresentation = { KEY, DEFAULTS: structuredClone(DEFAULTS), getSettings };
})();
