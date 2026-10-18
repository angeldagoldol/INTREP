/** Short random id, e.g. createId('pg') -> "pg_k3j9x2ab". */
export function createId(prefix = 'id') {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
}

const SLUG_LENGTH = 64;

/**
 * URL-safe slug that keeps every script, not just Latin:
 * "Hello, Wörld!" -> "hello-world", "Tōhoku" -> "tohoku", "京都の秋" -> "京都の秋".
 * Latin accents are folded, width variants unified (ＫＹＯＴＯ -> kyoto) and
 * kana keep their voicing marks; anything that is not a letter, mark or digit
 * becomes a hyphen. Capped at 64 characters (never splitting a character).
 */
export function slugify(input) {
  const slug = String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return Array.from(slug).slice(0, SLUG_LENGTH).join('').replace(/-+$/, '');
}

/**
 * Make `base` unique against a set/array of taken slugs by appending -2, -3…
 * Titles with nothing to spell (only emoji or punctuation) become "untitled".
 */
export function uniqueSlug(base, taken) {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const root = slugify(base) || 'untitled';
  if (!takenSet.has(root)) return root;
  let n = 2;
  while (takenSet.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
