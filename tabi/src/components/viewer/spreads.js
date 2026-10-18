/**
 * Spread maths for the flipbook. A book is modelled the way it is bound:
 * a stack of leaves (sheets), each with a front and a back face. The reader's
 * `position` is the number of leaves turned to the left.
 *
 * - double: booklet spreads. The cover sits alone on the right, inner pages
 *   pair up (2–3, 4–5…), the back cover sits alone on the left. A booklet
 *   needs an even number of faces, so an odd page count gets a blank
 *   endpaper (見返し) just before the back cover.
 * - single: one page at a time; every page is a leaf hinged on its left edge
 *   and the last leaf never turns.
 *
 * Faces hold a page index, BLANK (the endpaper) or null (nothing there).
 */
import { pad } from '../../lib/format.js';

export const BLANK = -1;

/** Faces in reading order for a booklet of `count` pages. */
export function bookletFaces(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return [];
  const faces = Array.from({ length: n }, (_, i) => i);
  if (n === 1) faces.push(BLANK);
  else if (n % 2 === 1) faces.splice(n - 1, 0, BLANK);
  return faces;
}

function isPage(face) {
  return Number.isInteger(face) && face >= 0;
}

/**
 * Build the leaves and spreads for a page count.
 * Returns { mode, count, leaves: [{ front, back }], spreads: [{ index, left, right, pages }] }.
 * `spreads[position]` is what the reader sees at that position.
 */
export function buildBook(count, mode = 'double') {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) {
    return { mode, count: 0, leaves: [], spreads: [{ index: 0, left: null, right: null, pages: [] }] };
  }

  if (mode === 'single') {
    const leaves = Array.from({ length: n }, (_, i) => ({ front: i, back: null }));
    const spreads = leaves.map((_, i) => ({ index: i, left: null, right: i, pages: [i] }));
    return { mode, count: n, leaves, spreads };
  }

  const faces = bookletFaces(n);
  const leaves = [];
  for (let i = 0; i < faces.length; i += 2) leaves.push({ front: faces[i], back: faces[i + 1] ?? null });
  const spreads = [];
  for (let s = 0; s <= leaves.length; s += 1) {
    const left = s > 0 ? leaves[s - 1].back : null;
    const right = s < leaves.length ? leaves[s].front : null;
    spreads.push({ index: s, left, right, pages: [left, right].filter(isPage) });
  }
  return { mode: 'double', count: n, leaves, spreads };
}

/** Clamp any value to a valid page index for `count` pages. */
export function clampPage(page, count) {
  const n = Number.parseInt(page, 10);
  if (!Number.isFinite(n) || count <= 0) return 0;
  return Math.min(Math.max(n, 0), count - 1);
}

/** The position (spread index) that shows `page`. */
export function positionOfPage(book, page) {
  const target = clampPage(page, book.count);
  const found = book.spreads.findIndex((spread) => spread.pages.includes(target));
  return found === -1 ? 0 : found;
}

/** The page a position should be remembered by (first real page on it). */
export function pageAtPosition(book, position) {
  const spread = book.spreads[clampPosition(book, position)];
  return spread.pages[0] ?? 0;
}

export function clampPosition(book, position) {
  return Math.min(Math.max(Math.round(Number(position) || 0), 0), book.spreads.length - 1);
}

/** Leaves turned to the left at `position`, and leaves still waiting on the right. */
export function stackDepth(book, position) {
  const left = clampPosition(book, position);
  const right = book.mode === 'single' ? Math.max(0, book.leaves.length - 1 - left) : book.leaves.length - left;
  return { left: book.mode === 'single' ? 0 : left, right };
}

/** "04–05", "01" or "—" for a spread. */
export function spreadLabel(spread) {
  const pages = spread?.pages ?? [];
  if (pages.length === 0) return '—';
  if (pages.length === 1) return pad(pages[0] + 1);
  return `${pad(pages[0] + 1)}–${pad(pages[pages.length - 1] + 1)}`;
}

/** Short name for a control: "Pages 4–5", "Page 1". */
export function spreadName(spread) {
  const pages = spread?.pages ?? [];
  if (pages.length === 0) return 'Blank spread';
  if (pages.length === 1) return `Page ${pages[0] + 1}`;
  return `Pages ${pages[0] + 1}–${pages[pages.length - 1] + 1}`;
}

/** Screen-reader sentence: "Pages 4 and 5 of 11". */
export function spreadAnnouncement(spread, count) {
  const pages = spread?.pages ?? [];
  if (pages.length === 0) return `No pages to show`;
  if (pages.length === 1) return `Page ${pages[0] + 1} of ${count}`;
  return `Pages ${pages[0] + 1} and ${pages[pages.length - 1] + 1} of ${count}`;
}

/**
 * Leaves whose content must be mounted at `position`: the ones showing, and
 * the ones a single turn either way would reveal.
 */
export function contentWindow(book, position) {
  const s = clampPosition(book, position);
  return book.mode === 'single' ? { from: s - 1, to: s + 1 } : { from: s - 2, to: s + 1 };
}
