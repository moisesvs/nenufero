import { createHmac, timingSafeEqual } from "node:crypto";
import { parseLiveRates } from "./catalog.mjs";

function requireStripe(env = process.env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe necesita STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en el entorno del servidor.");
  }
}

async function stripeRequest(path, { method = "GET", body, idempotencyKey } = {}, env = process.env) {
  requireStripe(env);
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body,
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || "Stripe no pudo completar la operación.");
  return result;
}

export function assertStripeReady(env = process.env) {
  requireStripe(env);
  const rates = parseLiveRates(env);
  if (!Object.keys(rates).length) throw new Error("Configura las tarifas reales aprobadas en STRIPE_LIVE_RATES_EUR_CENTS antes de activar Stripe.");
}

export async function createCheckoutSession(order, env = process.env) {
  assertStripeReady(env);
  const base = (env.PUBLIC_BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${base}/tienda/confirmacion.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${base}/tienda/carrito.html?checkout=cancelled`);
  params.set("client_reference_id", order.id);
  params.set("customer_email", order.customer.email);
  params.set("phone_number_collection[enabled]", "true");
  params.set("metadata[nenufero_order_id]", order.id);
  if (order.delivery === "shipping") {
    const shippingCents = env.STRIPE_SHIPPING_EUR_CENTS !== undefined && env.STRIPE_SHIPPING_EUR_CENTS !== "" ? Number(env.STRIPE_SHIPPING_EUR_CENTS) : NaN;
    if (!Number.isSafeInteger(shippingCents) || shippingCents < 0) {
      throw new Error("Configura STRIPE_SHIPPING_EUR_CENTS o selecciona recogida en taller.");
    }
    params.set("shipping_address_collection[allowed_countries][0]", "ES");
    params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.set("shipping_options[0][shipping_rate_data][display_name]", "Envío estándar");
    params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingCents));
    params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");
  }
  order.items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    const options = [...Object.values(item.options), ...(item.model === "meter" ? [`${item.quantity} ${item.unit}`] : [])].join(" · ");
    const splitMeterQuantity = item.model === "meter" && !Number.isInteger(item.quantity);
    params.set(`${prefix}[price_data][currency]`, "eur");
    params.set(`${prefix}[price_data][unit_amount]`, String(splitMeterQuantity ? item.lineTotalCents : item.unitAmountCents));
    params.set(`${prefix}[price_data][product_data][name]`, item.title);
    if (options) params.set(`${prefix}[price_data][product_data][description]`, options.slice(0, 500));
    params.set(`${prefix}[quantity]`, String(splitMeterQuantity ? 1 : item.quantity));
  });
  return stripeRequest("/checkout/sessions", { method: "POST", body: params, idempotencyKey: order.id }, env);
}

export function retrieveCheckoutSession(sessionId, env = process.env) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(sessionId))) throw new Error("La referencia de pago no es válida.");
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {}, env);
}

export function verifyStripeSignature(rawBody, header, webhookSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(header || "").split(",").map((value) => value.split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || !signatures.length) return false;
  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
