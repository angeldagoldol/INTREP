import { describe, expect, it } from 'vitest';
import { BROCHURES } from '../../data/brochures.js';
import { foldQuery } from '../../components/layout/search.js';
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  describeFilters,
  facetCounts,
  filterBrochures,
  hasActiveFilters,
  placeNames,
  queryTerms,
  scoreBrochure,
  toggleSeason,
} from './filterBrochures.js';

const make = (overrides) => ({
  id: `b_${overrides.slug}`,
  title: 'Untitled',
  titleJp: '',
  subtitle: '',
  category: 'heritage',
  region: 'kansai',
  seasons: ['spring'],
  organization: '',
  summary: '',
  tags: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  readMinutes: 5,
  featured: false,
  ...overrides,
});

const FIXTURES = [
  make({ slug: 'nara', title: 'Nara Deer Park', titleJp: '奈良', tags: ['deer', 'temples'], updatedAt: '2026-03-01T00:00:00Z', readMinutes: 3 }),
  make({ slug: 'tohoku', title: 'Tōhoku Festivals', titleJp: '東北', category: 'festivals', region: 'tohoku', seasons: ['summer'], updatedAt: '2026-07-01T00:00:00Z', featured: true }),
  make({ slug: 'sapporo', title: 'Sapporo Snow', titleJp: '札幌', category: 'nature', region: 'hokkaido', seasons: ['winter'], organization: 'Yuki & Co.', updatedAt: '2026-09-01T00:00:00Z', readMinutes: 7 }),
  make({ slug: 'beppu', title: 'Beppu Steam', titleJp: '別府', category: 'onsen', region: 'kyushu', seasons: ['autumn', 'winter'], summary: 'Eight hells of boiling water.', readMinutes: 2 }),
  make({ slug: 'naoshima', title: 'Naoshima Art', titleJp: '直島', category: 'craft', region: 'shikoku', seasons: ['spring', 'autumn'], subtitle: 'Museums on a quiet island', featured: true, updatedAt: '2026-05-01T00:00:00Z' }),
];

const slugs = (list) => list.map((b) => b.slug);

describe('folding (search.js foldQuery) / queryTerms', () => {
  it('folds case, macrons and full-width forms', () => {
    expect(foldQuery('Tōhoku')).toBe('tohoku');
    expect(foldQuery('KYŪSHŪ')).toBe('kyushu');
    expect(foldQuery('ＫＹＯＴＯ')).toBe('kyoto');
    expect(foldQuery('  many   spaces ')).toBe('many spaces');
  });

  it('keeps kana voicing marks intact', () => {
    expect(foldQuery('が')).toBe('が');
    expect(foldQuery('ｶﾞ')).toBe('が'); // half-width katakana → full-width → hiragana, still voiced
    expect(foldQuery('カ')).not.toBe(foldQuery('ガ'));
    expect(foldQuery('キョウト')).toBe(foldQuery('きょうと')); // same folding as the ⌘K palette
  });

  it('splits terms and drops stray punctuation', () => {
    expect(queryTerms('  Kyoto,  onsen! ')).toEqual(['kyoto', 'onsen']);
    expect(queryTerms('& —')).toEqual([]);
    expect(queryTerms(null)).toEqual([]);
  });
});

describe('filterBrochures — search', () => {
  it('returns everything for an empty query', () => {
    expect(filterBrochures(FIXTURES, { q: '   ' })).toHaveLength(FIXTURES.length);
  });

  it('is case- and diacritics-insensitive in both directions', () => {
    expect(slugs(filterBrochures(FIXTURES, { q: 'tohoku' }))).toEqual(['tohoku']);
    expect(slugs(filterBrochures(FIXTURES, { q: 'TŌHOKU' }))).toEqual(['tohoku']);
    expect(slugs(filterBrochures(FIXTURES, { q: 'kyūshū' }))).toEqual(['beppu']);
  });

  it('matches Japanese titles, category and region kanji', () => {
    expect(slugs(filterBrochures(FIXTURES, { q: '奈良' }))).toEqual(['nara']);
    expect(slugs(filterBrochures(FIXTURES, { q: '祭' }))).toEqual(['tohoku']);
    expect(slugs(filterBrochures(FIXTURES, { q: '北海道' }))).toEqual(['sapporo']);
  });

  it('searches tags, subtitle, summary, organisation and season names', () => {
    expect(slugs(filterBrochures(FIXTURES, { q: 'deer' }))).toEqual(['nara']);
    expect(slugs(filterBrochures(FIXTURES, { q: 'museums' }))).toEqual(['naoshima']);
    expect(slugs(filterBrochures(FIXTURES, { q: 'hells' }))).toEqual(['beppu']);
    expect(slugs(filterBrochures(FIXTURES, { q: 'yuki' }))).toEqual(['sapporo']);
    expect(slugs(filterBrochures(FIXTURES, { q: '冬', sort: 'az' }))).toEqual(['beppu', 'sapporo']);
  });

  it('requires every term to match (AND), in any order', () => {
    expect(slugs(filterBrochures(FIXTURES, { q: 'island art' }))).toEqual(['naoshima']);
    expect(filterBrochures(FIXTURES, { q: 'deer snow' })).toEqual([]);
  });

  it('returns nothing for gibberish', () => {
    expect(filterBrochures(FIXTURES, { q: 'zzzz' })).toEqual([]);
  });

  it('ranks title hits above summary hits and word starts above infixes', () => {
    const list = [
      make({ slug: 'mention', title: 'Kyoto Walks', summary: 'Ends with a nara day trip.' }),
      make({ slug: 'title', title: 'Nara at Dawn' }),
    ];
    expect(slugs(filterBrochures(list, { q: 'nara' }))).toEqual(['title', 'mention']);
    expect(scoreBrochure(make({ slug: 'a', title: 'Nara' }), ['nara'])).toBeGreaterThan(
      scoreBrochure(make({ slug: 'b', title: 'Kanara' }), ['nara']),
    );
  });

  it('finds the real Tōhoku brochure when typed without macrons', () => {
    expect(slugs(filterBrochures(BROCHURES, { q: 'tohoku' }))).toContain('tohoku-summer-festivals');
    expect(slugs(filterBrochures(BROCHURES, { q: 'Kyoto' }))[0]).toBe('kyoto-thousand-gates');
    expect(filterBrochures(BROCHURES, { q: 'onsen' }).length).toBeGreaterThan(0);
  });
});

describe('filterBrochures — kana readings', () => {
  const found = (q, list = BROCHURES) => filterBrochures(list, { q }).map((b) => b.slug);

  it('finds built-ins by the hiragana (or katakana) reading of their title', () => {
    expect(found('きょうと')).toEqual(['kyoto-thousand-gates']);
    expect(found('キョウト')).toEqual(['kyoto-thousand-gates']);
    expect(found('とうきょう')).toEqual(['tokyo-after-dark']);
    expect(found('ほっかいどう')).toEqual(['hokkaido-powder-snow']);
  });

  it('finds category, region and season readings, and partial input while an IME composes', () => {
    expect(found('おんせん')).toEqual(['hakone-onsen-ryokan']);
    // The festivals category reading ranks first; a festival named on a place page (さっぽろ雪まつり) also matches.
    expect(found('まつり')[0]).toBe('tohoku-summer-festivals');
    expect(found('かんさい').length).toBeGreaterThan(1);
    expect(found('きょ')).toContain('kyoto-thousand-gates');
    // The same brochures as the English word (ranking ties may fall differently).
    expect([...found('ふゆ')].sort()).toEqual([...found('winter')].sort());
  });

  it('ignores a remixed copy’s inherited title reading', () => {
    const remix = make({ slug: 'mine', title: 'My Osaka', titleJp: '大阪', titleKana: 'きょうと', source: 'user', region: 'kansai' });
    expect(found('きょうと', [remix])).toEqual([]);
    expect(found('かんさい', [remix])).toEqual(['mine']);
  });
});

describe('filterBrochures — facets', () => {
  it('filters by category, region and favourites', () => {
    expect(slugs(filterBrochures(FIXTURES, { category: 'onsen' }))).toEqual(['beppu']);
    expect(slugs(filterBrochures(FIXTURES, { region: 'hokkaido' }))).toEqual(['sapporo']);
    expect(slugs(filterBrochures(FIXTURES, { fav: true }, { favoriteIds: ['b_nara', 'b_beppu'] }))).toEqual(['nara', 'beppu']);
    expect(filterBrochures(FIXTURES, { fav: true })).toEqual([]);
  });

  it('matches ANY selected season', () => {
    expect(slugs(filterBrochures(FIXTURES, { seasons: ['winter'], sort: 'az' }))).toEqual(['beppu', 'sapporo']);
    expect(slugs(filterBrochures(FIXTURES, { seasons: ['summer', 'winter'], sort: 'az' }))).toEqual(['beppu', 'sapporo', 'tohoku']);
  });

  it('combines filters', () => {
    expect(slugs(filterBrochures(FIXTURES, { seasons: ['autumn'], category: 'craft', q: 'art' }))).toEqual(['naoshima']);
  });

  it('tolerates incomplete user brochures and junk entries', () => {
    const odd = [null, 'nope', { id: 'b_x', slug: 'x', title: 'Draft' }, { id: 'b_y', slug: 'y' }];
    expect(slugs(filterBrochures(odd, {}, {})).sort()).toEqual(['x', 'y']);
    expect(slugs(filterBrochures(odd, { q: 'draft', seasons: ['spring'] }))).toEqual([]);
    expect(slugs(filterBrochures(odd, { q: 'draft' }))).toEqual(['x']);
    expect(filterBrochures(odd, { q: 'undefined' })).toEqual([]);
    expect(filterBrochures(undefined, DEFAULT_FILTERS)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = [...FIXTURES];
    filterBrochures(FIXTURES, { sort: 'az' });
    expect(FIXTURES).toEqual(copy);
  });
});

describe('filterBrochures — sorting', () => {
  it('featured: featured first, then newest', () => {
    expect(slugs(filterBrochures(FIXTURES, { sort: 'featured' }))).toEqual(['tohoku', 'naoshima', 'sapporo', 'nara', 'beppu']);
  });

  it('newest, A–Z and quickest read', () => {
    expect(slugs(filterBrochures(FIXTURES, { sort: 'newest' }))).toEqual(['sapporo', 'tohoku', 'naoshima', 'nara', 'beppu']);
    expect(slugs(filterBrochures(FIXTURES, { sort: 'az' }))).toEqual(['beppu', 'naoshima', 'nara', 'sapporo', 'tohoku']);
    expect(slugs(filterBrochures(FIXTURES, { sort: 'quickest' }))).toEqual(['beppu', 'nara', 'naoshima', 'tohoku', 'sapporo']);
  });

  it('falls back to featured for an unknown sort', () => {
    expect(filterBrochures(FIXTURES, { sort: 'bogus' })).toEqual(filterBrochures(FIXTURES, { sort: 'featured' }));
  });
});

describe('facetCounts', () => {
  it('counts each option with the other filters applied', () => {
    const counts = facetCounts(FIXTURES, { category: 'onsen', seasons: ['winter'] });
    // Categories ignore the category filter but respect the season filter.
    expect(counts.category).toEqual({ onsen: 1, nature: 1 });
    expect(counts.allCategories).toBe(2);
    // Seasons ignore the season filter but respect the category filter.
    expect(counts.season).toEqual({ autumn: 1, winter: 1 });
    expect(counts.region).toEqual({ kyushu: 1 });
  });

  it('counts every brochure once per season it suits', () => {
    const counts = facetCounts(FIXTURES, {});
    expect(counts.season).toEqual({ spring: 2, summer: 1, autumn: 2, winter: 2 });
    expect(counts.allCategories).toBe(FIXTURES.length);
  });
});

describe('active filter helpers', () => {
  it('detects active filters, ignoring sort and view', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ sort: 'az', view: 'list', q: '  ' })).toBe(false);
    expect(hasActiveFilters({ q: 'kyoto' })).toBe(true);
    expect(hasActiveFilters({ fav: true })).toBe(true);
    expect(countActiveFilters({ q: 'x', category: 'food', seasons: ['spring', 'winter'], fav: true })).toBe(4);
  });

  it('describes removable pills with patches', () => {
    const pills = describeFilters({ q: ' onsen ', category: 'food', seasons: ['spring', 'winter'], region: 'kansai', fav: true });
    expect(pills.map((p) => p.label)).toEqual(['“onsen”', 'Food & Drink', 'Spring', 'Winter', 'Kansai', 'Saved only']);
    expect(pills.find((p) => p.key === 'season:spring').patch).toEqual({ seasons: ['winter'] });
    expect(pills.find((p) => p.key === 'region').jp).toBe('関西');
  });

  it('never builds blank pills from prototype-named ids', () => {
    const pills = describeFilters({ category: 'constructor', seasons: ['__proto__', 'toString'], region: 'toString' });
    expect(pills.map((p) => p.key)).toEqual(['category', 'region']);
    expect(pills.every((p) => typeof p.label === 'string' && p.label.length > 0)).toBe(true);
  });

  it('toggles seasons in calendar order', () => {
    expect(toggleSeason(['winter'], 'spring')).toEqual(['spring', 'winter']);
    expect(toggleSeason(['spring', 'winter'], 'spring')).toEqual(['winter']);
    expect(toggleSeason(undefined, 'autumn')).toEqual(['autumn']);
    expect(toggleSeason([], 'monsoon')).toEqual([]);
  });
});

describe('place names', () => {
  const kyoto = make({
    slug: 'kyoto',
    title: 'A Thousand Gates',
    location: { name: 'Fushimi Inari Taisha', nameJp: '伏見稲荷大社', prefecture: 'Kyoto', lat: 34.9672, lng: 135.7728 },
    pages: [
      { id: 'p1', type: 'place', name: 'Kiyomizu-dera', nameJp: '清水寺' },
      { id: 'p2', type: 'place', name: 'Kiyomizu-dera', nameJp: '' },
      { id: 'p3', type: 'photo', name: 'Tenryū-ji', nameJp: '天龍寺' },
      { id: 'p5', type: 'map', places: [{ name: 'Old map pin', nameJp: '地図' }] },
      { id: 'p4', type: 'intro', name: 'Not a place page' },
      null,
    ],
  });

  it('collects the location, place and photo pages once each (an old map page adds nothing)', () => {
    expect(placeNames(kyoto)).toEqual(['Fushimi Inari Taisha', '伏見稲荷大社', 'Kyoto', 'Kiyomizu-dera', '清水寺', 'Tenryū-ji', '天龍寺']);
    expect(placeNames({})).toEqual([]);
    expect(placeNames({ location: 'x', pages: 'y' })).toEqual([]);
  });

  it('finds a brochure by a sight it describes, in English or Japanese', () => {
    const list = [...FIXTURES, kyoto];
    for (const q of ['kiyomizu', 'tenryu-ji', '清水寺', '伏見', 'fushimi inari']) {
      expect(filterBrochures(list, { q }).map((b) => b.slug)).toEqual(['kyoto']);
    }
    expect(filterBrochures(list, { q: 'intro' })).toEqual([]);
  });

  it('ranks a place-name hit above a summary mention', () => {
    const mention = make({ slug: 'mention', title: 'Day trips', summary: 'Includes a stop at Kiyomizu-dera.' });
    expect(filterBrochures([mention, kyoto], { q: 'kiyomizu' }).map((b) => b.slug)).toEqual(['kyoto', 'mention']);
  });
});
