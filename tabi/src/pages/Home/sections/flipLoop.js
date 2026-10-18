/**
 * Page bookkeeping for the looping flip illustration. A spread is named by
 * its left page index `s`: left = s, right = s + 1; turning the right leaf
 * reveals s + 2 (its back) and s + 3 (the next right page). The loop skips
 * the cover, so it starts at 1.
 */
export const FIRST_SPREAD = 1;

/** True when a brochure has enough pages to turn at least once. */
export function canFlip(total) {
  return total >= FIRST_SPREAD + 4;
}

/** The left page after the next turn, wrapping back to the first spread. */
export function nextSpread(s, total) {
  const next = s + 2;
  return next + 3 < total ? next : FIRST_SPREAD;
}

/** Page indices visible around the turning leaf for spread `s`. */
export function spreadPages(s) {
  return { left: s, front: s + 1, back: s + 2, under: s + 3 };
}
