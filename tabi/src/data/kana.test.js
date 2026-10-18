import { describe, expect, it } from 'vitest';
import { BROCHURES } from './brochures.js';
import { CATEGORIES } from './categories.js';
import { brochureKana } from './kana.js';
import { REGIONS } from './regions.js';
import { SEASONS } from './seasons.js';

const HIRAGANA = /^[ぁ-ゟー ]+$/u;

describe('kana readings', () => {
  it('every built-in brochure, region, category and season has a hiragana reading', () => {
    for (const b of BROCHURES) expect(b.titleKana, b.slug).toMatch(HIRAGANA);
    for (const table of [REGIONS, CATEGORIES, SEASONS]) {
      for (const entry of table) expect(entry.kana, entry.id).toMatch(HIRAGANA);
    }
  });

  it('joins the title, region, category and season readings', () => {
    const kyoto = BROCHURES.find((b) => b.slug === 'kyoto-thousand-gates');
    const kana = brochureKana(kyoto);
    expect(kana.startsWith('きょうと かんさい じしゃ')).toBe(true);
    for (const id of kyoto.seasons) expect(kana).toContain(SEASONS.find((s) => s.id === id).kana);
  });

  it('ignores a user brochure’s copied title reading and tolerates odd data', () => {
    const remix = { source: 'user', titleKana: 'きょうと', region: 'kansai', category: 'food', seasons: ['__proto__', 'spring', 7] };
    expect(brochureKana(remix)).toBe('かんさい しょく たべもの はる');
    expect(brochureKana({ region: 'constructor', category: 'toString' })).toBe('');
    expect(brochureKana(null)).toBe('');
  });
});
