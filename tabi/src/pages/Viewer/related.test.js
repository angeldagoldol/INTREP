import { describe, expect, it } from 'vitest';
import { relatedBrochures } from './related.js';

const b = (id, fields) => ({ id, slug: id, seasons: [], updatedAt: '2026-01-01', ...fields });

const kyoto = b('kyoto', { category: 'heritage', region: 'kansai', seasons: ['spring', 'autumn'] });
const all = [
  kyoto,
  b('osaka', { category: 'food', region: 'kansai', seasons: ['autumn'] }),
  b('hiroshima', { category: 'heritage', region: 'chugoku', seasons: ['spring'] }),
  b('tokyo', { category: 'cities', region: 'kanto', featured: true, updatedAt: '2026-10-01' }),
  b('alps', { category: 'nature', region: 'chubu', featured: true, updatedAt: '2026-05-01' }),
  b('okinawa', { category: 'islands', region: 'kyushu' }),
];

describe('relatedBrochures', () => {
  it('ranks same category above same region and never includes itself', () => {
    expect(relatedBrochures(kyoto, all).map((x) => x.id)).toEqual(['hiroshima', 'osaka', 'tokyo']);
  });

  it('tops up with featured brochures, newest first', () => {
    const lonely = b('lonely', { category: 'craft', region: 'shikoku' });
    expect(relatedBrochures(lonely, [lonely, ...all]).map((x) => x.id)).toEqual(['tokyo', 'alps', 'kyoto']);
  });

  it('respects the limit and survives junk input', () => {
    expect(relatedBrochures(kyoto, all, 1)).toHaveLength(1);
    expect(relatedBrochures(null, all)).toEqual([]);
    expect(relatedBrochures(kyoto, null)).toEqual([]);
  });
});
