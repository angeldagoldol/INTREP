/**
 * A deterministic field of falling sakura petals. Same seed, same sky — so
 * the hero renders identically on every load and in tests.
 */

/** mulberry32: tiny, fast, good-enough PRNG for decoration. */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits = 1) => Number(value.toFixed(digits));

/**
 * `count` petals spread evenly across the width (with jitter). Every value is
 * ready for CSS custom properties:
 * x (% of width) · size (px) · duration (s) · delay (s, negative so the sky is
 * already full on load) · drift (% of width) · spin (deg) · sway (s) · tone (0–2).
 */
export function petalField(count, seed = 1) {
  const random = createRandom(seed);
  const between = (min, max) => min + (max - min) * random();
  const total = Math.max(0, Math.floor(count));

  return Array.from({ length: total }, (_, i) => {
    const duration = between(12, 21);
    return {
      id: i,
      x: round(((i + random()) / total) * 100),
      size: round(between(9, 17)),
      duration: round(duration, 2),
      delay: round(-between(0, duration), 2),
      drift: round(between(-14, 24)),
      spin: Math.round(between(160, 520)) * (random() < 0.5 ? -1 : 1),
      sway: round(between(2.2, 4.2), 2),
      tone: Math.floor(random() * 3),
    };
  });
}
