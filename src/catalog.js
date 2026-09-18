// THE SERVER-SIDE PRICE AUTHORITY.
//
// This is the single most important security boundary in the whole app.
// The browser sends only a product id and a quantity. It never sends a price.
// If you ever let the client supply an amount, a customer can open devtools
// and buy a Land Cruiser for 1p — this is the classic e-commerce hole.
//
// Amounts are in the smallest currency unit (pence for GBP, cents for USD).
// Replace these with YOUR real reseller SKUs and YOUR agreed prices.

/** @typedef {{id:string, name:string, brand:string, amount:number, sku:string, active:boolean}} Product */

/** @type {Product[]} */
const PRODUCTS = [
  // --- EXAMPLES. Swap for your real inventory before taking a single order. --
  { id: "sony-wh1000x",   name: "Sony WH-1000XM5 Headphones", brand: "Sony",   amount:  32900, sku: "SNY-WH1000XM5", active: true },
  { id: "sony-dualsense", name: "DualSense Wireless Controller", brand: "Sony", amount:   6499, sku: "SNY-DUALSENSE", active: true },
  { id: "fr-heattech",    name: "HEATTECH Crew Neck Long Sleeve", brand: "Uniqlo", amount: 1490, sku: "UNQ-HT-CREW",  active: true },
  { id: "fr-down",        name: "Ultra Light Down Jacket",     brand: "Uniqlo", amount:   7990, sku: "UNQ-ULD-JKT",   active: true },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id) {
  const p = BY_ID.get(id);
  return p && p.active ? p : null;
}

export function listProducts() {
  return PRODUCTS.filter((p) => p.active);
}

/**
 * Turn an untrusted cart from the browser into Stripe line items, pricing
 * every row from this catalog. Throws on anything it does not recognise.
 *
 * @param {unknown} cart expected: [{ id: string, quantity: number }]
 * @param {string} currency
 */
export function buildLineItems(cart, currency) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Cart must be a non-empty array");
  }
  if (cart.length > 50) {
    throw new Error("Too many distinct items in one order");
  }

  const merged = new Map(); // collapse duplicate ids into one line
  for (const row of cart) {
    if (!row || typeof row !== "object") throw new Error("Malformed cart row");

    const product = getProduct(row.id);
    if (!product) throw new Error(`Unknown or unavailable product: ${String(row.id)}`);

    const qty = Number(row.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new Error(`Invalid quantity for ${product.id}: ${String(row.quantity)}`);
    }

    merged.set(product.id, (merged.get(product.id) || 0) + qty);
  }

  return [...merged.entries()].map(([id, quantity]) => {
    const p = getProduct(id);
    return {
      quantity,
      price_data: {
        currency,
        unit_amount: p.amount, // <-- from the server, never the client
        product_data: {
          name: p.name,
          metadata: { sku: p.sku, brand: p.brand, product_id: p.id },
        },
      },
    };
  });
}
