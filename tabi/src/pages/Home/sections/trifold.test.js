import { describe, expect, it } from 'vitest';
import { FLAP, flapAngles, openness, ramp, shade } from './trifold.js';

describe('ramp', () => {
  it('maps a range onto 0–1 and clamps', () => {
    expect(ramp(5, 0, 10)).toBe(0.5);
    expect(ramp(-3, 0, 10)).toBe(0);
    expect(ramp(42, 0, 10)).toBe(1);
  });
});

describe('flapAngles', () => {
  it('is fully open when both flaps are open and nothing is folded', () => {
    expect(flapAngles({ left: 1, right: 1 }, 0)).toEqual({ left: FLAP.left.open, right: FLAP.right.open });
  });

  it('is fully closed before the unfold starts', () => {
    expect(flapAngles({ left: 0, right: 0 }, 0)).toEqual({ left: FLAP.left.closed, right: FLAP.right.closed });
  });

  it('tucks the right flap in before the left flap closes over it', () => {
    const early = flapAngles({ left: 1, right: 1 }, 0.4);
    expect(early.right).toBeCloseTo(FLAP.right.open + (FLAP.right.closed - FLAP.right.open) * (0.4 / 0.6));
    expect(early.left).toBe(FLAP.left.open);

    const done = flapAngles({ left: 1, right: 1 }, 1);
    expect(done).toEqual({ left: FLAP.left.closed, right: FLAP.right.closed });
  });

  it('lets a spring overshoot past open, and clamps fold', () => {
    expect(flapAngles({ left: 1.1, right: 1 }, -2).left).toBeLessThan(FLAP.left.open);
    expect(flapAngles({ left: 1, right: 1 }, 7)).toEqual({ left: FLAP.left.closed, right: FLAP.right.closed });
  });

  it('defaults to open when no pose is given', () => {
    expect(flapAngles(undefined)).toEqual({ left: FLAP.left.open, right: FLAP.right.open });
  });
});

describe('openness', () => {
  it('is 1 open, 0 closed', () => {
    expect(openness(flapAngles({ left: 1, right: 1 }, 0))).toBe(1);
    expect(openness(flapAngles({ left: 0, right: 0 }, 0))).toBe(0);
    expect(openness(flapAngles({ left: 1, right: 0 }, 0))).toBe(0.5);
  });
});

describe('shade', () => {
  it('is 0 face-on and 1 edge-on', () => {
    expect(shade(0)).toBe(0);
    expect(shade(90)).toBeCloseTo(1);
    expect(shade(-90)).toBeCloseTo(1);
  });
});
