import { describe, expect, it } from 'vitest';
import { NO_TRACKS, emptyCells, readTracks } from './gridTracks.js';

describe('readTracks', () => {
  it('counts resolved pixel tracks and reads the column width', () => {
    expect(readTracks('312px 312px 312px 312px')).toEqual({ count: 4, width: 312 });
    expect(readTracks(' 170.5px  170.5px ')).toEqual({ count: 2, width: 170.5 });
  });

  it('ignores anything that is not resolved tracks (jsdom, display: block, none)', () => {
    expect(readTracks('repeat(auto-fill, minmax(16.5rem, 1fr))')).toBe(NO_TRACKS);
    expect(readTracks('none')).toBe(NO_TRACKS);
    expect(readTracks('')).toBe(NO_TRACKS);
    expect(readTracks(undefined)).toBe(NO_TRACKS);
  });
});

describe('emptyCells', () => {
  it('is what the last row is missing, or 0 when it is full', () => {
    // 10 built-ins: two empty cells at 4 and at 3 columns, none on 2-column phones.
    expect(emptyCells(10, 4)).toBe(2);
    expect(emptyCells(10, 3)).toBe(2);
    expect(emptyCells(10, 2)).toBe(0);
    expect(emptyCells(13, 4)).toBe(3);
    expect(emptyCells(12, 4)).toBe(0);
    expect(emptyCells(3, 4)).toBe(1);
  });

  it('is 0 without a measured grid or items', () => {
    expect(emptyCells(10, 0)).toBe(0);
    expect(emptyCells(0, 4)).toBe(0);
    expect(emptyCells(Number.NaN, 4)).toBe(0);
  });
});
