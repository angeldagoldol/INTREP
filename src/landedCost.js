// Landed cost for parallel imports.
//
// A parallel importer does not buy at wholesale. They buy at RETAIL in the
// source market, then pay to get the goods here. Pricing off a flat markup
// hides that, and hides the cases where the landed cost lands above the price
// the brand's own local stores charge — where every sale loses money.
//
// Japan -> Philippines, per unit:
//
//   JP shelf price (includes 10% Japanese consumption tax)
//     -> less that tax, if exporting tax-free
//     -> converted at YOUR buying rate, not mid-market
//     -> plus freight and handling            = CIF / dutiable value
//     -> plus PH customs duty                 = landed, pre-VAT
//     -> plus 12% PH VAT                      = landed cost
//
// PH import VAT is creditable against output VAT if you are VAT-registered,
// so margin is computed on NET figures throughout.
import { DEFAULT_VAT_RATE } from "./money.js";

/** Japanese consumption tax, refundable on tax-free export purchases. */
export const JP_CONSUMPTION_TAX = 0.10;

/**
 * Consolidator rates, Japan -> Philippines, pesos per chargeable kilo.
 * Sea is ₱80–150/kg at 40–60 days; air courier runs about $25/kg door to door.
 * These sit mid-band; get a quote and replace them.
 */
export const FREIGHT_RATES = {
  sea: 150,     // consolidated sea cargo, 40-60 days
  air: 550,     // air cargo, 7-10 days
  courier: 1400, // DHL/FedEx door to door, 2-4 days
};

/**
 * Volumetric divisors, cm³ per kg. Air carriers bill the GREATER of actual and
 * volumetric weight, which is what bites on apparel: a fleece weighs little
 * and fills a box.
 *
 * Sea is 0 — volumetric is deliberately NOT applied. Consolidator sea rates
 * quoted per kilo are ACTUAL weight (the balikbayan model). Commercial LCL is
 * quoted per CBM on a 1 CBM = 1000 kg revenue ton, and applying that divisor
 * to a per-actual-kg rate charges for the volume twice — which turned a 20.9%
 * margin into a loss when this module first did it.
 *
 * If you are quoted LCL per CBM, convert to a per-kg rate over the revenue
 * ton and set the divisor to 1000 explicitly.
 */
export const VOLUMETRIC_DIVISOR = { air: 6000, courier: 5000, sea: 0 };

/**
 * Chargeable weight for a unit.
 * @param {number} actualKg
 * @param {number} [volumeCm3] packed volume; omit if you only know the weight
 * @param {keyof typeof VOLUMETRIC_DIVISOR} [mode]
 */
export function chargeableWeight(actualKg, volumeCm3 = 0, mode = "air") {
  const divisor = VOLUMETRIC_DIVISOR[mode];
  // A divisor of 0 means this mode bills on actual weight only.
  const volumetric = divisor > 0 && volumeCm3 > 0 ? volumeCm3 / divisor : 0;
  return Math.max(Number(actualKg) || 0, volumetric);
}

/**
 * @param {object} p
 * @param {number} p.jpyPrice      Japanese shelf price in yen (tax included)
 * @param {number} p.fxRate        pesos per yen, YOUR buying rate including spread
 * @param {number} [p.freightPhp]  freight per unit in pesos, if you already
 *        know it. Prefer giving weightKg and a rate so volumetric weight and
 *        the mode are accounted for.
 * @param {number} [p.weightKg]    actual unit weight
 * @param {number} [p.volumeCm3]   packed volume, for volumetric weight
 * @param {string} [p.mode]        "sea" | "air" | "courier"
 * @param {number} [p.ratePerKg]   overrides the mode's rate
 * @param {number} [p.handlingPhp] per-unit share of brokerage, documentation,
 *        warehousing and last-mile delivery. Freight alone understates the
 *        real cost of getting one unit onto a shelf.
 * @param {number} [p.dutyPct]     PH customs duty, e.g. 15 for apparel
 * @param {boolean} [p.taxFree]    true if the Japanese consumption tax is reclaimed
 * @param {number} [p.vatRate]
 * @returns {{jpyNet:number, fob:number, cif:number, duty:number,
 *            landedNet:number, importVat:number, landedIncl:number}}
 *          money values in centavos
 */
export function landedCost({
  jpyPrice, fxRate, freightPhp, weightKg = 0, volumeCm3 = 0, mode = "air",
  ratePerKg = 0, handlingPhp = 0, dutyPct = 15, taxFree = true, vatRate = DEFAULT_VAT_RATE,
}) {
  if (!(jpyPrice > 0)) throw new Error(`Invalid jpyPrice: ${jpyPrice}`);
  if (!(fxRate > 0)) throw new Error(`Invalid fxRate: ${fxRate}`);

  const jpyNet = taxFree ? jpyPrice / (1 + JP_CONSUMPTION_TAX) : jpyPrice;
  const fob = Math.round(jpyNet * fxRate * 100);              // centavos

  // Freight: either given outright, or derived from chargeable weight.
  const rate = ratePerKg > 0 ? ratePerKg : (FREIGHT_RATES[mode] ?? FREIGHT_RATES.air);
  const billedKg = chargeableWeight(weightKg, volumeCm3, mode);
  const freight = freightPhp > 0
    ? Math.round(freightPhp * 100)
    : Math.round(billedKg * rate * 100);
  const handling = Math.round((Number(handlingPhp) || 0) * 100);

  const cif = fob + freight + handling;
  const duty = Math.round(cif * (Number(dutyPct) / 100));
  const landedNet = cif + duty;
  const importVat = Math.round(landedNet * vatRate);

  return {
    jpyNet, fob, freight, handling, cif, duty, landedNet, importVat,
    landedIncl: landedNet + importVat,
    billedKg, ratePerKg: rate, mode,
  };
}

/**
 * Margin actually earned at a given shelf price. Negative means every sale
 * loses money — which is the whole reason this module exists.
 */
export function marginAtPrice({ landedNet, shelfPrice, vatRate = DEFAULT_VAT_RATE }) {
  const sellNet = Math.round(shelfPrice / (1 + vatRate));
  const profit = sellNet - landedNet;
  return {
    sellNet,
    profit,
    marginPct: sellNet > 0 ? (profit / sellNet) * 100 : 0,
    viable: profit > 0,
  };
}

/** Shelf price needed to hit a target margin on landed cost. */
export function priceForMargin({ landedNet, targetMarginPct, vatRate = DEFAULT_VAT_RATE }) {
  const m = Number(targetMarginPct) / 100;
  if (m >= 1) throw new Error("Margin must be below 100%");
  const sellNet = Math.round(landedNet / (1 - m));
  return Math.round(sellNet * (1 + vatRate));
}
