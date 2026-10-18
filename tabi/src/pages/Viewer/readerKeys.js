/**
 * The reader's window-level shortcuts, and when they apply. Pure helpers,
 * so the rules are testable without a browser.
 *
 * Zoom keys are characters, not physical key codes, so they follow the
 * visitor's keyboard layout: "+" is Shift+; on a Japanese (JIS) keyboard
 * and has its own key on a German one, and the number pad sends the same
 * characters.
 */
export const READER_KEYS = {
  next: ['ArrowRight'],
  prev: ['ArrowLeft'],
  pageNext: ['PageDown'],
  pagePrev: ['PageUp'],
  first: ['Home'],
  last: ['End'],
  zoomIn: ['+', '='],
  zoomOut: ['-'],
  zoomReset: ['0'],
};

/** IntersectionObserver thresholds fine enough for `isMostlyVisible`. */
export const VISIBILITY_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Is the reader in view enough to own the keyboard? At least half of it is
 * on screen — or, when it is taller than the viewport, it fills at least
 * half of the viewport. Heights in CSS px.
 */
export function isMostlyVisible({ visible, height, viewport }) {
  if (!(visible > 0)) return false;
  const reference = Math.min(height > 0 ? height : Infinity, viewport > 0 ? viewport : Infinity);
  return Number.isFinite(reference) ? visible >= reference * 0.5 : true;
}

/**
 * PageUp/PageDown/Home/End scroll the document by default. The reader takes
 * them only while focus is in the reader or on something that contains it
 * (the body, <main> after a route change); focus elsewhere on the page —
 * the About section, More like this — keeps the native scrolling.
 */
export function ownsPageKeys(target, reader) {
  if (!reader || !target || typeof target.contains !== 'function') return false;
  return reader.contains(target) || target.contains(reader);
}
