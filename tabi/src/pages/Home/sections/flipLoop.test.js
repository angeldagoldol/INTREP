import { describe, expect, it } from 'vitest';
import { FIRST_SPREAD, canFlip, nextSpread, spreadPages } from './flipLoop.js';

describe('flipLoop', () => {
  it('needs five pages to turn once', () => {
    expect(canFlip(4)).toBe(false);
    expect(canFlip(5)).toBe(true);
  });

  it('advances two pages at a time and wraps before running out', () => {
    const seen = [FIRST_SPREAD];
    for (let i = 0; i < 5; i += 1) seen.push(nextSpread(seen[seen.length - 1], 11));
    expect(seen).toEqual([1, 3, 5, 7, 1, 3]);
  });

  it('never points past the last page', () => {
    for (let total = 5; total < 20; total += 1) {
      let s = FIRST_SPREAD;
      for (let i = 0; i < 12; i += 1) {
        expect(spreadPages(s).under).toBeLessThan(total);
        s = nextSpread(s, total);
      }
    }
  });

  it('names the pages around the leaf', () => {
    expect(spreadPages(3)).toEqual({ left: 3, front: 4, back: 5, under: 6 });
  });
});
