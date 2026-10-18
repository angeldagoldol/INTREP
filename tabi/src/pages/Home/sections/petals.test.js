import { describe, expect, it } from 'vitest';
import { petalField } from './petals.js';

describe('petalField', () => {
  it('is deterministic for a seed', () => {
    expect(petalField(12, 7)).toEqual(petalField(12, 7));
    expect(petalField(12, 7)).not.toEqual(petalField(12, 8));
  });

  it('returns the requested number of petals within sensible ranges', () => {
    const petals = petalField(16, 3);
    expect(petals).toHaveLength(16);
    for (const p of petals) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.size).toBeGreaterThanOrEqual(9);
      expect(p.size).toBeLessThanOrEqual(17);
      expect(p.delay).toBeLessThanOrEqual(0);
      expect(-p.delay).toBeLessThanOrEqual(p.duration);
      expect(Math.abs(p.spin)).toBeGreaterThanOrEqual(160);
      expect([0, 1, 2]).toContain(p.tone);
    }
  });

  it('spreads petals across the width in order', () => {
    const xs = petalField(10, 1).map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('handles zero and fractional counts', () => {
    expect(petalField(0)).toEqual([]);
    expect(petalField(2.9)).toHaveLength(2);
  });
});
