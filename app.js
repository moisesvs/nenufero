const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
if (menuButton && mainNav) {
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
}

document.querySelectorAll("[data-hero-gallery]").forEach((gallery) => {
  const slides = [...gallery.querySelectorAll("[data-gallery-slide]")];
  const dots = [...gallery.querySelectorAll("[data-gallery-go]")];
  const count = gallery.querySelector("[data-gallery-count]");
  if (slides.length < 2) return;

  let activeIndex = 0;
  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeIndex;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (count) count.innerHTML = `${String(activeIndex + 1).padStart(2, "0")} <span>/</span> ${String(slides.length).padStart(2, "0")}`;
  };

  gallery.querySelector("[data-gallery-previous]")?.addEventListener("click", () => showSlide(activeIndex - 1));
  gallery.querySelector("[data-gallery-next]")?.addEventListener("click", () => showSlide(activeIndex + 1));
  dots.forEach((dot) => dot.addEventListener("click", () => showSlide(Number(dot.dataset.galleryGo))));
  gallery.addEventListener("keydown", (event) => {
    if (event.target.closest("button")) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); showSlide(activeIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); showSlide(activeIndex + 1); }
  });

  let touchStart = null;
  gallery.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  gallery.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) showSlide(activeIndex + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
});

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: .15 });
  document.querySelectorAll(".service-card,.manifesto-inner,.step,.review-list").forEach((element) => {
    element.classList.add("reveal");
    observer.observe(element);
  });
  const wordObserver = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-on");
      currentObserver.unobserve(entry.target);
    });
  }, { rootMargin: "-22% 0px -62% 0px", threshold: .2 });
  document.querySelectorAll(".word-step").forEach((word) => wordObserver.observe(word));
}
