/**
 * Placement for the Nostalgic Japan photo mosaic (Nostalgic.jsx). Pure.
 *
 * Wide screens: a 12-column grid of equal rows. The lead photograph stands
 * tall on the left (four rows), the next four fill in beside it, and a sixth
 * and seventh make a wide bottom row. Fewer photographs get fewer, larger
 * frames. Phones: two columns, the lead across both (two rows tall), the
 * rest in pairs, and an odd last one across both.
 */

/** The lead and four around it: the frame every larger mosaic builds on. */
const FIVE = [
  ['1 / 6', '1 / 5'],
  ['6 / 10', '1 / 3'],
  ['10 / 13', '1 / 3'],
  ['6 / 9', '3 / 5'],
  ['9 / 13', '3 / 5'],
];

/** [grid-column, grid-row] per photo, by count. */
const LAYOUTS = {
  1: [['1 / 13', '1 / 5']],
  2: [
    ['1 / 8', '1 / 5'],
    ['8 / 13', '1 / 5'],
  ],
  3: [
    ['1 / 7', '1 / 5'],
    ['7 / 13', '1 / 3'],
    ['7 / 13', '3 / 5'],
  ],
  4: [
    ['1 / 6', '1 / 5'],
    ['6 / 13', '1 / 3'],
    ['6 / 9', '3 / 5'],
    ['9 / 13', '3 / 5'],
  ],
  5: FIVE,
  6: [...FIVE, ['1 / 13', '5 / 7']],
  7: [...FIVE, ['1 / 8', '5 / 7'], ['8 / 13', '5 / 7']],
};

/** The most photographs the mosaic places. */
export const MOSAIC_MAX = 7;

/**
 * Where each of `count` photographs goes:
 *   mosaicLayout(3) → [{ col: '1 / 7', row: '1 / 5', phone: 'lead' }, { col: '7 / 13', row: '1 / 3', phone: 'tile' }, …]
 * `col`/`row` are wide-screen grid lines; `phone` is 'lead' | 'tile' | 'wide'.
 * Counts above MOSAIC_MAX are capped; 0 or less gives [].
 */
export function mosaicLayout(count) {
  const n = Math.min(MOSAIC_MAX, Math.max(0, Math.floor(Number(count) || 0)));
  if (!n) return [];
  return LAYOUTS[n].map(([col, row], i) => ({
    col,
    row,
    phone: i === 0 ? 'lead' : i === n - 1 && (n - 1) % 2 === 1 ? 'wide' : 'tile',
  }));
}

/**
 * A `sizes` guess for srcset from a wide-screen column span ("6 / 10" → 4 of
 * 12 columns), so each frame asks for about the width it is drawn at.
 */
export function mosaicSizes({ col, phone }) {
  const [from, to] = String(col).split('/').map((n) => Number.parseInt(n, 10));
  const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from) : 12;
  const desktop = Math.round((span / 12) * 100);
  return `(min-width: 761px) ${desktop}vw, ${phone === 'tile' ? 50 : 100}vw`;
}
