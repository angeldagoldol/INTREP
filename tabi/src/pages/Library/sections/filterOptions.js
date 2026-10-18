import { REGIONS } from '../../../data/regions.js';
import { SORTS } from '../filterBrochures.js';

const brochures = (n) => `${n} ${n === 1 ? 'brochure' : 'brochures'}`;

/**
 * Region <option>s with live counts. The visible label keeps the kanji
 * ("Hokkaidō 北海道 · 1"), but an <option> cannot mark it lang="ja", so
 * `ariaLabel` gives screen readers the English name and the count instead.
 */
export function regionOptions(counts = {}) {
  return [
    { value: '', label: 'All regions' },
    ...REGIONS.map((r) => {
      const n = counts[r.id] ?? 0;
      return { value: r.id, label: `${r.label} ${r.jp} · ${n}`, ariaLabel: `${r.label}, ${brochures(n)}` };
    }),
  ];
}

export const SORT_OPTIONS = SORTS.map((s) => ({ value: s.id, label: s.label }));
