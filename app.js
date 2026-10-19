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
