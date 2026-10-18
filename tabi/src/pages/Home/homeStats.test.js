import { describe, expect, it } from 'vitest';
import { brochuresWith, busiestId, countBy, pickFeatured, tightRange } from './homeStats.js';
import { SEASONS } from '../../data/seasons.js';

const list = [
  { slug: 'a', region: 'kansai', seasons: ['spring', 'autumn'], featured: true, source: 'builtin', updatedAt: '2026-01-01' },
  { slug: 'b', region: 'kanto', seasons: ['spring', 'spring'], source: 'builtin', updatedAt: '2026-05-01' },
  { slug: 'c', region: 'kansai', seasons: [], source: 'user', updatedAt: '2026-09-01' },
  { slug: 'd', region: '', source: 'builtin', updatedAt: '2026-03-01' },
];

describe('countBy', () => {
  it('counts scalar fields and skips empty values', () => {
    expect(countBy(list, 'region')).toEqual({ kansai: 2, kanto: 1 });
  });

  it('counts each array value once per brochure', () => {
    expect(countBy(list, 'seasons')).toEqual({ spring: 2, autumn: 1 });
  });

  it('survives missing input', () => {
    expect(countBy(undefined, 'region')).toEqual({});
    expect(countBy([null, {}], 'region')).toEqual({});
  });
});

describe('pickFeatured', () => {
  it('puts featured first, then built-ins newest first, then user brochures', () => {
    expect(pickFeatured(list).map((b) => b.slug)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('respects the limit and ignores malformed entries', () => {
    expect(pickFeatured([...list, null, { title: 'no slug' }], 2).map((b) => b.slug)).toEqual(['a', 'b']);
    expect(pickFeatured(list, 0)).toEqual([]);
  });
});

describe('busiestId', () => {
  it('returns the id with the highest count, first on ties', () => {
    expect(busiestId({ kanto: 1, kansai: 2 }, ['kanto', 'kansai'])).toBe('kansai');
    expect(busiestId({ kanto: 1, kansai: 1 }, ['kanto', 'kansai'])).toBe('kanto');
    expect(busiestId({}, ['hokkaido', 'tohoku'])).toBe('hokkaido');
    expect(busiestId({}, [])).toBeNull();
  });
});

describe('brochuresWith', () => {
  it('matches scalar and array fields', () => {
    expect(brochuresWith(list, 'region', 'kansai').map((b) => b.slug)).toEqual(['a', 'c']);
    expect(brochuresWith(list, 'seasons', 'spring', 1).map((b) => b.slug)).toEqual(['a']);
  });
});

describe('tightRange', () => {
  it('closes up the dash so a range cannot wrap as "Mar – / May"', () => {
    expect(tightRange('Mar – May')).toBe('Mar–May');
    expect(tightRange('Dec—Feb')).toBe('Dec–Feb');
    expect(tightRange('Jun - Aug')).toBe('Jun–Aug');
  });

  it('leaves hyphenated words and empty values alone', () => {
    expect(tightRange('Mid-May')).toBe('Mid-May');
    expect(tightRange(undefined)).toBe('');
  });

  it('gives every season a range without spaces', () => {
    for (const season of SEASONS) expect(tightRange(season.months)).not.toMatch(/\s/);
  });
});
