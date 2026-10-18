/**
 * Seeded randomness for generative cover art. Same seed + salt → same
 * sequence, on every machine, forever — so a brochure's cover never changes
 * between visits.
 */

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
export function hashString(input) {
  let hash = 0x811c9dc5;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG returning [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numbers are used as-is (truncated); anything else is hashed. */
function seedToInt(seed) {
  const n = Number(seed);
  return Number.isFinite(n) ? Math.trunc(n) >>> 0 : hashString(seed);
}

/**
 * A seeded random source with the helpers generators need.
 * `salt` (e.g. the art style) decorrelates styles that share a seed.
 */
export function createRng(seed, salt = '') {
  const next = mulberry32(hashString(salt) ^ Math.imul(seedToInt(seed), 0x9e3779b1));
  return {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + (max - min) * next(),
    /** Integer in [min, max], inclusive. */
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p = 0.5) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}
