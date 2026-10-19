const presentation = window.NenuferoPresentation;
const form = document.querySelector("#presentation-form");
const serviceFields = document.querySelector("[data-service-fields]");
const slideFields = document.querySelector("[data-slide-fields]");
const statusLine = document.querySelector("[data-editor-status]");
const defaults = presentation.DEFAULTS;
let settings = presentation.getSettings();

const routes = [
  ["tienda/rotulos-luminosos.html", "Rótulos luminosos"],
  ["tienda/gran-formato.html", "Gran formato"],
  ["tienda/personalizados.html", "Personalizados"],
  ["tienda/vinilo-por-metros.html", "Vinilo por metros"],
  ["tienda/pvc-metacrilato.html", "PVC y metacrilato"],
  ["tienda/corte-laser.html", "Corte láser"],
  ["tienda/proyecto-a-medida.html", "Proyecto a medida"]
];
const defaultSlideImages = ["public/assets/taller-nenufero.png", "public/assets/camiseta-azul.png", "", ""];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderFields() {
  serviceFields.innerHTML = settings.services.map((service, index) => `
    <article class="service-editor-card">
      <div class="service-editor-title"><b>0${index + 1}</b> Actividad destacada</div>
      <label>Nombre<input name="service-title-${index}" value="${escapeHtml(service.title)}" maxlength="42" required></label>
      <label>Etiqueta corta<input name="service-tag-${index}" value="${escapeHtml(service.tag)}" maxlength="44" required></label>
      <label>Descripción<textarea name="service-description-${index}" maxlength="170" rows="3" required>${escapeHtml(service.description)}</textarea></label>
      <label>Enlace de la actividad<select name="service-href-${index}">${routes.map(([href, label]) => `<option value="${href}" ${service.href === href ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    </article>`).join("");

  slideFields.innerHTML = settings.slides.map((slide, index) => `
    <article class="slide-editor-card" data-slide-card="${index}">
      <h3>Imagen destacada 0${index + 1}</h3>
      ${slide.image || defaultSlideImages[index] ? `<img class="slide-preview" data-slide-preview="${index}" src="${slide.image || defaultSlideImages[index]}" alt="Vista previa de la imagen destacada ${index + 1}">` : `<div class="slide-preview slide-preview-placeholder" data-slide-preview="${index}">Vista gráfica para ${escapeHtml(slide.title.split("/").slice(1).join("/").trim())}<br><small>Sube una foto para sustituir esta composición</small></div>`}
      <label>Imagen JPG, PNG o WEBP<input type="file" data-slide-file="${index}" accept="image/jpeg,image/png,image/webp"></label>
      <label>Título de la imagen<input name="slide-title-${index}" value="${escapeHtml(slide.title)}" maxlength="52" required></label>
      <label>Pie de foto<input name="slide-caption-${index}" value="${escapeHtml(slide.caption)}" maxlength="48" required></label>
      <button class="slide-reset" type="button" data-clear-slide="${index}">Volver a la imagen inicial</button>
    </article>`).join("");
}

function populateForm() {
  form.elements.brandName.value = settings.brandName;
  form.elements.tagline.value = settings.tagline;
  form.elements.headline0.value = settings.headline[0];
  form.elements.headline1.value = settings.headline[1];
  form.elements.intro.value = settings.intro;
  document.querySelector("[data-logo-preview]").src = settings.logo || "public/assets/nenufero-logo.png";
  renderFields();
}

function readFile(file, maxWidth, preserveFormat = false) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error("Elige una imagen PNG, JPG o WEBP."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("La imagen original supera los 8 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("El archivo no parece una imagen válida."));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        if (preserveFormat) {
          const result = String(reader.result);
          if (result.length > 680_000) return reject(new Error("El logotipo optimizado supera el límite local de almacenamiento."));
          resolve(result);
          return;
        }
        let quality = 0.82;
        let result = canvas.toDataURL("image/jpeg", quality);
        while (result.length > 720_000 && quality > 0.48) {
          quality -= 0.08;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        if (result.length > 720_000) return reject(new Error("La imagen sigue siendo demasiado grande tras optimizarla."));
        resolve(result);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("is-error", isError);
}

form.addEventListener("change", async (event) => {
  const logoFile = event.target.matches('[name="logo"]') ? event.target.files?.[0] : null;
  const slideInput = event.target.closest("[data-slide-file]");
  try {
    if (logoFile) {
      if (logoFile.size > 500 * 1024) throw new Error("El logotipo debe pesar menos de 500 KB.");
      settings.logo = await readFile(logoFile, 1200, true);
      document.querySelector("[data-logo-preview]").src = settings.logo;
      setStatus("Logotipo listo. Guarda los cambios para verlo en toda la portada.");
    } else if (slideInput?.files?.[0]) {
      const index = Number(slideInput.dataset.slideFile);
      settings.slides[index].image = await readFile(slideInput.files[0], 1500);
      let preview = document.querySelector(`[data-slide-preview="${index}"]`);
      if (preview.tagName !== "IMG") {
        const image = document.createElement("img");
        image.className = "slide-preview";
        image.dataset.slidePreview = String(index);
        image.alt = `Vista previa de la imagen destacada ${index + 1}`;
        preview.replaceWith(image);
        preview = image;
      }
      preview.src = settings.slides[index].image;
      setStatus(`Imagen ${index + 1} optimizada. Guarda los cambios para aplicarla a la portada.`);
    }
  } catch (error) {
    event.target.value = "";
    setStatus(error.message, true);
  }
});

slideFields.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear-slide]");
  if (!button) return;
  const index = Number(button.dataset.clearSlide);
  settings.slides[index].image = "";
  const preview = document.querySelector(`[data-slide-preview="${index}"]`);
  if (defaultSlideImages[index]) {
    preview.src = defaultSlideImages[index];
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "slide-preview slide-preview-placeholder";
    placeholder.dataset.slidePreview = String(index);
    placeholder.innerHTML = `Vista gráfica para ${escapeHtml(settings.slides[index].title.split("/").slice(1).join("/").trim())}<br><small>Sube una foto para sustituir esta composición</small>`;
    preview.replaceWith(placeholder);
  }
  const input = document.querySelector(`[data-slide-file="${index}"]`);
  if (input) input.value = "";
  setStatus(`La imagen ${index + 1} volverá a la propuesta inicial al guardar.`);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const updated = {
    ...settings,
    brandName: String(values.get("brandName")).trim(),
    tagline: String(values.get("tagline")).trim(),
    headline: [String(values.get("headline0")).trim(), String(values.get("headline1")).trim()],
    intro: String(values.get("intro")).trim(),
    services: settings.services.map((service, index) => ({
      ...service,
      title: String(values.get(`service-title-${index}`)).trim(),
      tag: String(values.get(`service-tag-${index}`)).trim(),
      description: String(values.get(`service-description-${index}`)).trim(),
      href: routes.some(([href]) => href === values.get(`service-href-${index}`)) ? values.get(`service-href-${index}`) : defaults.services[index].href
    })),
    slides: settings.slides.map((slide, index) => ({
      ...slide,
      title: String(values.get(`slide-title-${index}`)).trim(),
      caption: String(values.get(`slide-caption-${index}`)).trim()
    }))
  };
  try {
    localStorage.setItem(presentation.KEY, JSON.stringify(updated));
    settings = updated;
    setStatus("Cambios guardados en este navegador. Abre la portada para revisarlos.");
  } catch {
    setStatus("No hay espacio local suficiente para guardar esas imágenes. Prueba con archivos más ligeros.", true);
  }
});

document.querySelector("[data-reset]").addEventListener("click", () => {
  localStorage.removeItem(presentation.KEY);
  settings = structuredClone(defaults);
  populateForm();
  setStatus("La propuesta inicial se restauró en este navegador.");
});

populateForm();
