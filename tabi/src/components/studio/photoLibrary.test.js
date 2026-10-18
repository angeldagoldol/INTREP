// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createPhotoRegistry } from '../../data/photos/registry.js';
import {
  OTHER_GROUP,
  buildLibrary,
  groupLibrary,
  hintWords,
  idSeed,
  libraryCounts,
  orientationOf,
  photoStatus,
  regionsWithPhotos,
  searchLibrary,
  suggestPhotos,
} from './photoLibrary.js';

const manifests = {
  'kyoto.json': {
    photos: [
      { id: 'kyoto-senbon-torii', use: 'cover', alt: 'A tunnel of vermilion torii', caption: 'Senbon Torii at Fushimi Inari Taisha', place: 'Fushimi Inari Taisha' },
      { id: 'kyoto-yasaka-pagoda', use: 'wide', alt: 'A pagoda above a lane', caption: 'Yasaka Pagoda, Higashiyama', place: 'Hōkan-ji, Higashiyama' },
    ],
  },
  'osaka.json': {
    photos: [{ id: 'osaka-dotonbori-night', use: 'cover', alt: 'Neon over a canal', caption: 'Dōtonbori at dusk', place: 'Dōtonbori' }],
  },
  'home.json': { photos: [{ id: 'home-hero-fuji', use: 'cover', alt: 'Mount Fuji over a lake', caption: 'Mount Fuji from Lake Ashi', place: 'Lake Ashi, Hakone' }] },
};
const generated = {
  'osaka-dotonbori-night': { widths: [480, 960], width: 1600, height: 1067, author: 'A. Photographer', license: 'CC BY-SA 4.0' },
};
const registry = createPhotoRegistry(manifests, generated);
const brochures = [
  { slug: 'kyoto', title: 'Kyoto: The Thousand Gates', titleJp: '京都', region: 'kansai', cover: { photo: 'kyoto-senbon-torii' }, pages: [{ id: 'a', type: 'gallery', items: [{ photo: 'kyoto-yasaka-pagoda' }] }] },
  { slug: 'osaka', title: 'Osaka: Eat Until You Drop', titleJp: '大阪', region: 'kansai', cover: { photo: 'osaka-dotonbori-night' }, pages: [] },
];
const entries = buildLibrary(registry.listPhotos(), brochures);
const ids = (list) => list.map((e) => e.id);

describe('buildLibrary', () => {
  it('orders photos by the brochure that uses them, others last', () => {
    expect(ids(entries)).toEqual(['kyoto-senbon-torii', 'kyoto-yasaka-pagoda', 'osaka-dotonbori-night', 'home-hero-fuji']);
    expect(entries[0]).toMatchObject({ group: 'kyoto', brochure: { title: 'Kyoto: The Thousand Gates', region: 'kansai' }, place: 'Fushimi Inari Taisha' });
    expect(entries[3]).toMatchObject({ group: OTHER_GROUP, brochure: null });
  });

  it('knows which photos are downloaded', () => {
    expect(entries.find((e) => e.id === 'osaka-dotonbori-night')).toMatchObject({ available: true, orientation: 'landscape' });
    expect(entries.find((e) => e.id === 'kyoto-senbon-torii')).toMatchObject({ available: false, orientation: 'portrait' });
    expect(libraryCounts(entries)).toEqual({ total: 4, ready: 1 });
  });

  it('survives junk input', () => {
    expect(buildLibrary(null, null)).toEqual([]);
    expect(buildLibrary([null, { id: 5 }, { id: 'user:x', user: true }])).toEqual([]);
  });
});

describe('orientationOf', () => {
  it('prefers measured size over the intended use', () => {
    expect(orientationOf({ width: 1000, height: 1500, use: 'wide' })).toBe('portrait');
    expect(orientationOf({ use: 'wide' })).toBe('landscape');
    expect(orientationOf({ use: 'any' })).toBe('any');
  });
});

describe('searchLibrary', () => {
  it('matches every word, ignoring accents and case', () => {
    expect(ids(searchLibrary(entries, { query: 'dotonbori' }))).toEqual(['osaka-dotonbori-night']);
    expect(ids(searchLibrary(entries, { query: 'TORII fushimi' }))).toEqual(['kyoto-senbon-torii']);
    expect(ids(searchLibrary(entries, { query: '京都' }))).toEqual(['kyoto-senbon-torii', 'kyoto-yasaka-pagoda']);
    expect(searchLibrary(entries, { query: 'nothing-like-this' })).toEqual([]);
    expect(searchLibrary(entries, { query: '  ' })).toHaveLength(4);
  });

  it('filters by region and by availability', () => {
    expect(searchLibrary(entries, { region: 'kansai' })).toHaveLength(3);
    expect(searchLibrary(entries, { region: 'tohoku' })).toEqual([]);
    expect(ids(searchLibrary(entries, { readyOnly: true }))).toEqual(['osaka-dotonbori-night']);
  });
});

describe('groupLibrary / regionsWithPhotos', () => {
  it('groups by brochure with “More photos” last', () => {
    const groups = groupLibrary(entries);
    expect(groups.map((g) => [g.key, g.entries.length])).toEqual([
      ['kyoto', 2],
      ['osaka', 1],
      [OTHER_GROUP, 1],
    ]);
    expect(groups[2]).toMatchObject({ title: 'More photos' });
  });

  it('lists only regions that have photos, in the given order', () => {
    expect(regionsWithPhotos(entries, ['hokkaido', 'kansai', 'kanto'])).toEqual(['kansai']);
  });
});

describe('suggestPhotos', () => {
  it('finds photos of the place being edited', () => {
    expect(hintWords(['Fushimi Inari Taisha', 'The place'])).toEqual(['fushimi', 'inari', 'taisha']);
    expect(ids(suggestPhotos(entries, { hints: ['Fushimi Inari Taisha'] }))).toEqual(['kyoto-senbon-torii']);
    expect(ids(suggestPhotos(entries, { hints: ['Dōtonbori canal'] }))).toEqual(['osaka-dotonbori-night']);
  });

  it('ranks place matches over caption matches and leaves out the current photo', () => {
    const list = suggestPhotos(entries, { hints: ['Higashiyama pagoda'], exclude: '' });
    expect(ids(list)[0]).toBe('kyoto-yasaka-pagoda');
    expect(suggestPhotos(entries, { hints: ['Higashiyama'], exclude: 'kyoto-yasaka-pagoda' })).toEqual([]);
  });

  it('suggests nothing without useful hints', () => {
    expect(suggestPhotos(entries, { hints: ['', 'the new place'] })).toEqual([]);
    expect(suggestPhotos(entries)).toEqual([]);
  });
});

describe('photoStatus', () => {
  it('describes each state of a photo field', () => {
    expect(photoStatus('', null).kind).toBe('empty');
    expect(photoStatus('kyoto-senbon-torii', registry.getPhoto('kyoto-senbon-torii'))).toMatchObject({ kind: 'pending', label: 'Not downloaded yet' });
    expect(photoStatus('osaka-dotonbori-night', registry.getPhoto('osaka-dotonbori-night')).kind).toBe('ready');
    expect(photoStatus('nope', null)).toMatchObject({ kind: 'unknown', detail: expect.stringMatching(/“nope”/) });
    expect(photoStatus('user:gone', null).kind).toBe('broken');
    const upload = registry.resolvePhoto('user:a', { userPhotos: { a: { src: 'data:image/jpeg;base64,QUJD', width: 10, height: 8, alt: 'x', credit: {} } } });
    expect(photoStatus('user:a', upload)).toMatchObject({ kind: 'user', detail: '10 × 8 · stored in this brochure' });
    const damaged = registry.resolvePhoto('user:a', { userPhotos: { a: { src: 'https://x.example/a.jpg' } } });
    expect(photoStatus('user:a', damaged).kind).toBe('broken');
  });
});

describe('idSeed', () => {
  it('is stable and positive', () => {
    expect(idSeed('kyoto-senbon-torii')).toBe(idSeed('kyoto-senbon-torii'));
    expect(idSeed('a')).not.toBe(idSeed('b'));
    expect(idSeed('')).toBeGreaterThan(0);
  });
});
