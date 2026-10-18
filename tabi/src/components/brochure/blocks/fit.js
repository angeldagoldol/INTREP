/**
 * Copy fitting for brochure pages. Pages are fixed layouts measured in cqw,
 * but their text is real (and user-made text can be any length), so blocks
 * mark the regions that take up the slack with `data-fit` and size their type
 * with `calc(<size> * var(--fit, 1))`. After layout, BrochurePage shrinks each
 * region's --fit just enough that nothing overflows — text is never clipped
 * or faded out. Because every size is in cqw, the factor found at one page
 * width holds at any other (a thumbnail and the reader agree).
 *
 *   <div className={styles.copy} data-fit>…</div>          .copy { font-size: calc(2.4cqw * var(--fit, 1)); }
 *   <div data-fit data-fit-min="0.7">…</div>               a region-specific floor
 *   <div data-fit="both">…</div>                            also fit sideways (multi-column copy)
 *
 * Regions are measured vertically by default, so a band that deliberately
 * reaches into the margin (a tinted row) never reads as overflow.
 */

/** Smallest scale a region shrinks to before it gives up (and is flagged data-overflow). */
export const FIT_MIN = 0.6;

/**
 * Does `el`'s content overflow its box? `axis` 'y' (default) checks the
 * height only, 'both' the width too. scrollHeight is rounded to whole pixels,
 * so it gets a pixel of slack (rows that share out the height exactly can sum
 * to a fraction over); on a thumbnail a pixel is a whole line, so the bottom of
 * the last child is also compared, to the sub-pixel.
 */
export function overflows(el, axis = 'y') {
  if (el.scrollHeight > el.clientHeight + 1) return true;
  if (axis === 'both' && el.scrollWidth > el.clientWidth + 1) return true;
  return lastChildBottom(el) > contentBottom(el) + 0.5;
}

const px = (value) => Number.parseFloat(value) || 0;

/** Bottom edge of `el`'s content box, in viewport px (fractional). */
function contentBottom(el) {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().bottom - px(style.borderBottomWidth) - px(style.paddingBottom);
}

/** The lowest margin edge among `el`'s children in flow (−Infinity when none); positioned
 *  ornaments (a printer's colour bar in the margin) do not count. */
function lastChildBottom(el) {
  let bottom = -Infinity;
  for (const child of el.children) {
    const style = getComputedStyle(child);
    if (style.position === 'absolute' || style.position === 'fixed') continue;
    const rect = child.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom + px(style.marginBottom));
  }
  return bottom;
}

/**
 * The largest --fit in [min, 1] at which `el` no longer overflows, found by
 * bisection (each probe sets the variable and reads layout). Leaves --fit set
 * to the result and returns it; null for an element with no box (hidden or not
 * laid out yet). When even `min` overflows, returns `min` and marks the element
 * `data-overflow` so the playground audit can report it.
 * `measure(el)` decides what counts as overflow (default: overflows()).
 */
export function fitElement(el, { min = FIT_MIN, steps = 6, axis = 'y', measure = (node) => overflows(node, axis) } = {}) {
  if (!el || (el.clientWidth === 0 && el.clientHeight === 0)) return null;
  const set = (value) => el.style.setProperty('--fit', String(value));
  el.removeAttribute('data-overflow');
  set(1);
  if (!measure(el)) {
    el.style.removeProperty('--fit');
    return 1;
  }
  set(min);
  if (measure(el)) {
    el.setAttribute('data-overflow', '');
    return min;
  }
  let lo = min;
  let hi = 1;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    set(mid);
    if (measure(el)) hi = mid;
    else lo = mid;
  }
  const fit = Math.floor(lo * 1000) / 1000;
  set(fit);
  return fit;
}

/** Floor for one region: its data-fit-min (0.3–1), else `min`. */
export function regionMin(el, min = FIT_MIN) {
  const own = Number.parseFloat(el.getAttribute?.('data-fit-min') ?? '');
  return Number.isFinite(own) && own >= 0.3 && own <= 1 ? own : min;
}

/**
 * Fit every [data-fit] region inside `root`, in document order (outer
 * regions before the ones they contain). Returns the fit of each region.
 * While it measures, `root` carries data-fitting: the page's CSS switches off
 * transforms inside the regions then, so an entrance in flight (a line still
 * rising into place, a seal still stamping) never reads as overflow.
 */
export function fitRegions(root, options = {}) {
  if (!root?.querySelectorAll) return [];
  const regions = [...root.querySelectorAll('[data-fit]')];
  if (!regions.length) return [];
  root.setAttribute('data-fitting', '');
  try {
    return regions.map((el) => fitElement(el, { ...options, min: regionMin(el, options.min), axis: el.getAttribute('data-fit') === 'both' ? 'both' : 'y' }));
  } finally {
    root.removeAttribute('data-fitting');
  }
}
