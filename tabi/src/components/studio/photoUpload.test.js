import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CREDIT,
  MAX_EDGE,
  MAX_PHOTO_CHARS,
  USER_PHOTO_BUDGET,
  altFromFileName,
  budgetCheck,
  buildUserPhoto,
  checkImageFile,
  dataUrlBytes,
  downscaleImage,
  downscaleSteps,
  estimateStorageUse,
  fitWithin,
  formatBytes,
  newUserPhotoKey,
  sanitizeUserPhoto,
  sanitizeUserPhotos,
  storedSize,
  userPhotoUses,
  userPhotosSize,
} from './photoUpload.js';

const jpeg = (chars = 40) => `data:image/jpeg;base64,${'A'.repeat(chars)}`;

/** A canvas double: records draws; toDataURL's length follows pixels × quality. */
function fakeCanvasFactory({ bytesPerPixel = 0.5, type = 'image/jpeg', log = [] } = {}) {
  return (width, height) => {
    const canvas = {
      width,
      height,
      getContext: () => ({
        fillRect: (...args) => log.push(['fill', width, height, ...args]),
        drawImage: (source, sx, sy, sw, sh, dx, dy, dw, dh) => log.push(['draw', sw, sh, dw, dh]),
        set fillStyle(value) {
          log.push(['fillStyle', value]);
        },
      }),
      toDataURL: (mime, quality) => `data:${type};base64,${'A'.repeat(Math.round(width * height * bytesPerPixel * quality))}`,
    };
    return canvas;
  };
}

const image = (width, height) => ({ width, height, close: vi.fn() });

describe('sizes', () => {
  it('fits the long edge within the maximum, never enlarging', () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 1600, height: 1067, scale: 1600 / 6000 });
    expect(fitWithin(3000, 4500)).toMatchObject({ width: 1067, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(fitWithin(4000, 4000, 1000)).toMatchObject({ width: 1000, height: 1000 });
  });

  it('halves in steps before the final size', () => {
    expect(downscaleSteps({ width: 6000, height: 4000 }, { width: 1600, height: 1067 })).toEqual([
      { width: 3000, height: 2000 },
      { width: 1600, height: 1067 },
    ]);
    expect(downscaleSteps({ width: 3200, height: 2400 }, { width: 1600, height: 1200 })).toEqual([{ width: 1600, height: 1200 }]);
    expect(downscaleSteps({ width: 800, height: 600 }, { width: 800, height: 600 })).toEqual([{ width: 800, height: 600 }]);
  });

  it('measures data: URLs as stored text and as file bytes', () => {
    expect(storedSize(jpeg(8))).toBe(31);
    expect(dataUrlBytes('data:image/jpeg;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,QUI=')).toBe(2);
    expect(dataUrlBytes('nope')).toBe(0);
    expect(userPhotosSize({ a: { src: jpeg(10) }, b: { src: jpeg(20) }, c: null })).toBe(2 * 23 + 30);
    expect(userPhotosSize(undefined)).toBe(0);
  });

  it('formats sizes the way people read them', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(412_300)).toBe('412 KB');
    expect(formatBytes(1_230_000)).toBe('1.2 MB');
    expect(formatBytes(3_000_000)).toBe('3 MB');
    expect(formatBytes(-5)).toBe('0 B');
  });
});

describe('budgetCheck', () => {
  it('allows a photo that fits', () => {
    expect(budgetCheck({ used: 1_000_000, adding: 500_000 })).toMatchObject({ ok: true, after: 1_500_000, remaining: 2_000_000, share: 0.5 });
  });

  it('explains when the brochure is over its photo budget', () => {
    const check = budgetCheck({ used: 2_800_000, adding: 400_000 });
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/3\.2 MB, over the 3 MB/);
    expect(check.share).toBe(1);
  });

  it('caps the number of photos', () => {
    expect(budgetCheck({ used: 0, adding: 10, count: 24 })).toMatchObject({ ok: false, message: expect.stringMatching(/24 of your photos/) });
  });

  it('defaults to the 3 MB budget', () => {
    expect(USER_PHOTO_BUDGET).toBe(3_000_000);
  });
});

describe('checkImageFile', () => {
  const file = (name, type, size = 1000) => ({ name, type, size });

  it('accepts browser-readable images', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']) expect(checkImageFile(file('a', type)).ok).toBe(true);
    expect(checkImageFile(file('photo.JPG', '')).ok).toBe(true);
  });

  it('refuses other files with a reason', () => {
    expect(checkImageFile(file('notes.pdf', 'application/pdf'))).toMatchObject({ ok: false, error: expect.stringMatching(/notes\.pdf isn’t a photo/) });
    expect(checkImageFile(file('logo.svg', 'image/svg+xml')).ok).toBe(false);
    expect(checkImageFile(file('IMG_1.HEIC', 'image/heic')).error).toMatch(/HEIC/);
    expect(checkImageFile(file('big.jpg', 'image/jpeg', 50 * 1024 * 1024)).error).toMatch(/under/);
    expect(checkImageFile(file('empty.jpg', 'image/jpeg', 0)).error).toMatch(/empty/);
    expect(checkImageFile(null).ok).toBe(false);
  });
});

describe('altFromFileName', () => {
  it('suggests alt text only from descriptive names', () => {
    expect(altFromFileName('kiyomizu-dera_sunset.jpg')).toBe('Kiyomizu dera sunset');
    expect(altFromFileName('Lake Ashi 2024.jpeg')).toBe('Lake Ashi');
    expect(altFromFileName('IMG_2034.JPG')).toBe('');
    expect(altFromFileName('DSC00012.jpg')).toBe('');
    expect(altFromFileName('PXL_20240501_101010.jpg')).toBe('');
    expect(altFromFileName('a.jpg')).toBe('');
    expect(altFromFileName('2024-05-01.png')).toBe('');
  });
});

describe('downscaleImage', () => {
  it('draws a large photo down to 1600 px on a white ground as JPEG 0.82', async () => {
    const log = [];
    const result = await downscaleImage({}, { decode: async () => image(6000, 4000), createCanvas: fakeCanvasFactory({ bytesPerPixel: 0.2, log }) });
    expect(result).toMatchObject({ width: MAX_EDGE, height: 1067, quality: 0.82 });
    expect(result.src).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.size).toBe(result.src.length);
    expect(log.filter((e) => e[0] === 'draw').map((e) => e.slice(3))).toEqual([
      [3000, 2000],
      [1600, 1067],
    ]);
    expect(log).toContainEqual(['fillStyle', '#ffffff']);
  });

  it('keeps small photos at their own size', async () => {
    const result = await downscaleImage({}, { decode: async () => image(900, 600), createCanvas: fakeCanvasFactory({ bytesPerPixel: 0.2 }) });
    expect(result).toMatchObject({ width: 900, height: 600 });
  });

  it('lowers quality, then size, until the photo fits', async () => {
    // 1600×1067 at 0.82, 0.74 and 0.66 ≈ 1.68, 1.52 and 1.35 M chars: too heavy; 1280 px at 0.82 ≈ 1.07 M fits.
    const result = await downscaleImage({}, { decode: async () => image(6000, 4000), createCanvas: fakeCanvasFactory({ bytesPerPixel: 1.2 }) });
    expect(result).toMatchObject({ width: 1280, quality: 0.82 });
    expect(result.size).toBeLessThanOrEqual(MAX_PHOTO_CHARS);
  });

  it('gives up with a message when nothing fits', async () => {
    await expect(
      downscaleImage({}, { decode: async () => image(6000, 4000), createCanvas: fakeCanvasFactory({ bytesPerPixel: 9 }) }),
    ).rejects.toThrow(/too large to keep/);
  });

  it('explains a file that cannot be decoded', async () => {
    await expect(
      downscaleImage({}, {
        decode: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow(/couldn’t be opened/);
  });

  it('refuses a canvas that cannot make JPEGs', async () => {
    await expect(
      downscaleImage({}, { decode: async () => image(100, 100), createCanvas: fakeCanvasFactory({ type: 'image/png' }) }),
    ).rejects.toThrow(/JPEG/);
  });

  it('releases the decoded bitmap', async () => {
    const bitmap = image(100, 100);
    await downscaleImage({}, { decode: async () => bitmap, createCanvas: fakeCanvasFactory() });
    expect(bitmap.close).toHaveBeenCalled();
  });
});

describe('records', () => {
  it('builds an upload with the default credit', () => {
    const photo = buildUserPhoto({ src: jpeg(), width: 1600, height: 1067 }, { alt: ' Lanterns on the river ', caption: '' });
    expect(photo).toEqual({ src: jpeg(), alt: 'Lanterns on the river', width: 1600, height: 1067, credit: { author: DEFAULT_CREDIT, license: '' } });
  });

  it('keeps only web links in the credit', () => {
    const photo = buildUserPhoto({ src: jpeg(), width: 10, height: 10 }, { author: 'Aiko', license: 'CC BY 4.0', sourceUrl: 'javascript:alert(1)', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
    expect(photo.credit).toEqual({ author: 'Aiko', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
  });

  it('makes unique keys', () => {
    let n = 0;
    const makeId = () => ['ph_a', 'ph_a', 'ph_b'][n++] ?? 'x';
    expect(newUserPhotoKey({ ph_a: {} }, makeId)).toBe('ph_b');
    expect(newUserPhotoKey({ ph1: {} }, () => '!!!')).toBe('ph2');
  });
});

describe('sanitizeUserPhotos', () => {
  const good = { src: jpeg(), alt: 'A gate', width: 1600, height: 1067, credit: { author: 'Your photo', license: '' } };

  it('returns valid uploads untouched', () => {
    const photos = { a1: good };
    expect(sanitizeUserPhotos(photos)).toEqual({ photos, dropped: 0 });
    expect(sanitizeUserPhotos(photos).photos).toBe(photos);
  });

  it('drops anything that is not an inline JPEG, PNG or WebP', () => {
    const { photos, dropped } = sanitizeUserPhotos({
      ok: good,
      png: { ...good, src: 'data:image/png;base64,QUJD' },
      webp: { ...good, src: 'data:image/webp;base64,QUJD' },
      http: { ...good, src: 'https://example.com/a.jpg' },
      blob: { ...good, src: 'blob:https://x.example/0000-1111-2222' },
      svg: { ...good, src: 'data:image/svg+xml;base64,PHN2Zz4=' },
      gif: { ...good, src: 'data:image/gif;base64,R0lG' },
      junk: { ...good, src: 'data:image/jpeg;base64,AAA")' },
      'bad key!': good,
      nope: 'string',
    });
    expect(Object.keys(photos)).toEqual(['ok', 'png', 'webp']);
    expect(dropped).toBe(7);
  });

  it('cleans fields and links', () => {
    const { photos } = sanitizeUserPhotos({
      a: { src: jpeg(), alt: 42, width: '9', height: -1, focus: 'url(x)', caption: ' Dusk ', credit: { author: ' Ken ', sourceUrl: 'javascript:x', licenseUrl: 'https://cc.example/by' }, extra: { deep: true } },
    });
    expect(photos.a).toEqual({ src: jpeg(), alt: '', credit: { author: 'Ken', license: '', licenseUrl: 'https://cc.example/by' }, caption: 'Dusk' });
  });

  it('respects the size, count and budget caps', () => {
    const big = { ...good, src: jpeg(MAX_PHOTO_CHARS) };
    expect(sanitizeUserPhotos({ big }).photos).toBeNull();
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, good]));
    expect(Object.keys(sanitizeUserPhotos(many).photos)).toHaveLength(24);
    const budgeted = sanitizeUserPhotos({ a: good, b: good, c: good }, { budget: storedSize(good.src) * 2 });
    expect(Object.keys(budgeted.photos)).toEqual(['a', 'b']);
    expect(budgeted.dropped).toBe(1);
  });

  it('never lets a __proto__ key through', () => {
    const value = JSON.parse(`{"__proto__": ${JSON.stringify(good)}, "a": ${JSON.stringify(good)}}`);
    const { photos } = sanitizeUserPhotos(value);
    expect(Object.keys(photos)).toEqual(['a']);
    expect(Object.getPrototypeOf(photos)).toBe(Object.prototype);
  });

  it('returns null photos for nothing usable', () => {
    expect(sanitizeUserPhotos(null)).toEqual({ photos: null, dropped: 0 });
    expect(sanitizeUserPhotos([good]).photos).toBeNull();
    expect(sanitizeUserPhoto({ src: 5 })).toBeNull();
  });
});

describe('userPhotoUses', () => {
  it('lists the cover and each page that shows an upload', () => {
    const doc = {
      cover: { photo: 'user:a' },
      pages: [
        { id: 'p1', type: 'cover' },
        { id: 'p2', type: 'intro', photo: 'user:a' },
        { id: 'p3', type: 'gallery', items: [{ photo: 'user:a' }, { photo: 'user:a' }, { photo: 'kyoto-x' }] },
        { id: 'p4', type: 'place', photo: 'user:b' },
      ],
    };
    expect(userPhotoUses(doc, 'a')).toEqual(['cover', 'page:p2', 'page:p3']);
    expect(userPhotoUses(doc, 'zzz')).toEqual([]);
    expect(userPhotoUses(null, 'a')).toEqual([]);
  });
});

describe('estimateStorageUse', () => {
  it('adds up keys and values', () => {
    const data = { 'tabi:a': 'xxxx', 'tabi:bb': 'yy' };
    const storage = { length: 2, key: (i) => Object.keys(data)[i], getItem: (k) => data[k] };
    expect(estimateStorageUse(storage)).toBe(6 + 4 + 7 + 2);
  });

  it('returns null when storage throws', () => {
    const storage = {
      get length() {
        throw new Error('denied');
      },
    };
    expect(estimateStorageUse(storage)).toBeNull();
  });
});
