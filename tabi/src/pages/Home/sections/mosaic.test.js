// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MOSAIC_MAX, mosaicLayout, mosaicSizes } from './mosaic.js';

/** Grid cells a placement covers on the 12-column grid. */
function cells({ col, row }) {
  const [c0, c1] = col.split('/').map(Number);
  const [r0, r1] = row.split('/').map(Number);
  const out = [];
  for (let r = r0; r < r1; r += 1) for (let c = c0; c < c1; c += 1) out.push(`${r}:${c}`);
  return out;
}

describe('mosaicLayout', () => {
  it.each(Array.from({ length: MOSAIC_MAX }, (_, i) => i + 1))('places %i photographs without gaps or overlaps', (n) => {
    const slots = mosaicLayout(n);
    expect(slots).toHaveLength(n);
    const all = slots.flatMap(cells);
    expect(new Set(all).size).toBe(all.length);
    const rows = Math.max(...slots.map((s) => Number(s.row.split('/')[1]))) - 1;
    expect(all).toHaveLength(rows * 12);
  });

  it('gives the lead photograph the tallest frame, and the largest beside it', () => {
    const rows = ({ row }) => row.split('/').map(Number).reduce((a, b) => b - a);
    for (let n = 2; n <= MOSAIC_MAX; n += 1) {
      const [lead, ...rest] = mosaicLayout(n);
      for (const slot of rest) expect(rows(lead)).toBeGreaterThanOrEqual(rows(slot));
      // Beside it (its rows), nothing is larger; a 6th and 7th make a wide bottom row.
      const besides = rest.filter((s) => Number(s.row.split('/')[0]) < Number(lead.row.split('/')[1]));
      for (const slot of besides) expect(cells(lead).length).toBeGreaterThanOrEqual(cells(slot).length);
    }
  });

  it('pairs the rest on phones, an odd last one across both columns', () => {
    expect(mosaicLayout(4).map((s) => s.phone)).toEqual(['lead', 'tile', 'tile', 'wide']);
    expect(mosaicLayout(5).map((s) => s.phone)).toEqual(['lead', 'tile', 'tile', 'tile', 'tile']);
    expect(mosaicLayout(2).map((s) => s.phone)).toEqual(['lead', 'wide']);
  });

  it('handles nothing, junk and too many', () => {
    expect(mosaicLayout(0)).toEqual([]);
    expect(mosaicLayout(-3)).toEqual([]);
    expect(mosaicLayout('x')).toEqual([]);
    expect(mosaicLayout(40)).toHaveLength(MOSAIC_MAX);
  });

  it('sizes srcset to the frame', () => {
    expect(mosaicSizes({ col: '1 / 6', phone: 'lead' })).toBe('(min-width: 761px) 42vw, 100vw');
    expect(mosaicSizes({ col: '10 / 13', phone: 'tile' })).toBe('(min-width: 761px) 25vw, 50vw');
  });
});
