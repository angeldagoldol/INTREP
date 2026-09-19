// PayMongo client — GCash, Maya and cards for Philippine customers.
//
// Stripe does not reliably support GCash / Maya / QR Ph in the Philippines,
// and that is where most local volume is. PayMongo covers them natively.
//
// No SDK: the surface used here is three HTTP calls, and a dependency that
// wraps them is more risk than it removes.
import crypto from "node:crypto";
import { config } from "./config.js";

const API = "https://api.paymongo.com/v1";

// PayMongo authenticates with HTTP Basic: the secret key is the username and
// the password is empty.
function authHeader(key) {
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

/**
 * Every PayMongo request and response is wrapped in { data: { attributes } }.
 */
async function call(path, { method = "POST", attributes, key } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(key || config.paymongo.secretKey),
    },
    body: attributes ? JSON.stringify({ data: { attributes } }) : undefined,
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`PayMongo returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    // PayMongo errors arrive as { errors: [{ detail, code, source }] }.
    const detail = body?.errors?.map((e) => e.detail).filter(Boolean).join("; ");
    throw new Error(detail || `PayMongo error ${res.status}: ${text.slice(0, 200)}`);
  }
  return body;
}

// PayMongo enforces a minimum per transaction. Below it the API rejects the
// call, so catch it here and say something a customer can act on.
export const MINIMUM_AMOUNT = 10000; // PHP 100.00 in centavos

/**
 * Create a hosted Checkout Session and return its URL.
 *
 * @param {Array<{name:string, amount:number, quantity:number, sku?:string}>} items
 *        amount is PER UNIT, in centavos, and comes from our catalog — never
 *        from the browser.
 */
export async function createCheckoutSession({ items, referenceNumber }) {
  const total = items.reduce((sum, i) => sum + i.amount * i.quantity, 0);
  if (total < MINIMUM_AMOUNT) {
    throw new Error(
      `PayMongo's minimum payment is PHP ${MINIMUM_AMOUNT / 100}. This order is PHP ${(total / 100).toFixed(2)}.`
    );
  }

  const body = await call("/checkout_sessions", {
    attributes: {
      line_items: items.map((i) => ({
        name: i.name,
        amount: i.amount,          // per unit, centavos
        currency: "PHP",           // PayMongo settles in PHP only
        quantity: i.quantity,
      })),
      payment_method_types: config.paymongo.methods,
      success_url: `${config.baseUrl}/success.html?provider=paymongo`,
      cancel_url: `${config.baseUrl}/cancel.html`,
      description: `${config.brand.name} order`,
      reference_number: referenceNumber,
      send_email_receipt: true,
      show_description: true,
      show_line_items: true,
    },
  });

  const url = body?.data?.attributes?.checkout_url;
  if (!url) {
    throw new Error("PayMongo did not return a checkout_url");
  }
  return { url, id: body.data.id, total };
}

/**
 * Verify a webhook signature.
 *
 * The header looks like:  t=<unix>,te=<test sig>,li=<live sig>
 * The signed payload is   `${t}.${rawBody}`  HMAC-SHA256 with the webhook
 * secret, hex encoded. Test and live signatures occupy separate fields and
 * only the one matching the current mode is populated.
 *
 * Two hardenings over the reference implementation, both deliberate:
 *  - timing-safe comparison, not `!=`
 *  - a timestamp tolerance, so a captured request cannot be replayed forever
 *
 * @param {Buffer|string} rawBody the EXACT bytes received
 * @returns {object} the parsed event
 */
export function constructEvent(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader) throw new Error("Missing Paymongo-Signature header");

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(",")
      .map((p) => {
        const idx = p.indexOf("=");
        return idx === -1 ? [p.trim(), ""] : [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
      })
  );

  const timestamp = parts.t;
  // Live takes precedence: only one of the two is ever populated.
  const provided = parts.li || parts.te;
  if (!timestamp || !provided) {
    throw new Error("Malformed Paymongo-Signature header");
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    throw new Error(`Signature timestamp outside tolerance (${age}s)`);
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Signature mismatch");
  }

  return JSON.parse(payload);
}
