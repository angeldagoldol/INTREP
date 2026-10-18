import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './filterBrochures.js';
import { parseFilters, toSearchParams } from './libraryParams.js';

const parse = (query) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
  it('returns defaults for an empty query', () => {
    expect(parse('')).toEqual({ ...DEFAULT_FILTERS, seasons: [] });
    expect(parseFilters(null)).toEqual({ ...DEFAULT_FILTERS, seasons: [] });
  });

  it('reads every supported param', () => {
    expect(parse('q=onsen&category=onsen&season=winter,autumn&region=kanto&fav=1&sort=newest&view=list')).toEqual({
      q: 'onsen',
      category: 'onsen',
      seasons: ['autumn', 'winter'],
      region: 'kanto',
      fav: true,
      sort: 'newest',
      view: 'list',
    });
  });

  it('drops unknown or malformed values', () => {
    expect(parse('category=sushi&region=atlantis&season=monsoon,,spring,spring&fav=yes&sort=random&view=table')).toEqual({
      ...DEFAULT_FILTERS,
      seasons: ['spring'],
    });
  });

  it('drops prototype-named ids (constructor, __proto__, toString…)', () => {
    expect(parse('category=constructor&region=__proto__&season=toString,hasOwnProperty')).toEqual({
      ...DEFAULT_FILTERS,
      seasons: [],
    });
    expect(parse('category=__proto__&region=constructor&sort=constructor').sort).toBe('featured');
  });

  it('keeps Japanese queries and caps their length', () => {
    expect(parse(`q=${encodeURIComponent('祭')}`).q).toBe('祭');
    expect(parse(`q=${'a'.repeat(500)}`).q).toHaveLength(120);
  });
});

describe('toSearchParams', () => {
  it('omits defaults', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ q: '   ', sort: 'featured', view: 'grid' }).toString()).toBe('');
  });

  it('writes keys in a stable order', () => {
    const params = toSearchParams({ view: 'list', fav: true, q: 'tea', seasons: ['winter', 'spring'], category: 'food', sort: 'az', region: 'kansai' });
    expect(params.toString()).toBe('q=tea&category=food&season=spring%2Cwinter&region=kansai&fav=1&sort=az&view=list');
  });

  it('round-trips through parseFilters', () => {
    const filters = { q: 'kyōto 京都', category: 'heritage', seasons: ['spring', 'autumn'], region: 'kansai', fav: true, sort: 'quickest', view: 'list' };
    expect(parseFilters(toSearchParams(filters))).toEqual(filters);
  });
});
