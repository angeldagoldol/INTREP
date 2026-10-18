/**
 * Double-page photo spreads (見開き). A `photo` page with `span: 'left'` and
 * the `span: 'right'` page right after it show ONE wide photograph across the
 * flipbook's gutter. That only works where the booklet binds them as facing
 * pages, so this module knows the booklet's binding (the same one as
 * components/viewer/spreads.js — tested to agree):
 *
 * - the cover (page 1) sits alone on the right;
 * - then pages pair up: 2–3, 4–5, 6–7… (indices 1–2, 3–4…), the even page
 *   number on the left;
 * - with an odd page count a blank endpaper goes in before the back cover,
 *   which then sits alone on the left.
 *
 * So a left half must sit at an odd index (an even page number), followed
 * immediately by its right half showing the same photo, and neither may be
 * the back-cover slot. Pure. This module is what the page renderer needs (a
 * misplaced half is drawn as a page of its own); the validator and the
 * editing helpers — insertion, moves, the automatic line-up — are in
 * photoSpreadEdits.js (brochures.test.js, the Studio, the publish check).
 */

export const SPAN_SIDES = ['left', 'right'];

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const photoOf = (page) => (typeof page?.photo === 'string' ? page.photo.trim() : '');

/** 'left' | 'right' for a photo page that is half of a spread, else null. */
export function spanOf(page) {
  if (!isRecord(page) || page.type !== 'photo') return null;
  return page.span === 'left' || page.span === 'right' ? page.span : null;
}

/**
 * Where page `index` of `count` lands in the bound booklet (its face): the
 * same as its index, except the back cover of an odd-length booklet, which
 * moves one on to make room for the endpaper.
 */
export function bookletFace(index, count) {
  return count > 1 && count % 2 === 1 && index === count - 1 ? count : index;
}

/** 'left' | 'right' — which side of a spread page `index` of `count` is printed on. */
export function sideOfPage(index, count) {
  const face = bookletFace(index, count);
  return face > 0 && face % 2 === 1 ? 'left' : 'right';
}

/** The pages that face each other: true when `left` (index) is a left page and `left + 1` its facing right page. */
export function facingPair(left, count) {
  if (!Number.isInteger(left) || left < 1 || left + 1 >= count) return false;
  const a = bookletFace(left, count);
  const b = bookletFace(left + 1, count);
  return a % 2 === 1 && b === a + 1;
}

/**
 * Index of the other half of the spread page `index` belongs to, when the two
 * are placed correctly (facing pages, opposite halves, the same photo); else -1.
 * A page that is not a spread half is -1 too.
 */
export function spreadPartner(pages, index) {
  const list = Array.isArray(pages) ? pages : [];
  const span = spanOf(list[index]);
  if (!span) return -1;
  const left = span === 'left' ? index : index - 1;
  const other = span === 'left' ? index + 1 : index - 1;
  if (spanOf(list[left]) !== 'left' || spanOf(list[left + 1]) !== 'right') return -1;
  if (!facingPair(left, list.length)) return -1;
  if (photoOf(list[left]) !== photoOf(list[left + 1])) return -1;
  return other;
}

/** The other half of page `index`'s correctly placed spread (a page object), or null. */
export function spreadPartnerPage(pages, index) {
  const at = spreadPartner(pages, index);
  return at === -1 ? null : pages[at];
}

/** True when page `index` is half of a correctly placed spread. */
export function isPairedSpread(pages, index) {
  return spreadPartner(pages, index) !== -1;
}
