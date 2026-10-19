(() => {
  const KEY = "nenufero-cart-v1";
  let configPromise;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadges(items);
    window.dispatchEvent(new CustomEvent("nenufero:cart-updated", { detail: items }));
  }

  function updateBadges(items = read()) {
    const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    document.querySelectorAll("[data-order-count],[data-cart-count]").forEach((node) => { node.textContent = Number.isInteger(count) ? count : count.toFixed(1); });
  }

  function money(cents) {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(cents || 0) / 100);
  }

  async function config() {
    if (!configPromise) configPromise = fetch("/api/config", { headers: { Accept: "application/json" } }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
      return response.json();
    });
    return configPromise;
  }

  async function api(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "No se pudo completar la solicitud.");
    return result;
  }

  async function upload(file) {
    if (!(file instanceof File)) return null;
    if (file.size > 20 * 1024 * 1024) throw new Error("El archivo no puede superar 20 MB.");
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-Upload-Name": encodeURIComponent(file.name) },
      body: file
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "No se pudo subir el archivo.");
    return result;
  }

  function add(item) {
    const items = read();
    items.push({ id: crypto.randomUUID(), ...item });
    write(items);
    return items;
  }

  function setQuantity(id, quantity) {
    const items = read().map((item) => item.id === id ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
    write(items);
    return items;
  }

  function remove(id) {
    const items = read().filter((item) => item.id !== id);
    write(items);
    return items;
  }

  window.NenuferoStore = { KEY, read, write, updateBadges, money, config, api, upload, add, setQuantity, remove };
  updateBadges();
  window.addEventListener("storage", (event) => { if (event.key === KEY) updateBadges(); });
})();
