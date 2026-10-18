import { describe, expect, it } from 'vitest';
import {
  angularVelocity,
  castEdge,
  dragAngle,
  hitZone,
  leafLayer,
  perspectiveFor,
  releaseVelocity,
  shouldCommit,
  turnProgress,
  uprightness,
} from './flipMath.js';

describe('dragAngle', () => {
  it('starts flat and follows the edge forward', () => {
    expect(dragAngle({ dx: 0, width: 400, dir: 1 })).toBeCloseTo(0);
    expect(dragAngle({ dx: -400, width: 400, dir: 1 })).toBeCloseTo(-90);
    expect(dragAngle({ dx: -800, width: 400, dir: 1 })).toBeCloseTo(-180);
  });

  it('follows the edge backward from the left', () => {
    expect(dragAngle({ dx: 0, width: 400, dir: -1 })).toBeCloseTo(-180);
    expect(dragAngle({ dx: 400, width: 400, dir: -1 })).toBeCloseTo(-90);
  });

  it('clamps beyond the book and amplifies with gain', () => {
    expect(dragAngle({ dx: 300, width: 400, dir: 1 })).toBeCloseTo(0);
    expect(dragAngle({ dx: -200, width: 400, dir: 1, gain: 2 })).toBeCloseTo(-90);
  });

  it('rests flat when the width is unknown', () => {
    expect(dragAngle({ dx: -50, width: 0, dir: 1 })).toBe(0);
    expect(dragAngle({ dx: 50, width: 0, dir: -1 })).toBe(-180);
  });
});

describe('turnProgress', () => {
  it('measures forward and backward travel', () => {
    expect(turnProgress(-45, 1)).toBeCloseTo(0.25);
    expect(turnProgress(-45, -1)).toBeCloseTo(0.75);
    expect(turnProgress(20, 1)).toBe(0);
  });
});

describe('shouldCommit', () => {
  it('completes past the threshold', () => {
    expect(shouldCommit({ progress: 0.6, dir: 1 })).toBe(true);
    expect(shouldCommit({ progress: 0.4, dir: 1 })).toBe(false);
  });

  it('completes a flick in the turn direction', () => {
    expect(shouldCommit({ progress: 0.1, velocity: -0.8, dir: 1 })).toBe(true);
    expect(shouldCommit({ progress: 0.1, velocity: 0.8, dir: -1 })).toBe(true);
  });

  it('cancels a flick against the turn', () => {
    expect(shouldCommit({ progress: 0.7, velocity: 0.8, dir: 1 })).toBe(false);
  });

  it('ignores a flick that never really started', () => {
    expect(shouldCommit({ progress: 0.01, velocity: -2, dir: 1 })).toBe(false);
  });
});

describe('releaseVelocity', () => {
  it('averages the recent samples only', () => {
    const samples = [
      { x: 0, t: 0 },
      { x: 10, t: 200 },
      { x: 30, t: 240 },
      { x: 60, t: 280 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(50 / 80);
  });

  it('is zero without movement', () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ x: 5, t: 10 }])).toBe(0);
  });
});

describe('angularVelocity', () => {
  it('maps pointer speed to degrees per second and clamps it', () => {
    expect(angularVelocity(-0.4, 400)).toBeCloseTo(-90);
    expect(angularVelocity(-50, 400)).toBe(-1400);
    expect(angularVelocity(1, 0)).toBe(0);
  });
});

describe('leafLayer', () => {
  it('keeps the lowest unturned leaf on top on the right', () => {
    expect(leafLayer(0, 6, 0)).toBeGreaterThan(leafLayer(1, 6, 0));
  });

  it('keeps the latest turned leaf on top on the left', () => {
    expect(leafLayer(3, 6, -180)).toBeGreaterThan(leafLayer(2, 6, -180));
  });
});

describe('castEdge / uprightness', () => {
  it('projects the outer edge', () => {
    expect(castEdge(0, 300)).toBeCloseTo(300);
    expect(castEdge(-90, 300)).toBeCloseTo(0);
    expect(castEdge(-180, 300)).toBeCloseTo(-300);
  });

  it('pushes a lifted edge outwards under perspective', () => {
    const flat = castEdge(-60, 300);
    const projected = castEdge(-60, 300, { perspective: perspectiveFor(300) });
    expect(projected).toBeGreaterThan(flat);
    expect(castEdge(0, 300, { perspective: 1200 })).toBeCloseTo(300);
  });

  it('projects from an off-hinge origin in single mode', () => {
    expect(castEdge(-90, 300, { perspective: 1200, originX: 150 })).toBeLessThan(0);
  });

  it('peaks when the leaf stands upright', () => {
    expect(uprightness(0)).toBeCloseTo(0);
    expect(uprightness(-90)).toBeCloseTo(1);
  });
});

describe('hitZone', () => {
  const size = { pageWidth: 400, pageHeight: 566 };

  it('splits a double spread into pages and outer halves', () => {
    expect(hitZone({ ...size, mode: 'double', x: 700, y: 300 })).toEqual({ side: 'right', outer: true, corner: false });
    expect(hitZone({ ...size, mode: 'double', x: 450, y: 300 })).toEqual({ side: 'right', outer: false, corner: false });
    expect(hitZone({ ...size, mode: 'double', x: 100, y: 300 })).toEqual({ side: 'left', outer: true, corner: false });
  });

  it('detects the outer corners', () => {
    expect(hitZone({ ...size, mode: 'double', x: 790, y: 560 }).corner).toBe(true);
    expect(hitZone({ ...size, mode: 'double', x: 10, y: 5 }).corner).toBe(true);
  });

  it('uses thirds in single mode', () => {
    expect(hitZone({ ...size, mode: 'single', x: 50, y: 300 }).side).toBe('left');
    expect(hitZone({ ...size, mode: 'single', x: 200, y: 300 }).outer).toBe(false);
    expect(hitZone({ ...size, mode: 'single', x: 390, y: 300 })).toEqual({ side: 'right', outer: true, corner: false });
  });
});
