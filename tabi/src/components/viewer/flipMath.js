/**
 * Pure maths behind a page turn. Angles are rotateY degrees around the hinge:
 * 0 = leaf lying on the right, -180 = leaf lying on the left.
 * `dir` is +1 for a forward turn (right → left) and -1 for a backward one.
 */

export const FLAT_RIGHT = 0;
export const FLAT_LEFT = -180;

/** Per-mode feel: how far the pointer must travel and how far a turn must get before it completes. */
export const TURN_FEEL = {
  double: { gain: 1, threshold: 0.5 },
  single: { gain: 1.7, threshold: 0.3 },
};

/** Release faster than this (px/ms) counts as a flick. */
export const FLICK_SPEED = 0.35;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Leaf angle while dragging: the leaf's outer edge follows the pointer.
 * The edge starts at +width (forward) or -width (backward) from the hinge
 * and moves by `dx * gain`; the angle is whatever puts the edge there.
 */
export function dragAngle({ dx, width, dir, gain = 1 }) {
  if (!(width > 0)) return dir > 0 ? FLAT_RIGHT : FLAT_LEFT;
  const start = dir > 0 ? width : -width;
  const edge = clamp(start + dx * gain, -width, width);
  return -toDeg(Math.acos(edge / width));
}

/** 0 → 1: how far a turn in `dir` has travelled at `angle`. */
export function turnProgress(angle, dir) {
  const t = clamp(-angle / 180, 0, 1);
  return dir > 0 ? t : 1 - t;
}

/**
 * Should a released drag complete its turn? A flick in the turn's direction
 * completes it, a flick against it cancels, otherwise distance decides.
 * `velocity` is the pointer's horizontal speed in px/ms (negative = leftwards).
 */
export function shouldCommit({ progress, velocity = 0, dir, threshold = 0.5, flick = FLICK_SPEED }) {
  const along = -velocity * dir; // > 0 when moving the way the page turns
  if (along > flick && progress > 0.04) return true;
  if (along < -flick) return false;
  return progress >= threshold;
}

/** Pointer speed (px/ms) → leaf angular velocity (deg/s) to hand to the settle spring. */
export function angularVelocity(pxPerMs, width, gain = 1) {
  if (!(width > 0)) return 0;
  return clamp(((pxPerMs * 1000 * gain) / width) * 90, -1400, 1400);
}

/**
 * Average horizontal speed (px/ms) over the last `windowMs` of pointer
 * samples ({ x, t }). Older samples are ignored so a pause before release
 * reads as a slow release.
 */
export function releaseVelocity(samples, windowMs = 90) {
  if (!samples?.length) return 0;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/**
 * Stacking layer for a leaf (the leaf paints at 2·layer + 1, its cast
 * shadow at 2·layer). On the right the lowest leaf index is on top; once a
 * leaf passes the spine, the highest index is.
 */
export function leafLayer(index, count, angle) {
  return angle > -90 ? count - index : index + 1;
}

/** CSS perspective distance for a book whose pages are `width` wide. */
export function perspectiveFor(width) {
  return Math.round(width * 8);
}

/**
 * On-screen x of the leaf's outer edge, measured from the hinge. With a
 * `perspective`, the lifted edge is projected from the perspective origin
 * (`originX` from the hinge: 0 at the spine, width / 2 in single mode), so
 * cast shadows line up with what is actually drawn.
 */
export function castEdge(angle, width, { perspective = Infinity, originX = 0, lift = 0 } = {}) {
  const rad = toRad(angle);
  const x = width * Math.cos(rad);
  const z = -width * Math.sin(rad) + lift;
  const scale = Number.isFinite(perspective) && perspective > z ? perspective / (perspective - z) : 1;
  return originX + (x - originX) * scale;
}

/** 0 at rest, 1 when the leaf stands upright: drives lift and cast shadows. */
export function uprightness(angle) {
  return Math.abs(Math.sin(toRad(angle)));
}

/**
 * Which side of the book a point is in, and whether it is in the outer
 * half of that page or near its bottom/top outer corner.
 * `x`, `y` are relative to the book's box; returns
 * { side: 'left'|'right', outer: boolean, corner: boolean }.
 */
export function hitZone({ x, y, pageWidth, pageHeight, mode, corner = 0.16 }) {
  const cornerSize = Math.min(pageWidth, pageHeight) * corner;
  const nearEdgeY = y < cornerSize || y > pageHeight - cornerSize;
  if (mode === 'single') {
    const third = pageWidth / 3;
    if (x < third) return { side: 'left', outer: true, corner: false };
    if (x > pageWidth - third) return { side: 'right', outer: true, corner: x > pageWidth - cornerSize && nearEdgeY };
    return { side: 'right', outer: false, corner: false };
  }
  if (x < pageWidth) {
    return { side: 'left', outer: x < pageWidth / 2, corner: x < cornerSize && nearEdgeY };
  }
  const local = x - pageWidth;
  return { side: 'right', outer: local > pageWidth / 2, corner: local > pageWidth - cornerSize && nearEdgeY };
}
