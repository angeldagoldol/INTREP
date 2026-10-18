/**
 * Geometry for the drag carousel. The track moves by a negative x offset;
 * snap points are the offsets that line a slide up with the left edge,
 * clamped so the last view never shows empty space.
 */

/**
 * Snap offsets (all ≤ 0) for slides starting at `starts` px inside a track
 * that can travel `maxScroll` px. Duplicates (slides that all fit in the last
 * view) collapse into one final point.
 */
export function snapPoints(starts, maxScroll) {
  const max = Math.max(0, maxScroll || 0);
  const points = [];
  for (const start of starts ?? []) {
    const point = 0 - Math.min(Math.max(start, 0), max); // 0 - x avoids -0
    if (!points.some((p) => Math.abs(p - point) < 1)) points.push(point);
  }
  if (points.length === 0) points.push(0);
  if (max > 0 && Math.abs(points[points.length - 1] + max) >= 1) points.push(-max);
  return points;
}

/** Index of the snap point closest to offset `x`. */
export function nearestIndex(points, x) {
  let best = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (Math.abs(points[i] - x) < Math.abs(points[best] - x)) best = i;
  }
  return best;
}

/**
 * The index the shelf shows while the track moves. A button or key press
 * commits to `target` at once; until the spring lands, `x` is still nearest
 * the old point, so following `x` alone would flick the counter back
 * (02 → 01 → 02) and re-announce it. With no target (drag, fling, resize) the
 * index follows `x`.
 */
export function shelfIndex(points, x, target) {
  if (Number.isInteger(target) && target >= 0 && target < (points?.length ?? 0)) return target;
  return nearestIndex(points ?? [0], x);
}

/** Index of the slide group containing slide `slideIndex` (for focus-follow). */
export function indexForSlide(points, starts, slideIndex) {
  const start = starts?.[slideIndex];
  if (start == null) return 0;
  return nearestIndex(points, -start);
}

/** How far through the track `x` is, 0–1 (1 when nothing can scroll). */
export function trackProgress(x, maxScroll) {
  if (!(maxScroll > 0)) return 1;
  return Math.min(1, Math.max(0, -x / maxScroll));
}
