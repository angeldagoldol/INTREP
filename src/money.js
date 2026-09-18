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
