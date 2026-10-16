(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (menuButton && mainNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      menuButton.setAttribute('aria-label', open ? 'Abrir menú' : 'Cerrar menú');
      mainNav.classList.toggle('is-open', !open);
    });
    mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menú');
      mainNav.classList.remove('is-open');
    }));
  }
  const form = document.querySelector('.quote-form');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const required = ['name', 'phone', 'service', 'details'];
    const invalid = required.find(key => !String(data.get(key) || '').trim());
    const error = form.querySelector('.form-error');
    if (invalid) { if (error) error.textContent = 'Completa los campos para preparar el mensaje.'; form.elements[invalid].focus(); return; }
    if (error) error.textContent = '';
    const message = `Hola, soy ${data.get('name')} (${data.get('phone')}). Me interesa: ${data.get('service')}. ${data.get('details')}`;
    const phone = document.body.dataset.whatsapp || '34673629342';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  const revealItems = document.querySelectorAll('.service-card, .step, .review-list blockquote, .faq-list details');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    revealItems.forEach(item => { item.classList.add('reveal'); observer.observe(item); });
  }
})();
