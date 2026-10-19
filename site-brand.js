(() => {
  const KEY = "nenufero-site-presentation-v1";
  const DEFAULTS = {
    brandName: "NENUFERO",
    tagline: "Ideas que se ven. Marcas que se recuerdan.",
    headline: ["Tu marca,", "en todas partes."],
    intro: "Rotulación, impresión y personalización para negocios que quieren hacerse notar. Diseñado y producido en Madrid.",
    logo: "",
    services: [
      { title: "Rotulación", tag: "01 / EN LA CALLE", description: "Vehículos, escaparates y espacios que trabajan para ti incluso cuando tú no estás.", href: "tienda/rotulos-luminosos.html" },
      { title: "Impresión", tag: "02 / TINTA Y PAPEL", description: "Tarjetas, folletos y gran formato con un acabado que se nota.", href: "tienda/gran-formato.html" },
      { title: "Textil y UVI", tag: "03 / A TU MANERA", description: "Ropa de trabajo, prendas para tu marca y objetos personalizados.", href: "tienda/personalizados.html" },
      { title: "Presencia digital", tag: "04 / TAMBIÉN EN LÍNEA", description: "Una identidad clara para que tu negocio se entienda también en pantalla.", href: "tienda/proyecto-a-medida.html" }
    ],
    slides: [
      { image: "", title: "01 / EL TALLER", caption: "HECHO EN MADRID" },
      { image: "", title: "02 / TEXTIL PERSONALIZADO", caption: "HECHO A TU MEDIDA" }
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
    const image = slide.querySelector("img");
    if (setting.image) image.src = setting.image;
    const labels = slide.querySelectorAll(".image-label span");
    if (labels[0]) labels[0].textContent = setting.title;
    if (labels[1]) labels[1].textContent = setting.caption;
  });

  window.NenuferoPresentation = { KEY, DEFAULTS: structuredClone(DEFAULTS), getSettings };
})();
