const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });
const numberFormatter = new Intl.NumberFormat('en');

export function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

export function formatNumber(value) {
  return numberFormatter.format(value);
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Zero-padded page counter: 3 -> "03". */
export function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

// Pragmatic, not RFC 5322: something@something.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Plausible email address (trimmed, at most 254 characters). Used by every form. */
export function isEmail(value) {
  const email = String(value ?? '').trim();
  return email.length <= 254 && EMAIL.test(email);
}

/**
 * The characters a hanko seal carries: the first two of a Japanese title,
 * ignoring 中黒 (・) and spaces, or 旅 when there are none. 広島・宮島 → 広島.
 */
export function sealChars(titleJp) {
  const chars = Array.from(String(titleJp ?? '').replace(/[・\s]/g, ''));
  return chars.length ? chars.slice(0, 2).join('') : '旅';
}

/** Page fields that hold ids, enums or art names rather than words to read. */
const NON_TEXT_KEYS = new Set(['id', 'type', 'icon', 'art', 'seed', 'highlight']);
/** Kanji and kana: Japanese is read by the character, not by space-separated word. */
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const WORDS_PER_MINUTE = 220;
const CJK_CHARS_PER_MINUTE = 500;

/** Every string in the pages' content fields, in order. */
function collectText(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) if (!NON_TEXT_KEYS.has(key)) collectText(item, out);
  }
  return out;
}

/**
 * Roughly estimate reading time from a brochure's page copy: Latin-script
 * words at ~220 a minute plus Japanese characters at ~500 a minute.
 */
export function estimateReadMinutes(brochure) {
  const text = collectText(brochure?.pages ?? []).join(' ');
  const cjkChars = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE + cjkChars / CJK_CHARS_PER_MINUTE));
}
