/**
 * Pose maths for the hero's tri-fold brochure (a "roll fold": the right flap
 * tucks in first, the left flap closes over it and carries the cover).
 *
 * Angles are CSS rotateY degrees. Each flap is hinged on the middle panel:
 * the left flap at its right edge (positive angles swing it toward the
 * viewer), the right flap at its left edge (negative angles do).
 */
export const FLAP = {
  left: { open: 22, closed: 178 },
  right: { open: -22, closed: -179 },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** 0 → 1 as `v` travels from `from` to `to`, clamped. */
export function ramp(v, from, to) {
  return clamp01((v - from) / (to - from));
}

/**
 * Flap angles for a given pose.
 * - `open.left` / `open.right`: 0 (closed) → 1 (open); springs may overshoot 1.
 * - `fold`: 0 → 1 as the hero scrolls away. The right flap tucks in during the
 *   first 60 % and the left flap closes over it during the last 60 %.
 */
export function flapAngles(open, fold = 0) {
  const f = clamp01(fold);
  const left = (open?.left ?? 1) * (1 - ramp(f, 0.4, 1));
  const right = (open?.right ?? 1) * (1 - ramp(f, 0, 0.6));
  return {
    left: lerp(FLAP.left.closed, FLAP.left.open, left),
    right: lerp(FLAP.right.closed, FLAP.right.open, right),
  };
}

/** How open the sheet is overall (0 closed → 1 open), for shadows and lighting. */
export function openness(angles) {
  const left = 1 - ramp(angles.left, FLAP.left.open, FLAP.left.closed);
  const right = 1 - ramp(-angles.right, -FLAP.right.open, -FLAP.right.closed);
  return (left + right) / 2;
}

/** Shade (0–1) for a face turned `angle` degrees away from the viewer's plane. */
export function shade(angle) {
  return Math.abs(Math.sin((angle * Math.PI) / 180));
}
