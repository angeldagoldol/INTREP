import { describe, expect, it } from 'vitest';
import { createRng, hashString, mulberry32 } from './rng.js';

const take = (rng, n) => Array.from({ length: n }, () => rng.next());

describe('seeded randomness', () => {
  it('hashes strings stably', () => {
    expect(hashString('seigaiha')).toBe(hashString('seigaiha'));
    expect(hashString('seigaiha')).not.toBe(hashString('asanoha'));
  });

  it('repeats the same sequence for the same seed and salt', () => {
    expect(take(createRng(7, 'fuji'), 20)).toEqual(take(createRng(7, 'fuji'), 20));
    expect(take({ next: mulberry32(42) }, 5)).toEqual(take({ next: mulberry32(42) }, 5));
  });

  it('decorrelates seeds and salts', () => {
    expect(take(createRng(7, 'fuji'), 5)).not.toEqual(take(createRng(8, 'fuji'), 5));
    expect(take(createRng(7, 'fuji'), 5)).not.toEqual(take(createRng(7, 'kumo'), 5));
  });

  it('accepts non-numeric seeds deterministically', () => {
    expect(take(createRng('kyoto'), 3)).toEqual(take(createRng('kyoto'), 3));
  });

  it('keeps helpers within their ranges', () => {
    const rng = createRng(3, 'range');
    for (let i = 0; i < 500; i += 1) {
      const f = rng.range(-2, 5);
      const n = rng.int(1, 6);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(5);
      expect(Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
      expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
      expect([1, -1]).toContain(rng.sign());
    }
  });
});
