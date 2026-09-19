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
 * @param {object} p
 * @param {number} p.jpyPrice      Japanese shelf price in yen (tax included)
 * @param {number} p.fxRate        pesos per yen, YOUR buying rate including spread
 * @param {number} p.freightPhp    freight + handling per unit, in pesos
 * @param {number} [p.dutyPct]     PH customs duty, e.g. 15 for apparel
 * @param {boolean} [p.taxFree]    true if the Japanese consumption tax is reclaimed
 * @param {number} [p.vatRate]
 * @returns {{jpyNet:number, fob:number, cif:number, duty:number,
 *            landedNet:number, importVat:number, landedIncl:number}}
 *          money values in centavos
 */
export function landedCost({
  jpyPrice, fxRate, freightPhp, dutyPct = 15, taxFree = true, vatRate = DEFAULT_VAT_RATE,
}) {
  if (!(jpyPrice > 0)) throw new Error(`Invalid jpyPrice: ${jpyPrice}`);
  if (!(fxRate > 0)) throw new Error(`Invalid fxRate: ${fxRate}`);

  const jpyNet = taxFree ? jpyPrice / (1 + JP_CONSUMPTION_TAX) : jpyPrice;
  const fob = Math.round(jpyNet * fxRate * 100);              // centavos
  const cif = fob + Math.round((Number(freightPhp) || 0) * 100);
  const duty = Math.round(cif * (Number(dutyPct) / 100));
  const landedNet = cif + duty;
  const importVat = Math.round(landedNet * vatRate);

  return { jpyNet, fob, cif, duty, landedNet, importVat, landedIncl: landedNet + importVat };
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
