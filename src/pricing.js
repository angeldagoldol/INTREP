// Forward pricing: cost -> markup -> VAT -> shelf price.
//
// The direction matters. A shelf price is VAT-INCLUSIVE, so VAT goes on at
// the very end, after margin, and only ever once. Cost from a VAT-registered
// supplier is also VAT-inclusive, so it has to come out before margin is
// applied — otherwise you are earning margin on the government's tax.
//
//   cost_incl  --/1.12-->  cost_net
//   cost_net   --x(1+markup)-->  sell_net
//   sell_net   --x1.12-->  shelf price
//
// MARKUP vs MARGIN, because they are constantly confused:
//   markup = profit / cost          (cost 100, sell 140 -> markup 40%)
//   margin = profit / selling price (cost 100, sell 140 -> margin 28.6%)
// This module takes MARKUP as input and reports margin alongside, so you can
// see both rather than guess which one a number meant.
import { DEFAULT_VAT_RATE } from "./money.js";

/**
 * @param {object} p
 * @param {number} p.costInclVat supplier cost in centavos, VAT inclusive
 * @param {number} p.markupPct   e.g. 12 for 12% on net cost
 * @param {number} [p.vatRate]
 * @param {number} [p.roundTo] snap the shelf price to this multiple of
 *        centavos (default 100 = whole pesos), to NEAREST. Chaining cost,
 *        markup and VAT lands on values like 5,757,999.99, which is not a
 *        price anyone puts on a shelf.
 * @param {number} [p.capAt] the market SRP. Rounding to nearest can nudge the
 *        price a hair over it, and that is absorbed silently. A markup that
 *        genuinely exceeds the market is NOT absorbed — it is left standing so
 *        the caller's guard reports it. Quietly clamping a 25% markup down to
 *        8% would hand back a price that looks fine while earning a third of
 *        what was asked for, and nobody would know.
 *
 * The reported margin is recomputed from the FINAL price, so it is the margin
 * actually earned rather than the one asked for.
 * @returns {{costIncl:number, costNet:number, sellNet:number, vat:number,
 *            price:number, markupPct:number, marginPct:number, profitNet:number}}
 */
export function priceFromCost({ costInclVat, markupPct, vatRate = DEFAULT_VAT_RATE, roundTo = 100, capAt = 0 }) {
  const costIncl = Math.round(Number(costInclVat) || 0);
  const markup = Number(markupPct) / 100;

  if (!Number.isFinite(markup) || markup < 0) throw new Error(`Invalid markup: ${markupPct}`);
  if (costIncl <= 0) throw new Error(`Invalid cost: ${costInclVat}`);

  const costNet = Math.round(costIncl / (1 + vatRate));
  const rawSellNet = Math.round(costNet * (1 + markup));
  const rawPrice = Math.round(rawSellNet * (1 + vatRate));

  // Snap to a clean shelf price, then cap at the market SRP if one is given.
  const step = Math.max(1, Math.round(roundTo));
  let price = Math.max(step, Math.round(rawPrice / step) * step);
  let capped = false;
  // Absorb ONLY a rounding-sized overshoot. Anything larger is a real pricing
  // problem and must surface, not be silently swallowed.
  if (capAt > 0 && price > capAt && price - capAt <= step) {
    price = Math.floor(capAt / step) * step;
    capped = true;
  }

  // Recompute the net from the ROUNDED price, so the parts reconcile to what
  // is actually charged and the margin shown is the margin actually earned.
  const sellNet = Math.round(price / (1 + vatRate));
  const vat = price - sellNet;
  const profitNet = sellNet - costNet;

  return {
    costIncl,
    costNet,
    sellNet,
    vat,
    price,
    markupPct: Number(markupPct),
    requestedMarkupPct: Number(markupPct),
    effectiveMarkupPct: costNet > 0 ? (profitNet / costNet) * 100 : 0,
    marginPct: sellNet > 0 ? (profitNet / sellNet) * 100 : 0,
    profitNet,
    capped,
    exceedsCap: capAt > 0 && price > capAt,
  };
}

/** Markup needed to hit a target shelf price from a given cost. */
export function markupForTargetPrice({ costInclVat, targetPrice, vatRate = DEFAULT_VAT_RATE }) {
  const costNet = Math.round(Number(costInclVat) / (1 + vatRate));
  const sellNet = Math.round(Number(targetPrice) / (1 + vatRate));
  if (costNet <= 0) return null;
  return ((sellNet - costNet) / costNet) * 100;
}
