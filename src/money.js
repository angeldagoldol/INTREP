// Stripe expects amounts in the smallest currency unit. For most currencies
// that is 1/100 of the major unit (pence, cents), but ~15 currencies have no
// minor unit at all — for those, the amount IS the major unit.
//
// Get this wrong for JPY and every charge is out by a factor of 100.
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function isZeroDecimal(currency) {
  return ZERO_DECIMAL.has(String(currency || "").toLowerCase());
}

/** Convert a Stripe smallest-unit amount into major units for display. */
export function toMajorUnits(amountMinor, currency) {
  const n = Number(amountMinor) || 0;
  return isZeroDecimal(currency) ? n : n / 100;
}

export function formatMoney(amountMinor, currency) {
  const cur = String(currency || "gbp").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur })
      .format(toMajorUnits(amountMinor, currency));
  } catch {
    return `${toMajorUnits(amountMinor, currency)} ${cur}`;
  }
}

// ---------------------------------------------------------------------------
// VAT
//
// Philippine retail price tags show what the customer actually pays, so the
// catalog amounts are VAT-INCLUSIVE. VAT is therefore extracted from a price,
// never added on top of one — adding 12% to an SRP both double-counts the tax
// and prices you above the shelf price your competitors charge.
// ---------------------------------------------------------------------------

/** Philippine VAT. Override with VAT_RATE if you ever sell under another regime. */
export const DEFAULT_VAT_RATE = 0.12;

/**
 * Split a VAT-inclusive amount into its net and VAT parts.
 *
 * The net is rounded and the VAT is taken as the remainder, so the two always
 * add back to exactly the amount charged. Rounding each half independently
 * would leave invoices off by a centavo, which BIR-facing paperwork notices.
 *
 * @param {number} amountInclusive smallest currency unit (centavos)
 * @param {number} rate e.g. 0.12
 * @returns {{net:number, vat:number, total:number, rate:number}}
 */
export function splitVat(amountInclusive, rate = DEFAULT_VAT_RATE) {
  const total = Math.round(Number(amountInclusive) || 0);
  if (!rate) return { net: total, vat: 0, total, rate: 0 };
  const net = Math.round(total / (1 + rate));
  return { net, vat: total - net, total, rate };
}

/** VAT payable on a price that does NOT yet include it. Rarely what you want here. */
export function addVat(amountExclusive, rate = DEFAULT_VAT_RATE) {
  const net = Math.round(Number(amountExclusive) || 0);
  const vat = Math.round(net * rate);
  return { net, vat, total: net + vat, rate };
}
