export const CURRENCY = "eur";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./storage.mjs";

const demoProducts = [
  { sku: "camiseta", title: "Camiseta personalizada", category: "Personalizados", unit: "unidad", model: "unit", demoRate: 1890 },
  { sku: "sudadera", title: "Sudadera personalizada", category: "Personalizados", unit: "unidad", model: "unit", demoRate: 3290 },
  { sku: "taza", title: "Taza personalizada", category: "Personalizados", unit: "unidad", model: "unit", demoRate: 1290 },
  { sku: "bolsa", title: "Bolsa personalizada", category: "Personalizados", unit: "unidad", model: "unit", demoRate: 1490 },
  { sku: "objeto", title: "Objeto personalizado", category: "Personalizados", unit: "unidad", model: "unit", demoRate: 1690 },
  { sku: "gran-formato", title: "Impresión de gran formato", category: "Gran formato", unit: "m²", model: "area", demoRate: 2590 },
  { sku: "vinilo-corte", title: "Vinilo de corte", category: "Vinilo por metros", unit: "metro lineal", model: "meter", demoRate: 890 },
  { sku: "vinilo-impreso", title: "Vinilo impreso", category: "Vinilo por metros", unit: "metro lineal", model: "meter", demoRate: 1790 },
  { sku: "vinilo-transparente", title: "Vinilo transparente", category: "Vinilo por metros", unit: "metro lineal", model: "meter", demoRate: 1290 },
  { sku: "vinilo-escaparate", title: "Vinilo para escaparate", category: "Vinilo por metros", unit: "metro lineal", model: "meter", demoRate: 1490 },
  { sku: "pvc-m2", title: "PVC cortado a medida", category: "PVC y metacrilato", unit: "m²", model: "area", demoRate: 4290 },
  { sku: "metacrilato-m2", title: "Metacrilato cortado a medida", category: "PVC y metacrilato", unit: "m²", model: "area", demoRate: 7290 },
  { sku: "corte-laser", title: "Corte láser · pieza de prueba", category: "Corte láser", unit: "pieza", model: "unit", demoRate: 990 }
];

const overridesFile = join(DATA_DIR, "catalog-overrides.json");
let productOverrides = {};
let overridesMutation = Promise.resolve();

export async function loadProductOverrides() {
  try {
    const parsed = JSON.parse(await readFile(overridesFile, "utf8"));
    productOverrides = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    productOverrides = {};
  }
}

export async function updateProduct(sku, fields) {
  const product = demoProducts.find((entry) => entry.sku === sku);
  if (!product) return null;
  const task = overridesMutation.then(async () => {
    productOverrides[sku] = { ...(productOverrides[sku] || {}), ...fields, updatedAt: new Date().toISOString() };
    const temporary = `${overridesFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(productOverrides, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, overridesFile);
    return getProduct(sku);
  });
  overridesMutation = task.catch(() => {});
  return task;
}

function parseLiveRates(env = process.env) {
  try {
    const parsed = JSON.parse(env.STRIPE_LIVE_RATES_EUR_CENTS || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, cents]) => Number.isSafeInteger(cents) && cents > 0));
  } catch {
    return {};
  }
}

function liveRate(product, envRates) {
  return Object.hasOwn(product, "stripeRateCents") ? product.stripeRateCents : (envRates[product.sku] ?? null);
}

export function paymentMode(env = process.env) {
  return env.PAYMENT_MODE === "stripe" ? "stripe" : "simulated";
}

export function getProduct(sku) {
  const product = demoProducts.find((entry) => entry.sku === sku);
  return product ? { ...product, active: true, ...productOverrides[sku] } : null;
}

export function listAdminProducts() {
  return demoProducts.map(({ sku }) => getProduct(sku));
}

export function getPublicCatalog(env = process.env) {
  const mode = paymentMode(env);
  const rates = parseLiveRates(env);
  const configuredShipping = env.STRIPE_SHIPPING_EUR_CENTS;
  const shippingCents = mode === "simulated" ? 590 : (configuredShipping !== undefined && configuredShipping !== "" ? Number(configuredShipping) : null);
  const shippingAvailable = mode === "simulated" || (Number.isSafeInteger(shippingCents) && shippingCents >= 0);
  return {
    mode,
    currency: CURRENCY,
    demo: mode === "simulated",
    notice: mode === "simulated"
      ? "Precios ilustrativos de demostración. No son tarifas de Nenufero y no se realiza ningún cargo."
      : "Pago seguro con Stripe. El importe se calcula con las tarifas aprobadas por Nenufero.",
    shippingCents: shippingAvailable ? shippingCents : null,
    shippingAvailable,
    products: demoProducts.map(({ sku }) => {
      const product = getProduct(sku);
      const stripeRate = liveRate(product, rates);
      const { demoRate, stripeRateCents, ...publicProduct } = product;
      return {
        ...publicProduct,
        unitAmountCents: mode === "simulated" ? product.demoRate : stripeRate,
        available: product.active !== false && (mode === "simulated" || Number.isSafeInteger(stripeRate))
      };
    })
  };
}

export function priceCart(lines, env = process.env) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 30) {
    throw new Error("El carrito debe tener entre 1 y 30 productos.");
  }
  const mode = paymentMode(env);
  const rates = parseLiveRates(env);
  const priced = lines.map((line) => {
    const product = getProduct(line?.sku);
    if (!product || product.active === false) throw new Error("Uno de los productos ya no está disponible.");
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100 || (product.model !== "meter" && !Number.isInteger(quantity))) {
      throw new Error(`Revisa la cantidad de ${product.title.toLowerCase()}.`);
    }
    const rate = mode === "simulated" ? product.demoRate : liveRate(product, rates);
    if (!Number.isSafeInteger(rate) || rate <= 0) {
      throw new Error(`Falta configurar el precio aprobado de ${product.title.toLowerCase()} antes de activar Stripe.`);
    }
    let unitAmountCents = rate;
    const options = normalizeOptions(line.options);
    if (product.model === "area") {
      const widthMm = Number(options.widthMm);
      const heightMm = Number(options.heightMm);
      if (!Number.isInteger(widthMm) || !Number.isInteger(heightMm) || widthMm < 50 || heightMm < 50 || widthMm > 30000 || heightMm > 30000) {
        throw new Error(`Indica medidas válidas en milímetros para ${product.title.toLowerCase()}.`);
      }
      unitAmountCents = Math.max(1, Math.ceil(rate * widthMm * heightMm / 1_000_000));
    }
    if (mode === "stripe" && unitAmountCents < 50) {
      throw new Error(`El precio configurado para ${product.title.toLowerCase()} debe ser de al menos 0,50 € por unidad.`);
    }
    const lineTotalCents = Math.round(unitAmountCents * quantity);
    if (mode === "stripe" && lineTotalCents < 50) {
      throw new Error(`El importe de ${product.title.toLowerCase()} debe ser de al menos 0,50 €.`);
    }
    return {
      sku: product.sku,
      title: product.title,
      category: product.category,
      unit: product.unit,
      model: product.model,
      quantity,
      unitAmountCents,
      lineTotalCents,
      options,
      uploadId: typeof line.uploadId === "string" ? line.uploadId.slice(0, 80) : ""
    };
  });
  const subtotalCents = priced.reduce((sum, item) => sum + item.lineTotalCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 1 || subtotalCents > 100_000_000) {
    throw new Error("El importe del carrito supera el límite permitido.");
  }
  return { items: priced, subtotalCents, mode };
}

function normalizeOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(input).slice(0, 12)) {
    if (typeof value !== "string") continue;
    const normalizedKey = key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    const normalizedValue = value.trim().replace(/[\u0000-\u001f]/g, " ").slice(0, 160);
    if (normalizedKey && normalizedValue) clean[normalizedKey] = normalizedValue;
  }
  return clean;
}

export { parseLiveRates };
