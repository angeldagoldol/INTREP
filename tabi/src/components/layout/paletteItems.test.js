import { describe, expect, it } from 'vitest';
import { BROCHURES } from '../../data/brochures.js';
import { actionItems, brochureItem, createPaletteIndex, pageItems, placeItems, queryPalette } from './paletteItems.js';

const make = (id, extra = {}) => ({
  id,
  slug: id,
  title: `${id} title`,
  titleJp: '旅',
  category: 'food',
  region: 'kansai',
  seasons: ['autumn'],
  tags: [],
  summary: '',
  pages: [],
  source: 'builtin',
  ...extra,
});

const brochures = [
  make('osaka', { title: 'Osaka Eats', titleJp: '大阪', tags: ['takoyaki', 'street food'] }),
  make('kyoto', { title: 'Kyoto: A Thousand Gates', titleJp: '京都', category: 'heritage', featured: true }),
  make('tohoku', { title: 'Northern Baths', titleJp: '東北', region: 'tohoku', category: 'onsen' }),
];

describe('createPaletteIndex / queryPalette', () => {
  const palette = createPaletteIndex({ brochures, theme: 'light' });

  it('shows recent, suggested (featured first), main pages and actions for an empty query', () => {
    const { groups, flat } = queryPalette(palette, '', ['tohoku', 'missing-id']);
    expect(groups.map((g) => g.id)).toEqual(['recent', 'suggested', 'pages', 'actions']);
    expect(groups[0].items.map((i) => i.brochure.id)).toEqual(['tohoku']);
    expect(groups[1].items.map((i) => i.brochure.id)).toEqual(['kyoto', 'osaka']);
    expect(groups[2].items.map((i) => i.title)).toEqual(['Home', 'Brochure library', 'Studio']);
    expect(flat.map((i) => i.index)).toEqual(flat.map((_, i) => i));
    expect(new Set(flat.map((i) => i.id)).size).toBe(flat.length);
  });

  it('omits the recent group when nothing was viewed', () => {
    const { groups } = queryPalette(palette, '', []);
    expect(groups[0].id).toBe('suggested');
  });

  it('finds brochures by region without diacritics, and by tag', () => {
    const tohoku = queryPalette(palette, 'tohoku');
    // The exact region shortcut wins; the brochure matched via its region follows.
    expect(tohoku.flat[0].to).toBe('/brochures?region=tohoku');
    const brochureGroup = tohoku.groups.find((g) => g.id === 'brochures');
    expect(brochureGroup.items.map((i) => i.brochure.id)).toEqual(['tohoku']);

    const takoyaki = queryPalette(palette, 'takoyaki');
    expect(takoyaki.flat.map((i) => i.brochure?.id)).toEqual(['osaka']);
  });

  it('finds library shortcuts and actions', () => {
    const autumn = queryPalette(palette, 'autumn').flat.map((i) => i.to);
    expect(autumn).toContain('/brochures?season=autumn');
    expect(queryPalette(palette, 'dark').flat.some((i) => i.action === 'toggle-theme')).toBe(true);
    expect(queryPalette(palette, 'omakase').flat[0].action).toBe('random-brochure');
    expect(queryPalette(palette, 'スタジオ').flat[0].to).toBe('/studio');
  });

  it('puts the group holding the best match first', () => {
    const studio = queryPalette(createPaletteIndex({ brochures: [make('k', { organization: 'Kōen Travel Studio' })] }), 'studio');
    expect(studio.groups[0].id).toBe('pages');
    expect(studio.flat[0].to).toBe('/studio');
    expect(studio.groups.map((g) => g.id)).toContain('brochures');
  });

  it('finds brochures and library shortcuts by their hiragana reading', () => {
    const real = createPaletteIndex({ brochures: BROCHURES });
    const kyoto = queryPalette(real, 'きょうと');
    expect(kyoto.flat[0].brochure?.slug).toBe('kyoto-thousand-gates');
    expect(queryPalette(real, 'とうきょう').flat[0].brochure?.slug).toBe('tokyo-after-dark');
    // Readings are a hidden field: nothing visible gets a highlight from them.
    expect(Object.keys(kyoto.flat[0].matches)).toEqual(['kana']);
    expect(queryPalette(real, 'ほっかいどう').flat.map((i) => i.to)).toContain('/brochures?region=hokkaido');
    expect(queryPalette(real, 'おんせん').flat.map((i) => i.to)).toContain('/brochures?category=onsen');
    expect(queryPalette(real, 'ふゆ').flat.map((i) => i.to)).toContain('/brochures?season=winter');
  });

  it('finds the theme action by what people call it ("toggle theme")', () => {
    for (const query of ['toggle theme', 'switch theme', 'theme', 'night mode', 'change appearance']) {
      expect(queryPalette(palette, query).flat[0]?.id, query).toBe('action:theme');
    }
  });

  it('offers "Match system appearance" only after an explicit light or dark choice', () => {
    expect(actionItems('light', 'system').map((a) => a.id)).not.toContain('action:theme-system');
    expect(actionItems('dark', 'dark').map((a) => a.id)).toContain('action:theme-system');
    const chosen = createPaletteIndex({ brochures, theme: 'dark', preference: 'dark' });
    expect(queryPalette(chosen, 'system').flat[0].action).toBe('theme-system');
    expect(queryPalette(chosen, 'auto theme').flat[0].action).toBe('theme-system');
    expect(queryPalette(palette, 'system').flat.some((i) => i.action === 'theme-system')).toBe(false);
  });

  it('returns no groups when nothing matches', () => {
    expect(queryPalette(palette, 'qqqzzz')).toEqual({ groups: [], flat: [] });
  });
});

describe('items', () => {
  it('builds brochure rows that survive missing fields', () => {
    const row = brochureItem({ id: 'b_1', slug: 'x', source: 'user', pages: [] });
    expect(row.title).toBe('Untitled brochure');
    expect(row.meta.startsWith('Your brochure')).toBe(true);
    expect(row.to).toBe('/brochures/x');
    expect(() => createPaletteIndex({ brochures: [row.brochure, null] })).not.toThrow();
  });

  it('labels the theme action with the mode it switches to', () => {
    expect(actionItems('light')[0].title).toBe('Switch to dark mode');
    expect(actionItems('dark')[0].title).toBe('Switch to light mode');
  });

  it('links every category, season and region into the library', () => {
    const tos = pageItems().map((p) => p.to);
    expect(tos).toContain('/brochures?category=heritage');
    expect(tos).toContain('/brochures?season=winter');
    expect(tos).toContain('/brochures?region=hokkaido');
  });
});

describe('places and credits', () => {
  const nara = make('nara', {
    title: 'Nara: Deer and Temples',
    titleJp: '奈良',
    location: { name: 'Tōdai-ji', nameJp: '東大寺', prefecture: 'Nara' },
    pages: [
      { id: 'p1', type: 'cover' },
      { id: 'p3', type: 'place', kicker: 'Temple', name: 'Tōdai-ji', nameJp: '東大寺', photo: 'nara-todaiji' },
      { id: 'p4', type: 'place', name: 'Kasuga Taisha', nameJp: '春日大社' },
      { id: 'p5', type: 'place', name: '  ' },
      null,
    ],
  });
  const palette = createPaletteIndex({ brochures: [nara, ...brochures] });

  it('makes a row per named place page that opens the brochure at that page', () => {
    const items = placeItems(nara);
    expect(items.map((i) => [i.title, i.to, i.photo])).toEqual([
      ['Tōdai-ji', '/brochures/nara?p=1', 'nara-todaiji'],
      ['Kasuga Taisha', '/brochures/nara?p=2', ''],
    ]);
    expect(items[0]).toMatchObject({ kind: 'place', group: 'places', titleJp: '東大寺', meta: 'Nara · page 2' });
    expect(placeItems({})).toEqual([]);
  });

  it('finds places by English or Japanese name, without macrons', () => {
    const todai = queryPalette(palette, 'todaiji');
    expect(todai.groups.find((g) => g.id === 'places').items[0].to).toBe('/brochures/nara?p=1');
    expect(queryPalette(palette, '春日').flat[0].title).toBe('Kasuga Taisha');
  });

  it('finds a brochure by its main place', () => {
    const hits = queryPalette(palette, 'todai').groups.find((g) => g.id === 'brochures');
    expect(hits.items.map((i) => i.brochure.id)).toEqual(['nara']);
  });

  it('leaves places out of the empty state and finds the Credits page', () => {
    expect(queryPalette(palette, '').groups.map((g) => g.id)).not.toContain('places');
    for (const q of ['credits', 'photo licence', 'wikimedia', '奥付']) {
      expect(queryPalette(palette, q).flat[0].to).toBe('/credits');
    }
  });
});
