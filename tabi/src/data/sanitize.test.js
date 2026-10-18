import { describe, expect, it } from 'vitest';
import { BROCHURES } from './brochures.js';
import {
  isKnownPageType,
  isRetiredPageType,
  normalizeBrochure,
  normalizePage,
  safeUrl,
  sanitizePages,
  sanitizeStoredBrochure,
  sanitizeUserPhotoMap,
  toLat,
  toLng,
} from './sanitize.js';
import { PAGE_TYPE_IDS, RETIRED_PAGE_TYPES } from './schema.js';

const cover = { id: 'p1', type: 'cover', title: 'Hi' };

describe('sanitizePages', () => {
  it('keeps object pages with a string id and a known type, first id wins', () => {
    const pages = [null, 'x', [], { type: 'intro' }, { id: 7, type: 'intro' }, { id: 'a', type: 'poster' }, { id: 'b', type: 'constructor' }, cover, { ...cover, title: 'dup' }];
    expect(sanitizePages(pages)).toEqual([cover]);
    expect(sanitizePages(undefined)).toEqual([]);
  });
});

describe('normalizeBrochure', () => {
  it('returns every built-in brochure unchanged', () => {
    for (const b of BROCHURES) expect(JSON.stringify(normalizeBrochure(b))).toBe(JSON.stringify(b));
  });

  it('drops values that are not brochures or have no readable pages', () => {
    expect(normalizeBrochure(null)).toBeNull();
    expect(normalizeBrochure([cover])).toBeNull();
    expect(normalizeBrochure({ pages: [null, { id: 'x' }] })).toBeNull();
  });

  it('resets fields of the wrong type and leaves missing ones missing', () => {
    const doc = normalizeBrochure({
      title: { en: 'x' },
      subtitle: 3,
      titleJp: '京都',
      category: 'toString',
      region: 'mars',
      format: 'scroll',
      seasons: ['constructor', 'spring', 'spring', 4],
      tags: ['ok', null],
      theme: 'red',
      cover: { art: 'dragon', seed: '2' },
      readMinutes: { n: 1 },
      featured: 'yes',
      pages: [cover],
    });
    expect(doc).toEqual({
      title: '',
      subtitle: '',
      titleJp: '京都',
      category: 'heritage',
      region: 'kansai',
      format: 'booklet',
      seasons: ['spring'],
      tags: ['ok'],
      theme: {},
      cover: { art: 'hinomaru', seed: 1 },
      readMinutes: 1,
      featured: false,
      pages: [cover],
    });
    expect(normalizeBrochure({ pages: [cover] })).toEqual({ pages: [cover] });
  });
});

describe('retired page types (maps): migrating old brochures and drafts', () => {
  const MAP = { id: 'm', type: 'map', heading: 'Where it all is', places: [{ name: 'Kyoto Station', nameJp: '京都駅', lat: 34.9858, lng: 135.7588 }] };
  const PLACE = { id: 'pl', type: 'place', name: 'Kiyomizu-dera', nameJp: '清水寺', lat: 34.9949, lng: 135.785 };
  const BACK = { id: 'b', type: 'back', title: 'Mata ne' };

  it('knows map as retired, and no retired type is a page type any more', () => {
    expect(RETIRED_PAGE_TYPES).toEqual(['map']);
    expect(isRetiredPageType('map')).toBe(true);
    expect(isRetiredPageType('place')).toBe(false);
    expect(isKnownPageType('map')).toBe(false);
    expect(isKnownPageType('place')).toBe(true);
    for (const type of RETIRED_PAGE_TYPES) expect(PAGE_TYPE_IDS).not.toContain(type);
  });

  it('drops map pages from a stored brochure and keeps everything else as it was', () => {
    const stored = { id: 'b_old', slug: 'old', title: 'Kyoto days', pages: [cover, MAP, PLACE, BACK] };
    const migrated = sanitizeStoredBrochure(stored);
    expect(migrated.pages).toEqual([cover, PLACE, BACK]);
    // Untouched pages keep their identity (copy-on-write), lat/lng stay in the data.
    expect(migrated.pages[1]).toBe(PLACE);
    expect(migrated.pages[1]).toMatchObject({ lat: 34.9949, lng: 135.785 });
    expect(sanitizePages([MAP, { ...MAP, id: 'm2' }])).toEqual([]);
  });

  it('a stored brochure that was nothing but a map is unreadable, like any other empty one', () => {
    expect(sanitizeStoredBrochure({ id: 'b_m', slug: 'm', pages: [MAP] })).toBeNull();
  });
});

describe('sanitizeStoredBrochure', () => {
  it('also needs a non-empty string id and slug', () => {
    expect(sanitizeStoredBrochure({ id: 'b_1', slug: 's', pages: [cover] })).toEqual({ id: 'b_1', slug: 's', pages: [cover] });
    expect(sanitizeStoredBrochure({ id: 'b_1', slug: '', pages: [cover] })).toBeNull();
    expect(sanitizeStoredBrochure({ id: 1, slug: 's', pages: [cover] })).toBeNull();
  });
});

describe('safeUrl / coordinates', () => {
  it('keeps absolute http(s) URLs only', () => {
    expect(safeUrl('https://www.inari.jp/')).toBe('https://www.inari.jp/');
    expect(safeUrl(' http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1');
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<b>x</b>',
      'mailto:a@b.c',
      '/relative',
      '//host/x',
      'https://',
      'ftp://x.y',
      ' ',
      7,
      null,
      {},
    ]) {
      expect(safeUrl(bad)).toBe('');
    }
  });

  it('reads latitude and longitude in range', () => {
    expect(toLat(34.9671)).toBe(34.9671);
    expect(toLat('35.0')).toBe(35);
    expect(toLat(-90)).toBe(-90);
    for (const bad of [90.1, Number.NaN, Infinity, '', 'north', null, undefined, [35]]) expect(toLat(bad)).toBeNull();
    expect(toLng(135.7727)).toBe(135.7727);
    expect(toLng(-180)).toBe(-180);
    expect(toLng(181)).toBeNull();
  });
});

describe('normalizePage', () => {
  it('returns valid new page types unchanged (same object)', () => {
    const place = {
      id: 'pl',
      type: 'place',
      kicker: 'Spotlight',
      name: 'Kiyomizu-dera',
      nameJp: '清水寺',
      photo: 'kyoto-kiyomizu-dera',
      body: 'A wooden stage.',
      facts: [{ label: 'Hours', value: '6:00–18:00' }],
      lat: 34.9949,
      lng: 135.785,
      website: 'https://www.kiyomizudera.or.jp/en/',
    };
    const quote = { id: 'q', type: 'quote', quote: 'An old pond', quoteJp: '古池や', author: 'Matsuo Bashō', role: 'Translation: Tabi Guides' };
    const contact = {
      id: 'c',
      type: 'contact',
      cta: 'Visit',
      ctaUrl: 'https://kyoto.travel/en/',
      details: [{ icon: 'Globe', label: 'Web', value: 'kyoto.travel', url: 'https://kyoto.travel/en/' }],
    };
    const gallery = { id: 'g', type: 'gallery', items: [{ photo: 'kyoto-senbon-torii', art: 'torii', seed: 1, caption: 'Gates' }] };
    for (const page of [place, quote, contact, gallery]) expect(normalizePage(page)).toBe(page);
  });

  it('fixes place pages: text, facts, coordinates and website', () => {
    const page = normalizePage({
      id: 'pl',
      type: 'place',
      name: 3,
      photo: { id: 'x' },
      facts: [{ label: 'Admission', value: 500 }, 'junk', { label: null, value: 'x' }],
      lat: '34.99',
      lng: 999,
      website: 'javascript:alert(1)',
    });
    expect(page).toEqual({
      id: 'pl',
      type: 'place',
      name: '',
      photo: '',
      facts: [
        { label: 'Admission', value: '500' },
        { label: '', value: 'x' },
      ],
      lat: 34.99,
      website: '',
    });
    expect(normalizePage({ id: 'pl', type: 'place', facts: 'Hours: 9–5' }).facts).toEqual([]);
  });

  it('fixes quote, contact and photo fields on items', () => {
    expect(normalizePage({ id: 'q', type: 'quote', quoteJp: 5 }).quoteJp).toBe('');
    const contact = normalizePage({
      id: 'c',
      type: 'contact',
      ctaUrl: 'data:text/html,hi',
      details: [{ label: 'Web', url: 'javascript:void(0)' }, { label: 'Ok', url: 'https://www.japan.travel/en/' }, 'x'],
    });
    expect(contact.ctaUrl).toBe('');
    expect(contact.details).toEqual([
      { label: 'Web', url: '' },
      { label: 'Ok', url: 'https://www.japan.travel/en/' },
    ]);
    const features = normalizePage({ id: 'f', type: 'features', items: [{ title: 'A', photo: 7 }, { title: 'B' }] });
    expect(features.items).toEqual([{ title: 'A', photo: '' }, { title: 'B' }]);
    expect(normalizePage({ id: 'g', type: 'gallery', items: 'x' }).items).toBe('x');
  });
});

describe('normalizePage — photo pages', () => {
  it('returns a valid photo page and spread halves unchanged', () => {
    const full = { id: 'ph', type: 'photo', photo: 'kyoto-fullpage', name: 'Arashiyama', nameJp: '嵐山', caption: 'Early morning', captionPlacement: 'below', creditPlacement: 'edge' };
    const half = { id: 'sl', type: 'photo', photo: 'kyoto-spread', span: 'left' };
    expect(normalizePage(full)).toBe(full);
    expect(normalizePage(half)).toBe(half);
  });

  it('resets broken text and placements and drops an unknown span', () => {
    const page = normalizePage({ id: 'ph', type: 'photo', photo: 4, name: [], nameJp: null, caption: 9, captionPlacement: 'top', creditPlacement: 'x', span: 'middle' });
    expect(page).toEqual({ id: 'ph', type: 'photo', photo: '', name: '', nameJp: '', caption: '', captionPlacement: 'overlay', creditPlacement: 'caption' });
  });
});

describe('brochure-level real-place fields', () => {
  const page = { id: 'p1', type: 'cover', title: 'Hi' };

  it('keeps valid location, sources, factsChecked and cover photo as they are', () => {
    const doc = {
      location: { name: 'Fushimi Inari Taisha', nameJp: '伏見稲荷大社', prefecture: 'Kyoto', lat: 34.9671, lng: 135.7727 },
      sources: [{ label: 'Fushimi Inari Taisha', url: 'https://inari.jp/en/' }],
      factsChecked: 'October 2026',
      cover: { art: 'torii', seed: 5, photo: 'kyoto-senbon-torii' },
      pages: [page],
    };
    expect(JSON.stringify(normalizeBrochure(doc))).toBe(JSON.stringify(doc));
  });

  it('resets broken location, sources, factsChecked and cover photo', () => {
    const doc = normalizeBrochure({
      location: { name: 'X', lat: 'far', lng: 135 },
      sources: [{ label: 'Ok', url: ' https://www.japan.travel/en/ ' }, { label: 'Bad', url: 'javascript:alert(1)' }, { url: 'https://kyoto.travel/', label: 9 }, 'x'],
      factsChecked: 2026,
      cover: { art: 'torii', seed: 5, photo: 12 },
      pages: [page],
    });
    expect(doc.location).toEqual({ name: 'X', lng: 135 });
    expect(doc.sources).toEqual([
      { label: 'Ok', url: 'https://www.japan.travel/en/' },
      { url: 'https://kyoto.travel/', label: '' },
    ]);
    expect(doc.factsChecked).toBe('');
    expect(doc.cover).toEqual({ art: 'torii', seed: 5, photo: '' });
    expect(normalizeBrochure({ location: 'Kyoto', sources: 'x', pages: [page] })).toEqual({ sources: [], pages: [page] });
  });
});

describe('sanitizeUserPhotoMap (Studio uploads in a published brochure)', () => {
  const ok = { src: 'data:image/jpeg;base64,/9j/AAAA', alt: 'Moss garden', width: 4, height: 3, credit: { author: 'Me', license: 'Your photo' } };

  it('keeps entries with a safe inline image and the same object when nothing changes', () => {
    const photos = { ph_a: ok };
    expect(sanitizeUserPhotoMap(photos)).toBe(photos);
  });

  it('drops web links, SVG, non-objects and prototype keys; null when nothing is left', () => {
    const photos = JSON.parse(
      JSON.stringify({
        ph_a: ok,
        ph_web: { ...ok, src: 'https://example.com/x.jpg' },
        ph_svg: { ...ok, src: 'data:image/svg+xml;base64,PHN2Zz4=' },
        ph_str: 'data:image/png;base64,AAAA',
      }),
    );
    photos.__proto__ = ok; // own key, as JSON.parse makes it
    const clean = sanitizeUserPhotoMap(photos);
    expect(Object.keys(clean)).toEqual(['ph_a']);
    expect(Object.getPrototypeOf(clean)).toBe(Object.prototype);
    expect(sanitizeUserPhotoMap({ ph_web: { src: 'javascript:alert(1)' } })).toBeNull();
    expect(sanitizeUserPhotoMap([ok])).toBeNull();
  });

  it('is applied to stored brochures', () => {
    const stored = { id: 'b_x', slug: 'x', pages: [cover], userPhotos: { ph_bad: { src: 'https://x.test/a.png' } } };
    expect('userPhotos' in sanitizeStoredBrochure(stored)).toBe(false);
    const good = { id: 'b_x', slug: 'x', pages: [cover], userPhotos: { ph_a: ok } };
    expect(sanitizeStoredBrochure(good).userPhotos).toBe(good.userPhotos);
  });
});
