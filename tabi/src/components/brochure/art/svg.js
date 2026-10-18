/**
 * Plain-data SVG descriptors and geometry helpers for the cover-art
 * generators. Generators return trees of `{ t, a, c }` nodes (tag, React
 * props, children) instead of JSX so they stay pure, testable and cheap to
 * memoise; <CoverArt> turns them into elements.
 *
 * Special props understood by the renderer (never written to the DOM):
 *   anim — name of an idle-motion class (drift, slide, spin, float, sway, pulse, breathe)
 *   vars — CSS custom properties for that animation (--dx, --dur, --ox…)
 */

/** Art board: A-series portrait (1 : 1.414). */
export const W = 300;
export const H = 424;

/** Round to one decimal: keeps path strings short and output stable. */
export const r1 = (value) => Math.round(value * 10) / 10;

export function el(t, a = {}, c) {
  return c && c.length ? { t, a, c } : { t, a };
}

export const g = (a, c) => el('g', a, c);

/** [[x, y], …] → "x,y x,y …" for <polygon points>. */
export function pts(list) {
  return list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
}

/** Straight polyline path through points. */
export function linePath(list, closed = false) {
  const d = list.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');
  return closed ? `${d} Z` : d;
}

/**
 * Smooth path through points (Catmull-Rom converted to cubic Béziers).
 * Open paths start at the first point and end at the last.
 */
export function smoothPath(list, closed = false) {
  const n = list.length;
  if (n < 3) return linePath(list, closed);
  const at = (i) => (closed ? list[(i + n) % n] : list[Math.min(n - 1, Math.max(0, i))]);
  let d = `M${r1(list[0][0])} ${r1(list[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

export function polar(cx, cy, radius, angle) {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

/** Evenly sample a cubic Bézier into `steps + 1` points. */
export function sampleCubic(p0, p1, p2, p3, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  });
}

/**
 * A soft, irregular horizon (mountain ridge, wave line) from x = -20 to W + 20,
 * closed down to the bottom of the board.
 */
export function ridgePath(rng, { y, amp, step = 40, bottom = H + 10 }) {
  const points = [];
  for (let x = -20; x <= W + 20; x += step) points.push([x, y + rng.range(-amp, amp)]);
  if (points[points.length - 1][0] < W + 20) points.push([W + 20, y + rng.range(-amp, amp)]);
  const d = smoothPath(points);
  return `${d} L${W + 20} ${bottom} L-20 ${bottom} Z`;
}

/** Count every node in a descriptor tree (used to keep covers light). */
export function countNodes(nodes) {
  return nodes.reduce((sum, node) => sum + 1 + (node.c ? countNodes(node.c) : 0), 0);
}
