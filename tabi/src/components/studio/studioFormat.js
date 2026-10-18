/** Small pure helpers for Studio labels and preview layout. */
import { buildBook, positionOfPage } from '../viewer/spreads.js';

export { BLANK } from '../viewer/spreads.js';

/** "just now", "1 min ago", "12 min ago", "at 14:05", or "on Oct 3" for older saves. */
export function relativeSaved(savedAt, now) {
  if (!savedAt) return '';
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const date = new Date(savedAt);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  return sameDay
    ? `at ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)}`
    : `on ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)}`;
}

/**
 * Booklet spreads as [left, right] faces, bound exactly as the published
 * flipbook binds them (viewer/spreads.js): the cover alone on the right,
 * facing pairs, a blank endpaper (BLANK, 見返し) before the back cover when
 * the page count is odd, and the back cover alone on the left. A face is a
 * page index, BLANK or null (nothing there).
 *   6 pages → [[null, 0], [1, 2], [3, 4], [5, null]]
 *   5 pages → [[null, 0], [1, 2], [3, BLANK], [4, null]]
 * Spreads without a real page (a one-page book's endpaper) are left out.
 */
export function buildSpreads(count) {
  if (!(count > 0)) return [];
  return buildBook(count, 'double')
    .spreads.filter((spread) => spread.pages.length > 0)
    .map((spread) => [spread.left, spread.right]);
}

/** Index (into buildSpreads) of the spread that shows `pageIndex`. */
export function spreadOf(pageIndex, count) {
  return count > 0 ? positionOfPage(buildBook(count, 'double'), pageIndex) : 0;
}

/** True for a face that holds a real page (not BLANK, not null). */
export function isPageFace(face) {
  return Number.isInteger(face) && face >= 0;
}

/** The real page indices on a spread, in reading order: [3, BLANK] → [3]. */
export function spreadPages(faces) {
  return (faces ?? []).filter(isPageFace);
}

/**
 * What a number field should store for the text typed so far: a number
 * (clamped to ±limit), '' when the field is empty, or undefined to wait,
 * because the text is a partial number such as "-" or "1e" (`badInput`).
 */
export function numberFromDraft(raw, { badInput = false, limit = 1e12 } = {}) {
  if (badInput) return undefined;
  const text = String(raw ?? '').trim();
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(limit, Math.max(-limit, n));
}

/** Does the typed `draft` already stand for `value`? ("0.50" shows 0.5, "" shows ''.) */
export function draftShows(draft, value) {
  const text = String(draft ?? '').trim();
  const empty = value === '' || value == null;
  if (text === '' || empty) return text === '' && empty;
  return Number(text) === value;
}

/** Keep `value` within `max` characters for counters: { count, over, near }. */
export function charCount(value, max) {
  const count = Array.from(String(value ?? '')).length;
  return { count, over: count > max, near: count > max * 0.85 };
}

/** Normalise a free-typed tag: trimmed, lower-case, single spaces, ≤ 32 chars. */
export function normalizeTag(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^#/, '')
    .slice(0, 32);
}
