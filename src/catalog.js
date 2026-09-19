// THE SERVER-SIDE PRICE AUTHORITY.
//
// This is the single most important security boundary in the whole app.
// The browser sends only a product id and a quantity. It never sends a price.
// If you ever let the client supply an amount, a customer can open devtools
// and buy a Land Cruiser for one centavo — the classic e-commerce hole.
//
// Ids match the storefront artifact's own product ids ("<company>:<index>")
// so the two price lists cannot drift apart.
//
// ===========================================================================
// !! THESE PRICES ARE PLACEHOLDERS. REPLACE THEM BEFORE SELLING. !!
//
// They are the artifact's Japanese list prices converted at a flat reference
// rate of JPY 1 = PHP 0.38. That rate is a guess frozen in time, it ignores
// duty, VAT, freight and your margin, and it will be wrong by the time you
// read this. Put YOUR agreed reseller prices here.
// ===========================================================================
//
// Amounts are in Stripe's smallest currency unit. PHP HAS centavos, so these
// are centavos: 22420 is PHP 224.20. (JPY, by contrast, is zero-decimal —
// see src/money.js if you ever switch currency.)

/**
 * mode decides how a product can be bought:
 *   "checkout" — payable online
 *   "enquiry"  — too large for a web checkout, so it goes to a form instead.
 *                Vehicles sit here: a PHP 1.9M Land Cruiser exceeds GCash and
 *                Maya wallet limits by an order of magnitude, and nobody buys
 *                a car through a payment button anyway.
 *
 * @typedef {{id:string, name:string, brand:string, amount:number, sku:string,
 *            active:boolean, mode:"checkout"|"enquiry"}} Product
 */

/** @type {Product[]} */
const PRODUCTS = [
  { id: "toyota:0", name: "Corolla", brand: "Toyota", amount: 121300000, sku: "TOY-COROLLA", active: true, mode: "enquiry" },  // ~PHP 760,000.00  (from JPY 2,000,000)
  { id: "toyota:1", name: "RAV4", brand: "Toyota", amount: 218300000, sku: "TOY-RAV4", active: true, mode: "enquiry" },  // ~PHP 1,254,000.00  (from JPY 3,300,000)
  { id: "toyota:2", name: "Prius", brand: "Toyota", amount: 265000000, sku: "TOY-PRIUS", active: true, mode: "enquiry" },  // ~PHP 1,045,000.00  (from JPY 2,750,000)
  { id: "toyota:3", name: "Land Cruiser", brand: "Toyota", amount: 575800000, sku: "TOY-LAND-CRUISER", active: true, mode: "enquiry" },  // ~PHP 1,976,000.00  (from JPY 5,200,000)
  { id: "toyota:4", name: "bZ4X", brand: "Toyota", amount: 319000000, sku: "TOY-BZ4X", active: true, mode: "enquiry" },  // ~PHP 1,900,000.00  (from JPY 5,000,000)
  { id: "toyota:5", name: "Mirai", brand: "Toyota", amount: 485000000, sku: "TOY-MIRAI", active: true, mode: "enquiry" },  // ~PHP 2,758,800.00  (from JPY 7,260,000)
  { id: "honda:0", name: "N-BOX", brand: "Honda", amount: 95000000, sku: "HON-N-BOX", active: true, mode: "enquiry" },  // ~PHP 627,000.00  (from JPY 1,650,000)
  { id: "honda:1", name: "Civic", brand: "Honda", amount: 160000000, sku: "HON-CIVIC", active: true, mode: "enquiry" },  // ~PHP 1,311,000.00  (from JPY 3,450,000)
  { id: "honda:2", name: "Vezel", brand: "Honda", amount: 155000000, sku: "HON-VEZEL", active: true, mode: "enquiry" },  // ~PHP 1,007,000.00  (from JPY 2,650,000)
  { id: "honda:3", name: "Super Cub", brand: "Honda", amount: 16900000, sku: "HON-SUPER-CUB", active: true, mode: "enquiry" },  // ~PHP 188,100.00  (from JPY 495,000)
  { id: "sony:0", name: "PlayStation 5", brand: "Sony", amount: 4003200, sku: "SON-PLAYSTATION-5", active: true, mode: "checkout" },  // ~PHP 30,392.40  (from JPY 79,980)
  { id: "sony:1", name: "PlayStation 5 Pro", brand: "Sony", amount: 5699000, sku: "SON-PLAYSTATION-5-PRO", active: true, mode: "checkout" },  // ~PHP 45,592.40  (from JPY 119,980)
  { id: "sony:2", name: "DualSense wireless controller", brand: "Sony", amount: 399000, sku: "SON-DUALSENSE-WIRELESS", active: true, mode: "checkout" },  // ~PHP 4,362.40  (from JPY 11,480)
  { id: "sony:3", name: "WH-1000X headphones", brand: "Sony", amount: 1699900, sku: "SON-WH-1000X-HEADPHONE", active: true, mode: "checkout" },  // ~PHP 22,572.00  (from JPY 59,400)
  { id: "sony:4", name: "Alpha \u03b17 series", brand: "Sony", amount: 14499900, sku: "SON-ALPHA-7-SERIES", active: true, mode: "checkout" },  // ~PHP 125,400.00  (from JPY 330,000)
  { id: "sony:6", name: "BRAVIA", brand: "Sony", amount: 5499900, sku: "SON-BRAVIA", active: true, mode: "checkout" },  // ~PHP 57,000.00  (from JPY 150,000)
  { id: "fastretailing:0", name: "HEATTECH", brand: "Uniqlo", amount: 59000, sku: "FAS-HEATTECH", active: true, mode: "checkout" },  // ~PHP 224.20  (from JPY 590)
  { id: "fastretailing:1", name: "Ultra Light Down", brand: "Uniqlo", amount: 399000, sku: "FAS-ULTRA-LIGHT-DOWN", active: true, mode: "checkout" },  // ~PHP 2,276.20  (from JPY 5,990)
  { id: "fastretailing:2", name: "UT", brand: "Uniqlo", amount: 79000, sku: "FAS-UT", active: false, mode: "checkout" },  // parallel import not viable — UT: lands at PHP 711.95 net vs PHP 790 market  // ~PHP 570.00  (from JPY 1,500)
  { id: "fastretailing:3", name: "Fleece", brand: "Uniqlo", amount: 149000, sku: "FAS-FLEECE", active: false, mode: "checkout" },  // parallel import not viable — Fleece: lands at PHP 1,848.26 net vs PHP 1,490 market  // ~PHP 1,516.20  (from JPY 3,990)
  { id: "fastretailing:4", name: "Round Mini Shoulder Bag", brand: "Uniqlo", amount: 99000, sku: "FAS-ROUND-MINI-SHOULDE", active: true, mode: "checkout" },  // ~PHP 570.00  (from JPY 1,500)
  { id: "nissan:0", name: "Sakura", brand: "Nissan", amount: 125000000, sku: "NIS-SAKURA", active: true, mode: "enquiry" },  // ~PHP 988,000.00  (from JPY 2,600,000)
  { id: "nissan:1", name: "Note e-POWER", brand: "Nissan", amount: 135000000, sku: "NIS-NOTE-E-POWER", active: true, mode: "enquiry" },  // ~PHP 885,400.00  (from JPY 2,330,000)
  { id: "nissan:2", name: "Serena", brand: "Nissan", amount: 215000000, sku: "NIS-SERENA", active: true, mode: "enquiry" },  // ~PHP 1,075,400.00  (from JPY 2,830,000)
  { id: "nissan:3", name: "X-Trail", brand: "Nissan", amount: 229000000, sku: "NIS-X-TRAIL", active: true, mode: "enquiry" },  // ~PHP 1,459,200.00  (from JPY 3,840,000)
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id) {
  const p = BY_ID.get(id);
  return p && p.active ? p : null;
}

export function listProducts() {
  return PRODUCTS.filter((p) => p.active);
}

// Two Uniqlo lines are deactivated above. Uniqlo runs its own stores in the
// Philippines and prices below what a parallel import can land at, so those
// two would lose money on every sale. npm run prices:apply refuses them if
// active is flipped back without the landed cost changing.

/** Products that can actually be paid for online. */
export function listPayable() {
  return PRODUCTS.filter((p) => p.active && p.mode === "checkout");
}

/** Products that go through the enquiry form instead. */
export function listEnquiry() {
  return PRODUCTS.filter((p) => p.active && p.mode === "enquiry");
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
    if (product.mode === "enquiry") {
      throw new Error(`${product.name} is not available to buy online — please send an enquiry`);
    }

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
