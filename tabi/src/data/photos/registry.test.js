import { describe, expect, it } from 'vitest';
import { createPhotoRegistry, isUserPhotoId, photoIdsIn, photoUrl, pickWidth, resolveUserPhoto, safeImageSrc } from './registry.js';
import * as live from './index.js';

const manifests = {
  './manifest/kyoto.json': {
    brochure: 'kyoto',
    photos: [
      {
        id: 'kyoto-senbon-torii',
        use: 'cover',
        candidates: ['File:A.jpg'],
        alt: 'A tunnel of vermilion torii gates',
        caption: 'Senbon Torii',
        place: 'Fushimi Inari Taisha',
        focus: '50% 45%',
      },
      { id: 'kyoto-kiyomizu', use: 'wide', candidates: ['File:B.jpg'], alt: 'A wooden temple stage over maples', caption: 'Kiyomizu-dera' },
      { id: 'kyoto-senbon-torii', alt: 'duplicate, ignored' },
      { alt: 'no id' },
      null,
    ],
  },
  './manifest/tokyo.json': [{ id: 'tokyo-shibuya', alt: 'A crossing' }],
};

const generated = {
  'kyoto-senbon-torii': {
    id: 'kyoto-senbon-torii',
    file: 'File:A.jpg',
    width: 1600,
    height: 2400,
    widths: [960, 480, 1600],
    lqip: 'data:image/webp;base64,UklGRl4AAABXRUJQ',
    color: '#b8432a',
    title: 'Senbon Torii, Fushimi Inari',
    author: 'Example Photographer',
    authorUrl: 'https://commons.wikimedia.org/wiki/User:Example',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    attributionRequired: true,
    fetchedAt: '2026-10-17T00:00:00.000Z',
  },
  'imported-only': {
    id: 'imported-only',
    file: 'local:x.jpg',
    width: 960,
    height: 640,
    widths: [480, 960],
    lqip: 'javascript:alert(1)',
    color: 'red',
    author: 'Me',
    authorUrl: 'javascript:alert(1)',
    license: '© Me',
    licenseUrl: 'data:text/html,<b>x</b>',
    sourceUrl: '/photos/x.jpg',
    attributionRequired: true,
  },
  'css-breakout': {
    widths: [480],
    width: 480,
    height: 320,
    lqip: 'data:image/webp;base64,AAAA"), url("https://tracker.example/x.png',
  },
  'broken-record': 'not an object',
};

const registry = createPhotoRegistry(manifests, generated);

describe('createPhotoRegistry', () => {
  it('merges a downloaded photo with its manifest entry', () => {
    const photo = registry.getPhoto('kyoto-senbon-torii');
    expect(photo).toMatchObject({
      id: 'kyoto-senbon-torii',
      alt: 'A tunnel of vermilion torii gates',
      caption: 'Senbon Torii',
      place: 'Fushimi Inari Taisha',
      focus: '50% 45%',
      use: 'cover',
      width: 1600,
      height: 2400,
      widths: [480, 960, 1600],
      color: '#b8432a',
      available: true,
      attributionRequired: true,
      credit: {
        title: 'Senbon Torii, Fushimi Inari',
        author: 'Example Photographer',
        authorUrl: 'https://commons.wikimedia.org/wiki/User:Example',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      },
    });
    expect(photo.lqip).toMatch(/^data:image\/webp;base64,/);
  });

  it('serves relative URLs for the smallest width that covers the slot', () => {
    const photo = registry.getPhoto('kyoto-senbon-torii');
    expect(photo.src(300)).toBe('photos/kyoto-senbon-torii-480.webp');
    expect(photo.src(700)).toBe('photos/kyoto-senbon-torii-960.webp');
    expect(photo.src(5000)).toBe('photos/kyoto-senbon-torii-1600.webp');
    expect(photo.src()).toBe('photos/kyoto-senbon-torii-1600.webp');
    expect(photo.srcSet).toBe('photos/kyoto-senbon-torii-480.webp 480w, photos/kyoto-senbon-torii-960.webp 960w, photos/kyoto-senbon-torii-1600.webp 1600w');
    expect(photo.src(480)).not.toMatch(/^\/|^https?:/);
  });

  it('knows listed photos that are not downloaded yet', () => {
    const photo = registry.getPhoto('kyoto-kiyomizu');
    expect(photo).toMatchObject({ available: false, width: null, height: null, lqip: '', color: '', srcSet: '', focus: '50% 50%', use: 'wide' });
    expect(photo.src(960)).toBeNull();
  });

  it('accepts bare photo arrays and generated-only records, dropping unsafe values', () => {
    expect(registry.getPhoto('tokyo-shibuya')).toMatchObject({ alt: 'A crossing', available: false });
    expect(registry.getPhoto('imported-only')).toMatchObject({
      alt: '',
      available: true,
      lqip: '',
      color: '',
      credit: { license: '© Me', authorUrl: '', licenseUrl: '', sourceUrl: '' },
    });
    expect(registry.getPhoto('css-breakout').lqip).toBe('');
    expect(registry.getPhoto('broken-record')).toBeNull();
  });

  it('returns null for unknown ids and non-strings, including prototype names', () => {
    for (const id of ['nope', '', undefined, null, 7, {}, 'constructor', '__proto__', 'toString']) expect(registry.getPhoto(id)).toBeNull();
  });

  it('lists photos by id', () => {
    expect(registry.listPhotos().map((p) => p.id)).toEqual(['css-breakout', 'imported-only', 'kyoto-kiyomizu', 'kyoto-senbon-torii', 'tokyo-shibuya']);
  });

  it('survives empty input', () => {
    const empty = createPhotoRegistry();
    expect(empty.listPhotos()).toEqual([]);
    expect(createPhotoRegistry(null, null).getPhoto('x')).toBeNull();
  });
});

describe('photoIdsIn / creditsFor', () => {
  const brochure = {
    cover: { art: 'torii', seed: 5, photo: 'kyoto-senbon-torii' },
    pages: [
      { id: 'p1', type: 'cover', photo: 'kyoto-senbon-torii' },
      { id: 'p2', type: 'intro', photo: 'kyoto-kiyomizu' },
      { id: 'p3', type: 'place', photo: ' imported-only ' },
      { id: 'p4', type: 'features', items: [{ title: 'x', photo: 'tokyo-shibuya' }, null, { photo: 3 }] },
      { id: 'p5', type: 'gallery', items: [{ photo: 'kyoto-senbon-torii' }, { photo: 'unknown-photo' }] },
      null,
    ],
  };

  it('collects every photo id once, in reading order', () => {
    expect(photoIdsIn(brochure)).toEqual(['kyoto-senbon-torii', 'kyoto-kiyomizu', 'imported-only', 'tokyo-shibuya', 'unknown-photo']);
    expect(photoIdsIn(null)).toEqual([]);
    expect(photoIdsIn({ pages: 'x', cover: 'y' })).toEqual([]);
  });

  it('credits only the photos that are actually shown', () => {
    expect(registry.creditsFor(brochure)).toEqual([
      {
        id: 'kyoto-senbon-torii',
        caption: 'Senbon Torii',
        place: 'Fushimi Inari Taisha',
        title: 'Senbon Torii, Fushimi Inari',
        author: 'Example Photographer',
        authorUrl: 'https://commons.wikimedia.org/wiki/User:Example',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
        attributionRequired: true,
        user: false,
      },
      expect.objectContaining({ id: 'imported-only', author: 'Me' }),
    ]);
  });
});

describe('user photos (brochure.userPhotos, "user:<key>")', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const mine = {
    src: PNG,
    alt: 'My photo of the gate at dusk',
    caption: 'The gate at dusk',
    focus: '30% 60%',
    width: 1200,
    height: 800,
    credit: { author: 'Aiko', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'javascript:alert(1)' },
  };
  const brochure = {
    cover: { photo: 'user:gate' },
    userPhotos: {
      gate: mine,
      blob: { src: 'blob:http://localhost:5173/0f8e7c2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b', alt: 'A blob', width: 800, height: 600, credit: {} },
      remote: { src: 'https://example.com/hotlink.jpg', alt: 'Hotlinked', width: 10, height: 10, credit: { author: 'X' } },
      svg: { src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', alt: 'svg' },
    },
    pages: [
      { id: 'p1', type: 'cover', photo: 'user:gate' },
      { id: 'p2', type: 'intro', photo: 'user:blob' },
      { id: 'p3', type: 'place', photo: 'kyoto-senbon-torii' },
      { id: 'p4', type: 'gallery', items: [{ photo: 'user:remote' }, { photo: 'user:missing' }, { photo: 'user:constructor' }] },
    ],
  };

  it('recognises user ids and only safe inline images', () => {
    expect(isUserPhotoId('user:gate')).toBe(true);
    expect(isUserPhotoId(' user:gate ')).toBe(true);
    for (const id of ['user:', 'kyoto-senbon-torii', '', null, 3]) expect(isUserPhotoId(id)).toBe(false);
    expect(safeImageSrc(PNG)).toBe(PNG);
    expect(safeImageSrc('data:image/jpeg;base64,/9j/4AAQ')).toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(safeImageSrc('blob:http://localhost:5173/0f8e7c2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b')).toBeTruthy();
    for (const bad of ['https://example.com/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', 'data:image/png;base64,AA") url(x', 'blob:javascript:1', 42]) {
      expect(safeImageSrc(bad)).toBe('');
    }
  });

  it('resolves "user:<key>" to the brochure’s own photo, shaped like a registry photo', () => {
    const photo = registry.resolvePhoto('user:gate', brochure);
    expect(photo).toMatchObject({
      id: 'user:gate',
      alt: 'My photo of the gate at dusk',
      caption: 'The gate at dusk',
      focus: '30% 60%',
      width: 1200,
      height: 800,
      available: true,
      user: true,
      srcSet: '',
      credit: { author: 'Aiko', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: '' },
    });
    expect(photo.src(480)).toBe(PNG);
    // Same entry → same record, so <Photo> keeps its loading state across renders.
    expect(registry.resolvePhoto('user:gate', brochure)).toBe(photo);
    expect(registry.resolvePhoto('user:gate', { ...brochure, userPhotos: { gate: { ...mine } } }).token).not.toBe(photo.token);
  });

  it('leaves hotlinks, SVGs, unknown keys and prototype names unavailable or null', () => {
    expect(registry.resolvePhoto('user:remote', brochure)).toMatchObject({ available: false, src: expect.any(Function) });
    expect(registry.resolvePhoto('user:remote', brochure).src(960)).toBeNull();
    expect(registry.resolvePhoto('user:svg', brochure).available).toBe(false);
    for (const id of ['user:missing', 'user:constructor', 'user:__proto__', 'user:toString']) expect(registry.resolvePhoto(id, brochure)).toBeNull();
    expect(registry.resolvePhoto('user:gate', null)).toBeNull();
    expect(registry.resolvePhoto('user:gate', { userPhotos: 'x' })).toBeNull();
    expect(resolveUserPhoto('user:gate', { userPhotos: { gate: 'not a record' } })).toBeNull();
    expect(registry.resolvePhoto('user:gate', { userPhotos: { gate: { src: PNG, width: 'wide', height: -4, focus: 'url(x)' } } })).toMatchObject({
      width: null,
      height: null,
      widths: [],
      focus: '50% 50%',
      alt: '',
    });
  });

  it('still resolves registry ids', () => {
    expect(registry.resolvePhoto('kyoto-senbon-torii', brochure)).toBe(registry.getPhoto('kyoto-senbon-torii'));
    expect(registry.resolvePhoto('kyoto-senbon-torii')).toBe(registry.getPhoto('kyoto-senbon-torii'));
  });

  it('credits uploads that name an author or licence, in reading order', () => {
    expect(registry.creditsFor(brochure).map((c) => [c.id, c.author, c.license, c.user])).toEqual([
      ['user:gate', 'Aiko', 'CC BY 4.0', true],
      ['kyoto-senbon-torii', 'Example Photographer', 'CC BY-SA 4.0', false],
    ]);
  });
});

describe('helpers', () => {
  it('pickWidth and photoUrl', () => {
    expect(pickWidth([], 100)).toBeNull();
    expect(pickWidth([480, 960], 481)).toBe(960);
    expect(photoUrl('a-b', 480)).toBe('photos/a-b-480.webp');
  });
});

describe('the app registry (src/data/photos)', () => {
  it('loads the manifests with unique, kebab-case ids and alt text', () => {
    const photos = live.listPhotos();
    for (const photo of photos) {
      expect(photo.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      // Every listed photo describes what it shows (docs/REAL_CONTENT.md); <Photo> falls back to the caption.
      expect(photo.alt || photo.caption, photo.id).toBeTruthy();
      if (photo.available) {
        expect(photo.width).toBeGreaterThan(0);
        expect(photo.credit.license).toBeTruthy();
      }
    }
    expect(new Set(photos.map((p) => p.id)).size).toBe(photos.length);
    expect(live.getPhoto('definitely-not-a-photo')).toBeNull();
  });
});

describe('live photos in the registry (bundled > live > art)', () => {
  const image = Object.freeze({
    file: 'File:Kiyomizu live.jpg',
    width: 3000,
    height: 2000,
    widths: [500, 960, 1280, 1920],
    srcSet: 'https://upload.wikimedia.org/a 500w, https://upload.wikimedia.org/b 1920w',
    src: (w) => (w > 960 ? 'https://upload.wikimedia.org/b' : 'https://upload.wikimedia.org/a'),
    credit: { title: 'Kiyomizu in autumn', author: 'Jane', authorUrl: 'javascript:alert(1)', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kiyomizu_live.jpg' },
    attributionRequired: true,
    via: 'candidate',
  });
  const images = new Map([
    ['kyoto-kiyomizu', image],
    ['kyoto-senbon-torii', { ...image, file: 'File:Ignored.jpg' }],
  ]);
  const withLive = createPhotoRegistry(manifests, generated, { live: { get: (id) => images.get(id) ?? null } });

  it('shows a live photo where nothing is bundled, with the manifest’s words', () => {
    const photo = withLive.getPhoto('kyoto-kiyomizu');
    expect(photo).toMatchObject({
      id: 'kyoto-kiyomizu',
      alt: 'A wooden temple stage over maples',
      caption: 'Kiyomizu-dera',
      use: 'wide',
      available: true,
      live: true,
      user: false,
      width: 3000,
      height: 2000,
      lqip: '',
      token: 'live:File:Kiyomizu live.jpg',
    });
    expect(photo.src(1600)).toBe('https://upload.wikimedia.org/b');
    expect(photo.srcSet).toBe(image.srcSet);
    expect(photo.credit.authorUrl).toBe(''); // only http(s) links
    expect(photo.credit.sourceUrl).toBe('https://commons.wikimedia.org/wiki/File:Kiyomizu_live.jpg');
    expect(withLive.getPhoto('kyoto-kiyomizu')).toBe(photo);
  });

  it('prefers the bundled photo, and lists live ones too', () => {
    expect(withLive.getPhoto('kyoto-senbon-torii').live).toBeUndefined();
    expect(withLive.getPhoto('kyoto-senbon-torii').src(480)).toBe('photos/kyoto-senbon-torii-480.webp');
    expect(withLive.listPhotos().find((p) => p.id === 'kyoto-kiyomizu').live).toBe(true);
    expect(withLive.getPhoto('tokyo-shibuya').available).toBe(false);
  });

  it('credits live photos with the rest', () => {
    const brochure = { cover: { photo: 'kyoto-senbon-torii' }, pages: [{ id: 'p', type: 'place', photo: 'kyoto-kiyomizu' }] };
    expect(withLive.creditsFor(brochure).map((c) => [c.id, c.author, c.license])).toEqual([
      ['kyoto-senbon-torii', 'Example Photographer', 'CC BY-SA 4.0'],
      ['kyoto-kiyomizu', 'Jane', 'CC BY 4.0'],
    ]);
  });

  it('uses the work’s title as alt text for a photo found by search', () => {
    const searched = createPhotoRegistry(manifests, {}, { live: { get: () => ({ ...image, via: 'search' }) } });
    expect(searched.getPhoto('kyoto-kiyomizu')).toMatchObject({ alt: 'Kiyomizu in autumn', via: 'search' });
  });

  it('ignores a live image it cannot draw', () => {
    const broken = createPhotoRegistry(manifests, {}, { live: { get: () => ({ ...image, widths: [], srcSet: '' }) } });
    expect(broken.getPhoto('kyoto-kiyomizu').available).toBe(false);
  });
});

describe('photos the download found by searching Commons', () => {
  it('use the work’s title as alt text, like a live search find', () => {
    const found = {
      'kyoto-kiyomizu': { ...generated['kyoto-senbon-torii'], id: 'kyoto-kiyomizu', file: 'File:Kiyomizu-dera landscape.jpg', title: 'Kiyomizu-dera in autumn', via: 'search', query: 'Kiyomizu-dera' },
    };
    const registry = createPhotoRegistry(manifests, found);
    expect(registry.getPhoto('kyoto-kiyomizu')).toMatchObject({ available: true, alt: 'Kiyomizu-dera in autumn', caption: 'Kiyomizu-dera', via: 'search' });
    // A researched candidate keeps the manifest's words.
    expect(registry.getPhoto('kyoto-senbon-torii')).toMatchObject({ alt: 'A tunnel of vermilion torii gates' });
    expect(registry.getPhoto('kyoto-senbon-torii').via).toBeUndefined();
  });
});

describe('the app registry takes in newly downloaded photos (npm run dev)', () => {
  it('swaps a slot to its bundled photo, stops asking Commons for it, and tells subscribers', () => {
    const id = live.listPhotos().find((p) => !p.available)?.id;
    expect(id).toBeTruthy();
    expect(live.livePhotos.has(id)).toBe(true);
    const before = live.photosSnapshot(id);
    let calls = 0;
    const off = live.subscribePhotos(() => {
      calls += 1;
    });
    const { bundled, total } = live.bundledCount();
    live.updateBundledPhotos({ [id]: { ...generated['kyoto-senbon-torii'], id, file: 'File:A.jpg' } });
    expect(calls).toBe(1);
    expect(live.photosSnapshot(id)).not.toBe(before);
    expect(live.getPhoto(id)).toMatchObject({ available: true, widths: [480, 960, 1600] });
    expect(live.getPhoto(id).src(960)).toBe(`photos/${id}-960.webp`);
    expect(live.livePhotos.has(id)).toBe(false);
    expect(live.bundledCount()).toEqual({ bundled: bundled + 1, total });
    off();
    live.updateBundledPhotos({});
    expect(calls).toBe(1);
  });
});
