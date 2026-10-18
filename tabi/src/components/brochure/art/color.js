/**
 * Small colour toolkit for brochure themes: parse hex, mix, measure WCAG
 * contrast and nudge a colour until it is readable. Brochure pages and cover
 * art derive every tint from the five theme colours with these helpers.
 */

/** Theme used when a brochure omits colours (matches --page-paper / --ink). */
export const DEFAULT_THEME = {
  paper: '#fffdf8',
  ink: '#16140f',
  accent: '#d23a22',
  accent2: '#1d4f7a',
  muted: '#6b6457',
  typeface: 'serif',
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value.trim());
}

/** "#abc" | "#aabbcc" → { r, g, b } (0–255), or null when not a hex colour. */
export function parseHex(value) {
  if (!isHex(value)) return null;
  let hex = value.trim().slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }) {
  const part = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Linear blend: t = 0 → a, t = 1 → b. Invalid input falls back to the other colour. */
export function mix(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return toHex(ca ?? cb ?? { r: 0, g: 0, b: 0 });
  const k = Math.min(1, Math.max(0, t));
  return toHex({ r: ca.r + (cb.r - ca.r) * k, g: ca.g + (cb.g - ca.g) * k, b: ca.b + (cb.b - ca.b) * k });
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(value) {
  const c = parseHex(value);
  if (!c) return 0;
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDark(value) {
  return luminance(value) < 0.18;
}

/** The candidate with the highest contrast against `background`. */
export function readableOn(background, candidates) {
  return candidates.reduce((best, c) => (contrast(c, background) > contrast(best, background) ? c : best));
}

/**
 * Return `color`, blended step by step toward `toward` until it reaches
 * `ratio` against `background` (or `toward` itself if it never does).
 */
export function ensureContrast(color, background, ratio, toward) {
  if (contrast(color, background) >= ratio) return color;
  for (let t = 0.1; t < 1; t += 0.1) {
    const candidate = mix(color, toward, t);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return toHex(parseHex(toward) ?? { r: 0, g: 0, b: 0 });
}

/**
 * Fill gaps in a (possibly user-made) theme with defaults; drop values that
 * are not hex colours so every downstream calculation is safe.
 */
export function normalizeTheme(theme) {
  const source = theme && typeof theme === 'object' ? theme : {};
  const pick = (key) => (isHex(source[key]) ? source[key].trim().toLowerCase() : DEFAULT_THEME[key]);
  const typeface = ['serif', 'sans', 'mono'].includes(source.typeface) ? source.typeface : DEFAULT_THEME.typeface;
  const paper = pick('paper');
  // A custom paper with a default ink could be unreadable: pick a legible ink.
  let ink = pick('ink');
  if (contrast(ink, paper) < 4.5) ink = readableOn(paper, [ink, DEFAULT_THEME.ink, '#f7f3ea']);
  return { paper, ink, accent: pick('accent'), accent2: pick('accent2'), muted: pick('muted'), typeface };
}
