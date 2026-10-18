import { describe, expect, it } from 'vitest';
import { REGIONS } from '../../../data/regions.js';
import { SORT_OPTIONS, regionOptions } from './filterOptions.js';

describe('regionOptions', () => {
  it('lists every region with its kanji and live count, after "All regions"', () => {
    const options = regionOptions({ hokkaido: 1, kansai: 2 });
    expect(options).toHaveLength(REGIONS.length + 1);
    expect(options[0]).toEqual({ value: '', label: 'All regions' });
    expect(options.find((o) => o.value === 'hokkaido').label).toBe('Hokkaidō 北海道 · 1');
    expect(options.find((o) => o.value === 'shikoku').label).toBe('Shikoku 四国 · 0');
  });

  it('names options for screen readers without the kanji (an <option> cannot carry lang="ja")', () => {
    const options = regionOptions({ hokkaido: 1, kansai: 2 });
    expect(options.find((o) => o.value === 'hokkaido').ariaLabel).toBe('Hokkaidō, 1 brochure');
    expect(options.find((o) => o.value === 'kansai').ariaLabel).toBe('Kansai, 2 brochures');
    for (const option of options.slice(1)) {
      expect(option.ariaLabel).not.toMatch(/[぀-ヿ㐀-鿿]/);
      // The visible English name stays in the accessible name (label in name).
      expect(option.label.startsWith(option.ariaLabel.split(',')[0])).toBe(true);
    }
  });

  it('offers every sort', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(['featured', 'newest', 'az', 'quickest']);
  });
});
