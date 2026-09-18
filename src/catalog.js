// THE SERVER-SIDE PRICE AUTHORITY.
//
// This is the single most important security boundary in the whole app.
// The browser sends only a product id and a quantity. It never sends a price.
// If you ever let the client supply an amount, a customer can open devtools
// and buy a Land Cruiser for 1 yen — this is the classic e-commerce hole.
//
// Ids match the storefront artifact's own product ids ("<company>:<index>")
// so the two can never drift apart.
//
// Amounts are in Stripe's smallest currency unit. JPY is ZERO-DECIMAL, so
// 2000000 is JPY 2,000,000 — not 20,000. Read src/money.js before changing
// currency, or every charge will be out by a factor of 100.
//
// These are the artifact's listed Japanese prices. Replace them with YOUR
// agreed reseller prices, and set CURRENCY to what you actually charge in.

/** @typedef {{id:string, name:string, brand:string, amount:number, sku:string, active:boolean}} Product */

/** @type {Product[]} */
const PRODUCTS = [
  { id: "toyota:0", name: "Corolla", brand: "Toyota", amount: 2000000, sku: "TOY-COROLLA", active: true },
  { id: "toyota:1", name: "RAV4", brand: "Toyota", amount: 3300000, sku: "TOY-RAV4", active: true },
  { id: "toyota:2", name: "Prius", brand: "Toyota", amount: 2750000, sku: "TOY-PRIUS", active: true },
  { id: "toyota:3", name: "Land Cruiser", brand: "Toyota", amount: 5200000, sku: "TOY-LAND-CRUISER", active: true },
  { id: "toyota:4", name: "bZ4X", brand: "Toyota", amount: 5000000, sku: "TOY-BZ4X", active: true },
  { id: "toyota:5", name: "Mirai", brand: "Toyota", amount: 7260000, sku: "TOY-MIRAI", active: true },
  { id: "honda:0", name: "N-BOX", brand: "Honda", amount: 1650000, sku: "HON-N-BOX", active: true },
  { id: "honda:1", name: "Civic", brand: "Honda", amount: 3450000, sku: "HON-CIVIC", active: true },
  { id: "honda:2", name: "Vezel", brand: "Honda", amount: 2650000, sku: "HON-VEZEL", active: true },
  { id: "honda:3", name: "Super Cub", brand: "Honda", amount: 495000, sku: "HON-SUPER-CUB", active: true },
  { id: "sony:0", name: "PlayStation 5", brand: "Sony", amount: 79980, sku: "SON-PLAYSTATION-5", active: true },
  { id: "sony:1", name: "PlayStation 5 Pro", brand: "Sony", amount: 119980, sku: "SON-PLAYSTATION-5-PRO", active: true },
  { id: "sony:2", name: "DualSense wireless controller", brand: "Sony", amount: 11480, sku: "SON-DUALSENSE-WIRELESS", active: true },
  { id: "sony:3", name: "WH-1000X headphones", brand: "Sony", amount: 59400, sku: "SON-WH-1000X-HEADPHONE", active: true },
  { id: "sony:4", name: "Alpha \u03b17 series", brand: "Sony", amount: 330000, sku: "SON-ALPHA-7-SERIES", active: true },
  { id: "sony:6", name: "BRAVIA", brand: "Sony", amount: 150000, sku: "SON-BRAVIA", active: true },
  { id: "fastretailing:0", name: "HEATTECH", brand: "Uniqlo", amount: 590, sku: "FAS-HEATTECH", active: true },
  { id: "fastretailing:1", name: "Ultra Light Down", brand: "Uniqlo", amount: 5990, sku: "FAS-ULTRA-LIGHT-DOWN", active: true },
  { id: "fastretailing:2", name: "UT", brand: "Uniqlo", amount: 1500, sku: "FAS-UT", active: true },
  { id: "fastretailing:3", name: "Fleece", brand: "Uniqlo", amount: 3990, sku: "FAS-FLEECE", active: true },
  { id: "fastretailing:4", name: "Round Mini Shoulder Bag", brand: "Uniqlo", amount: 1500, sku: "FAS-ROUND-MINI-SHOULDE", active: true },
  { id: "nissan:0", name: "Sakura", brand: "Nissan", amount: 2600000, sku: "NIS-SAKURA", active: true },
  { id: "nissan:1", name: "Note e-POWER", brand: "Nissan", amount: 2330000, sku: "NIS-NOTE-E-POWER", active: true },
  { id: "nissan:2", name: "Serena", brand: "Nissan", amount: 2830000, sku: "NIS-SERENA", active: true },
  { id: "nissan:3", name: "X-Trail", brand: "Nissan", amount: 3840000, sku: "NIS-X-TRAIL", active: true },
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
