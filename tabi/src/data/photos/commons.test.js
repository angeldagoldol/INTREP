// @vitest-environment node
import { describe, expect, it } from 'vitest';
import imageinfo from './fixtures/live-imageinfo.json';
import search from './fixtures/live-search.json';
import {
  API_THUMB_WIDTH,
  evaluateLive,
  imageInfoUrl,
  liveImageSet,
  mergeQueryResponses,
  orientationFit,
  owesImageInfo,
  parseImageInfoResponse,
  pickSearchResult,
  sanitizeLiveRecord,
  searchResults,
  searchUrl,
  uploadUrl,
} from './commons.js';

const titles = [
  'File:Torii_path_at_dawn.jpg',
  'File:Pagoda portrait.jpg',
  'File:Maple noncommercial.jpg',
  'File:Tiny shrine.jpg',
  'File:Map of Kyoto.svg',
  'File:Scan of a print.tif',
  'File:No licence at all.jpg',
  'File:Does not exist anywhere.jpg',
  'File:Bad<title>.jpg',
];
const parsed = parseImageInfoResponse(imageinfo, titles);
const verdict = (title) => evaluateLive(parsed.get(title));

describe('Commons API URLs', () => {
  it('asks for imageinfo of up to 50 titles anonymously, with a 1280 px thumbnail', () => {
    const url = new URL(imageInfoUrl(['File:A.jpg', 'File:B c.jpg']));
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php');
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({
      action: 'query',
      format: 'json',
      formatversion: '2',
      origin: '*',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: String(API_THUMB_WIDTH),
      titles: 'File:A.jpg|File:B c.jpg',
    });
    expect(p.iiurlwidth).toBe('1280');
    expect(p.iiextmetadatafilter.split('|')).toEqual(expect.arrayContaining(['Artist', 'LicenseShortName', 'LicenseUrl']));
  });

  it('carries a continue object into the next request', () => {
    const p = new URL(imageInfoUrl(['File:A.jpg'], { iistart: '2020', continue: '||' })).searchParams;
    expect(p.get('iistart')).toBe('2020');
    expect(p.get('continue')).toBe('||');
  });

  it('searches bitmap files in the File namespace, ten at a time', () => {
    const p = Object.fromEntries(new URL(searchUrl('Kiyomizu-dera main hall autumn')).searchParams);
    expect(p).toMatchObject({ generator: 'search', gsrnamespace: '6', gsrsearch: 'Kiyomizu-dera main hall autumn filetype:bitmap', gsrlimit: '10', origin: '*', prop: 'imageinfo' });
  });

  it('follows continuation only while imageinfo is owed (not the next page of search results)', () => {
    expect(owesImageInfo(undefined)).toBe(false);
    expect(owesImageInfo({ iistart: 'x', continue: '||' })).toBe(true);
    expect(owesImageInfo({ iicontinue: 'x', continue: 'gsroffset||' })).toBe(true);
    expect(owesImageInfo({ gsroffset: 10, continue: 'gsroffset||' })).toBe(false);
  });
});

describe('evaluateLive (the live photo policy)', () => {
  it('accepts a large free-licence JPEG and credits it in plain text', () => {
    const v = verdict('File:Torii_path_at_dawn.jpg');
    expect(v.ok).toBe(true);
    expect(v.record).toMatchObject({
      file: 'File:Torii path at dawn.jpg',
      width: 4000,
      height: 2667,
      mime: 'image/jpeg',
      url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Torii_path_at_dawn.jpg',
      thumb: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Torii_path_at_dawn.jpg/1280px-Torii_path_at_dawn.jpg',
      via: 'candidate',
      attributionRequired: true,
    });
    expect(v.record.credit).toEqual({
      title: 'Torii path at dawn',
      author: 'Jane',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Jane_Example',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Torii_path_at_dawn.jpg',
    });
  });

  it('decodes entities and strips tags from the author, never keeping HTML', () => {
    const v = verdict('File:Pagoda portrait.jpg');
    expect(v.ok).toBe(true);
    expect(v.record.credit.author).toBe('Tarō Yamada & friends');
    expect(v.record.credit.authorUrl).toBe('');
    expect(v.record.credit.licenseUrl).toBe('http://creativecommons.org/publicdomain/zero/1.0/deed.en'.replace('http:', 'https:'));
    expect(v.record.attributionRequired).toBe(false);
  });

  it.each([
    ['File:Maple noncommercial.jpg', /NonCommercial/],
    ['File:Tiny shrine.jpg', /too small/],
    ['File:Map of Kyoto.svg', /not a photo/],
    ['File:Scan of a print.tif', /not a web image/],
    ['File:No licence at all.jpg', /no licence/],
    ['File:Does not exist anywhere.jpg', /no such file/],
    ['File:Bad<title>.jpg', /invalid/],
  ])('rejects %s', (title, reason) => {
    const v = verdict(title);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(reason);
  });
});

describe('liveImageSet (thumbnail steps)', () => {
  it('derives 500/960/1280/1920 from the API thumbnail of a large original', () => {
    const set = liveImageSet(verdict('File:Torii_path_at_dawn.jpg').record);
    const base = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Torii_path_at_dawn.jpg/';
    expect(set.widths).toEqual([500, 960, 1280, 1920]);
    expect(set.srcSet).toBe(`${base}500px-Torii_path_at_dawn.jpg 500w, ${base}960px-Torii_path_at_dawn.jpg 960w, ${base}1280px-Torii_path_at_dawn.jpg 1280w, ${base}1920px-Torii_path_at_dawn.jpg 1920w`);
    expect(set.src(300)).toBe(`${base}500px-Torii_path_at_dawn.jpg`);
    expect(set.src(1000)).toBe(`${base}1280px-Torii_path_at_dawn.jpg`);
    expect(set.src(4000)).toBe(`${base}1920px-Torii_path_at_dawn.jpg`);
  });

  it('caps at the original when it is narrower than a step (no upscaled thumbnails)', () => {
    const record = { ...verdict('File:Torii_path_at_dawn.jpg').record, width: 1600, height: 2400 };
    const set = liveImageSet(record);
    expect(set.widths).toEqual([500, 960, 1280, 1600]);
    expect(set.urls[1600]).toBe(record.url);
    expect(set.src(1700)).toBe(record.url);
  });

  it('builds thumbnail URLs when the API answered with the original (no wider than iiurlwidth)', () => {
    const set = liveImageSet(verdict('File:Pagoda portrait.jpg').record);
    expect(set.widths).toEqual([500, 960, 1200]);
    expect(set.urls[500]).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Pagoda_portrait.jpg/500px-Pagoda_portrait.jpg');
    expect(set.urls[1200]).toBe('https://upload.wikimedia.org/wikipedia/commons/2/2b/Pagoda_portrait.jpg');
  });

  it('names thumbnails of long file names "thumbnail.<ext>", as Wikimedia does', () => {
    const name = `${'Very_long_name_'.repeat(12)}.jpg`;
    const set = liveImageSet({ width: 1000, height: 1500, mime: 'image/jpeg', url: `https://upload.wikimedia.org/wikipedia/commons/f/f0/${name}`, thumb: '' });
    expect(set.urls[500]).toBe(`https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/${name}/500px-thumbnail.jpg`);
    // …with the extension in lower case, whatever the file's own is.
    const upper = `${'Very_long_name_'.repeat(12)}.JPG`;
    const shouting = liveImageSet({ width: 1000, height: 1500, mime: 'image/jpeg', url: `https://upload.wikimedia.org/wikipedia/commons/f/f0/${upper}`, thumb: '' });
    expect(shouting.urls[500]).toBe(`https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/${upper}/500px-thumbnail.jpg`);
  });

  it('uses only the original for a small WebP (no thumbnail name to swap)', () => {
    const set = liveImageSet({ width: 1100, height: 1700, mime: 'image/webp', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Small.webp', thumb: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Small.webp' });
    expect(set.widths).toEqual([1100]);
  });

  it('has nothing for records without a Commons upload URL', () => {
    expect(liveImageSet({ width: 3000, height: 2000, mime: 'image/jpeg', url: 'https://evil.example/x.jpg' }).widths).toEqual([]);
    expect(uploadUrl('javascript:alert(1)')).toBe('');
    expect(uploadUrl('//upload.wikimedia.org/wikipedia/commons/1/1a/X.jpg')).toBe('https://upload.wikimedia.org/wikipedia/commons/1/1a/X.jpg');
    expect(uploadUrl('https://upload.wikimedia.org/wikipedia/commons/1/1a/X".jpg')).toBe('');
  });
});

describe('search fallback', () => {
  const merged = mergeQueryResponses([search]);
  const results = searchResults(merged, parseImageInfoResponse(merged));

  it('keeps the search ranking', () => {
    expect(results.map((r) => r.title)).toEqual([
      'File:Kiyomizu-dera landscape.jpg',
      'File:Kiyomizu-dera portrait.jpg',
      'File:Kiyomizu-dera huge panorama.jpg',
      'File:Kiyomizu-dera NC.jpg',
    ]);
  });

  it('scores shapes by use', () => {
    expect(orientationFit('cover', 2000, 3000)).toBe(2);
    expect(orientationFit('full', 2000, 2000)).toBe(2);
    expect(orientationFit('cover', 3000, 2000)).toBe(0);
    expect(orientationFit('wide', 3000, 2000)).toBe(2);
    expect(orientationFit('spread', 2600, 2000)).toBe(1);
    expect(orientationFit('wide', 2000, 3000)).toBe(0);
    expect(orientationFit('any', 2000, 3000)).toBe(2);
    // A long panorama strip or a sliver of a portrait would lose most of itself to the page's crop.
    expect(orientationFit('spread', 12000, 3000)).toBe(0);
    expect(orientationFit('wide', 7500, 3000)).toBe(1);
    expect(orientationFit('full', 1000, 3000)).toBe(0);
    expect(orientationFit('cover', 1000, 2300)).toBe(1);
  });

  it('picks by orientation for the slot, then size, never a non-free file', () => {
    expect(pickSearchResult(results, 'cover').file).toBe('File:Kiyomizu-dera portrait.jpg');
    // "wide": the 3 : 2 landscape, not the larger 4 : 1 panorama strip.
    expect(pickSearchResult(results, 'wide').file).toBe('File:Kiyomizu-dera landscape.jpg');
    // "any": the largest free file (the 8000×9000 NC one is rejected).
    expect(pickSearchResult(results, 'any').file).toBe('File:Kiyomizu-dera huge panorama.jpg');
    expect(pickSearchResult(results, 'wide').via).toBe('search');
  });

  it('skips files another slot already shows', () => {
    const exclude = new Set(['File:Kiyomizu-dera landscape.jpg']);
    expect(pickSearchResult(results, 'wide', { exclude }).file).toBe('File:Kiyomizu-dera huge panorama.jpg');
    expect(pickSearchResult([], 'wide')).toBeNull();
  });
});

describe('sanitizeLiveRecord (what comes back from localStorage)', () => {
  const good = verdict('File:Torii_path_at_dawn.jpg').record;

  it('keeps a well-formed record unchanged', () => {
    expect(sanitizeLiveRecord(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('rejects foreign image URLs and drops unsafe credit links', () => {
    expect(sanitizeLiveRecord({ ...good, url: 'https://example.com/a.jpg' })).toBeNull();
    expect(sanitizeLiveRecord({ ...good, mime: 'image/svg+xml' })).toBeNull();
    expect(sanitizeLiveRecord({ ...good, width: -1 })).toBeNull();
    expect(sanitizeLiveRecord(null)).toBeNull();
    const odd = sanitizeLiveRecord({ ...good, thumb: 'https://example.com/t.jpg', credit: { ...good.credit, sourceUrl: 'javascript:alert(1)', author: '' } });
    expect(odd.thumb).toBe('');
    expect(odd.credit.sourceUrl).toBe('');
    expect(odd.credit.author).toBe('Unknown author');
  });
});
