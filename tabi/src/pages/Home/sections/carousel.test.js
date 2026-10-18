import { describe, expect, it } from 'vitest';
import { indexForSlide, nearestIndex, shelfIndex, snapPoints, trackProgress } from './carousel.js';

describe('snapPoints', () => {
  it('lines slides up with the left edge and clamps to the end of the track', () => {
    expect(snapPoints([0, 300, 600, 900], 700)).toEqual([0, -300, -600, -700]);
  });

  it('collapses slides that share the final view', () => {
    expect(snapPoints([0, 300, 600, 900, 1200], 650)).toEqual([0, -300, -600, -650]);
  });

  it('returns a single point when nothing scrolls', () => {
    expect(snapPoints([0, 300], 0)).toEqual([0]);
    expect(snapPoints([], 200)).toEqual([0, -200]);
    expect(snapPoints(undefined, undefined)).toEqual([0]);
  });
});

describe('nearestIndex', () => {
  it('finds the closest snap point', () => {
    const points = [0, -300, -600];
    expect(nearestIndex(points, -10)).toBe(0);
    expect(nearestIndex(points, -420)).toBe(1);
    expect(nearestIndex(points, -9999)).toBe(2);
    expect(nearestIndex(points, 50)).toBe(0);
  });
});

describe('indexForSlide', () => {
  it('maps a slide to the snap point that reveals it', () => {
    const starts = [0, 300, 600, 900];
    const points = snapPoints(starts, 650);
    expect(indexForSlide(points, starts, 1)).toBe(1);
    expect(indexForSlide(points, starts, 3)).toBe(points.length - 1);
    expect(indexForSlide(points, starts, 99)).toBe(0);
  });
});

describe('trackProgress', () => {
  it('is 0 at the start, 1 at the end and clamped', () => {
    expect(trackProgress(0, 600)).toBe(0);
    expect(trackProgress(-300, 600)).toBe(0.5);
    expect(trackProgress(-900, 600)).toBe(1);
    expect(trackProgress(40, 600)).toBe(0);
    expect(trackProgress(0, 0)).toBe(1);
  });
});

describe('shelfIndex', () => {
  const points = [0, -300, -600, -700];

  it('holds the committed target while the spring is still near the old point (no 02 → 01 → 02 flicker)', () => {
    // Next from 1 → 2: the first frames of the spring are still nearest point 0.
    const frames = [0, -12, -60, -140, -220, -290, -300];
    expect(frames.map((x) => shelfIndex(points, x, 1))).toEqual([1, 1, 1, 1, 1, 1, 1]);
    // Without a target the same frames would flick back to the old index.
    expect(frames.map((x) => nearestIndex(points, x))).toContain(0);
  });

  it('follows x when nothing is pending (dragging) and ignores an out-of-range target', () => {
    expect(shelfIndex(points, -420, null)).toBe(1);
    expect(shelfIndex(points, -680, undefined)).toBe(3);
    expect(shelfIndex(points, -10, 9)).toBe(0);
    expect(shelfIndex(undefined, 0, null)).toBe(0);
  });
});
