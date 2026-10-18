// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  attributionRequired,
  authorCredit,
  buildRecord,
  candidateTitles,
  chunk,
  classifyLicense,
  cleanLicenseUrl,
  commonsPageUrl,
  contactSheetLayout,
  evaluateCandidate,
  firstLink,
  htmlToText,
  httpUrl,
  imageInfoUrl,
  licenseUrlFor,
  matchesOnly,
  mergeQueryResponses,
  normalizeFileTitle,
  outputName,
  ownsOutput,
  parseArgs,
  parseImageInfoResponse,
  planWidths,
  readManifest,
  retryDelay,
  apiError,
  thumbStep,
  toHex,
  workTitle,
  xmlEscape,
} from './lib.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('normalizeFileTitle', () => {
  it.each([
    ['File:Fushimi Inari-taisha, Senbon Torii.jpg', 'File:Fushimi Inari-taisha, Senbon Torii.jpg'],
    ['Fushimi_Inari-taisha,_Senbon_Torii.jpg', 'File:Fushimi Inari-taisha, Senbon Torii.jpg'],
    ['file:fushimi inari.JPG', 'File:Fushimi inari.JPG'],
    ['Image:Kinkaku-ji.jpg', 'File:Kinkaku-ji.jpg'],
    ['https://commons.wikimedia.org/wiki/File:Kiyomizu-dera_in_Kyoto.jpg', 'File:Kiyomizu-dera in Kyoto.jpg'],
    ['https://commons.m.wikimedia.org/wiki/File:Kiyomizu-dera_in_Kyoto.jpg#/media/x', 'File:Kiyomizu-dera in Kyoto.jpg'],
    ['https://commons.wikimedia.org/w/index.php?title=File:Kinkaku-ji_2023.jpg&oldid=1', 'File:Kinkaku-ji 2023.jpg'],
    ['https://en.wikipedia.org/wiki/File:Itsukushima_torii.jpg', 'File:Itsukushima torii.jpg'],
    ['https://commons.wikimedia.org/wiki/File:%E4%BC%8F%E8%A6%8B%E7%A8%B2%E8%8D%B7%E5%A4%A7%E7%A4%BE.jpg', 'File:伏見稲荷大社.jpg'],
    ['https://upload.wikimedia.org/wikipedia/commons/a/ab/Senbon_Torii_%28Fushimi%29.jpg', 'File:Senbon Torii (Fushimi).jpg'],
    ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Senbon_Torii.jpg/1280px-Senbon_Torii.jpg', 'File:Senbon Torii.jpg'],
    ['//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Shibuya.png/800px-Shibuya.png', 'File:Shibuya.png'],
    ['  File:  Two  spaces.jpg ', 'File:Two spaces.jpg'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeFileTitle(input)).toBe(expected);
  });

  it.each([[''], [null], [42], ['https://example.com/photo.jpg'], ['File:No extension'], ['File:Bad|pipe.jpg'], ['https://commons.wikimedia.org/wiki/Main_Page']])(
    'rejects %s',
    (input) => {
      expect(normalizeFileTitle(input)).toBeNull();
    },
  );

  it('builds file page URLs', () => {
    expect(commonsPageUrl('File:Fushimi Inari-taisha, Senbon Torii (1).jpg')).toBe('https://commons.wikimedia.org/wiki/File:Fushimi_Inari-taisha,_Senbon_Torii_(1).jpg');
    expect(commonsPageUrl('nonsense')).toBeNull();
  });
});

describe('candidateTitles', () => {
  it('uses the chosen file alone, else the normalised, deduped candidates', () => {
    expect(candidateTitles({ file: 'A.jpg', candidates: ['B.jpg'] })).toEqual(['File:A.jpg']);
    expect(candidateTitles({ file: '', candidates: ['File:B.jpg', 'B.jpg', 'https://commons.wikimedia.org/wiki/File:C.jpg', 'junk'] })).toEqual(['File:B.jpg', 'File:C.jpg']);
    expect(candidateTitles({})).toEqual([]);
    expect(candidateTitles(null)).toEqual([]);
  });
});

describe('API requests', () => {
  it('batches titles by 50', () => {
    const titles = Array.from({ length: 120 }, (_, i) => `File:${i}.jpg`);
    expect(chunk(titles).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('asks for url, size, mime and credit metadata with a 1920px thumbnail and maxlag', () => {
    const url = new URL(imageInfoUrl(['File:A b.jpg', 'File:C.jpg']));
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php');
    expect(url.searchParams.get('titles')).toBe('File:A b.jpg|File:C.jpg');
    expect(url.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
    expect(url.searchParams.get('iiurlwidth')).toBe('1920');
    expect(url.searchParams.get('maxlag')).toBe('5');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('redirects')).toBe('1');
    for (const field of ['Artist', 'Attribution', 'Credit', 'LicenseShortName', 'LicenseUrl', 'License', 'UsageTerms', 'ObjectName', 'NonFree']) {
      expect(url.searchParams.get('iiextmetadatafilter').split('|')).toContain(field);
    }
  });

  it('only asks for standard thumbnail steps (other widths may be refused)', () => {
    expect(thumbStep(1920)).toBe(1920);
    expect(thumbStep(1600)).toBe(1920);
    expect(thumbStep(2048)).toBe(3840);
    expect(thumbStep(640)).toBe(960);
    expect(thumbStep(9000)).toBe(3840);
    expect(new URL(imageInfoUrl(['File:A.jpg'], { thumbWidth: 640 })).searchParams.get('iiurlwidth')).toBe('960');
  });

  it('passes continuation parameters back', () => {
    const url = new URL(imageInfoUrl(['File:A.jpg'], { cont: { iicontinue: 'A.jpg|20200101000000', continue: '||' } }));
    expect(url.searchParams.get('iicontinue')).toBe('A.jpg|20200101000000');
    expect(url.searchParams.get('continue')).toBe('||');
    expect(url.searchParams.get('titles')).toBe('File:A.jpg');
  });

  it('reads API errors and backs off politely', () => {
    expect(apiError({ error: { code: 'maxlag', info: 'Waiting for db: 7 seconds lagged', lag: 7 } })).toEqual({ code: 'maxlag', info: 'Waiting for db: 7 seconds lagged', lag: 7 });
    expect(apiError({ query: {} })).toBeNull();
    expect(retryDelay(0, '5')).toBe(5000);
    expect(retryDelay(0, '9999')).toBe(120_000);
    expect(retryDelay(0)).toBe(2000);
    expect(retryDelay(3)).toBe(16_000);
    expect(retryDelay(10)).toBe(60_000);
  });
});

describe('parseImageInfoResponse', () => {
  it('maps requested titles through normalisation and redirects (formatversion 2)', () => {
    const requested = ['File:Example_torii_gates.jpg', 'File:Old name of the pagoda.jpg', 'File:Does not exist anywhere.jpg', 'File:Never asked about.jpg'];
    const results = parseImageInfoResponse(fixture('imageinfo-v2.json'), requested);
    expect([...results.keys()]).toEqual(requested);
    const torii = results.get('File:Example_torii_gates.jpg');
    expect(torii.title).toBe('File:Example torii gates.jpg');
    expect(torii.info).toMatchObject({ width: 4000, height: 6000, mime: 'image/jpeg', thumbwidth: 2048 });
    expect(torii.info.extmetadata.LicenseShortName).toBe('CC BY-SA 4.0');
    expect(results.get('File:Old name of the pagoda.jpg').title).toBe('File:Example pagoda at dusk.jpg');
    expect(results.get('File:Does not exist anywhere.jpg')).toMatchObject({ missing: true, reason: 'no such file on Commons' });
    expect(results.get('File:Never asked about.jpg')).toMatchObject({ missing: true });
  });

  it('reads formatversion 1 (pages keyed by id, "" flags)', () => {
    const results = parseImageInfoResponse(fixture('imageinfo-v1.json'), ['File:example_lantern.jpg', 'File:Missing lantern.jpg', 'File:Bad|title.jpg']);
    expect(results.get('File:example_lantern.jpg')).toMatchObject({ title: 'File:Example lantern.jpg', missing: false });
    expect(results.get('File:Missing lantern.jpg')).toMatchObject({ missing: true });
    expect(results.get('File:Bad|title.jpg')).toMatchObject({ invalid: true, reason: expect.stringMatching(/invalid characters/) });
  });

  it('merges continuation rounds: imageinfo from a later round fills pages sent bare earlier', () => {
    const info = (name) => [{ width: 3000, height: 2000, mime: 'image/jpeg', url: `https://upload.wikimedia.org/x/${name}`, extmetadata: { LicenseShortName: { value: 'CC0' } } }];
    const first = {
      continue: { iicontinue: 'B.jpg|20200101000000', continue: '||' },
      query: {
        normalized: [{ from: 'File:a.jpg', to: 'File:A.jpg' }],
        pages: [
          { pageid: 1, title: 'File:A.jpg', imageinfo: info('A.jpg') },
          { pageid: 2, title: 'File:B.jpg' },
        ],
      },
    };
    const second = {
      batchcomplete: true,
      query: {
        normalized: [{ from: 'File:a.jpg', to: 'File:A.jpg' }],
        pages: [
          { pageid: 1, title: 'File:A.jpg' },
          { pageid: 2, title: 'File:B.jpg', imageinfo: info('B.jpg') },
        ],
      },
    };
    // Without the second round, B looks like a file with no information — not "missing".
    expect(parseImageInfoResponse(first, ['File:B.jpg']).get('File:B.jpg')).toMatchObject({ missing: false, info: undefined, reason: expect.stringMatching(/no file information/) });
    const merged = mergeQueryResponses([first, second]);
    expect(merged.query.normalized).toHaveLength(1);
    const results = parseImageInfoResponse(merged, ['File:a.jpg', 'File:B.jpg']);
    expect(results.get('File:a.jpg').info.url).toMatch(/A\.jpg$/);
    expect(results.get('File:B.jpg').info.url).toMatch(/B\.jpg$/);
    expect(evaluateCandidate(results.get('File:B.jpg')).ok).toBe(true);
  });

  it('treats a hidden (revision-deleted) file version as unusable', () => {
    const json = { query: { pages: [{ title: 'File:H.jpg', imageinfo: [{ filehidden: true }] }] } };
    expect(evaluateCandidate(parseImageInfoResponse(json).get('File:H.jpg'))).toMatchObject({ ok: false, reason: /hidden/ });
  });

  it('returns every page when no titles are given, and survives junk', () => {
    expect(parseImageInfoResponse(fixture('imageinfo-v2.json')).size).toBe(7);
    expect(parseImageInfoResponse(null).size).toBe(0);
    expect(parseImageInfoResponse({ query: { pages: [null, { title: 5 }] } }).size).toBe(0);
  });
});

describe('classifyLicense', () => {
  it.each([
    ['CC0', 'cc0'],
    ['Public domain', 'pd'],
    ['PD-self', 'pd'],
    ['CC BY 2.0', 'cc-by'],
    ['CC BY 4.0', 'cc-by'],
    ['CC BY-SA 3.0', 'cc-by-sa'],
    ['CC BY-SA 4.0', 'cc-by-sa'],
    ['CC BY-SA 2.1 jp', 'cc-by-sa'],
    ['CC BY-SA 3.0 igo', 'cc-by-sa'],
  ])('accepts %s', (name, kind) => {
    expect(classifyLicense(name)).toMatchObject({ ok: true, kind, label: name });
  });

  it.each([
    ['CC BY-NC 2.0'],
    ['CC BY-NC-SA 4.0'],
    ['CC BY-ND 4.0'],
    ['CC BY-NC-ND 2.1 jp'],
    ['Fair use'],
    ['All rights reserved'],
    ['GFDL'],
    ['No restrictions'],
    [''],
    [undefined],
  ])('rejects %s', (name) => {
    const result = classifyLicense(name);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects NonCommercial/NoDerivatives however they are spelled', () => {
    expect(classifyLicense('', { License: 'cc-by-nd-4.0' })).toMatchObject({ ok: false, kind: 'restricted' });
    expect(classifyLicense('CC BY-SA 4.0', { UsageTerms: 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0' })).toMatchObject({ ok: false, kind: 'restricted' });
    expect(classifyLicense('CC BY 2.0', { UsageTerms: 'Attribution-NoDerivs 2.0 Generic' })).toMatchObject({ ok: false, kind: 'restricted' });
  });

  it('knows each accepted licence’s deed', () => {
    expect(classifyLicense('CC BY-SA 4.0')).toMatchObject({ version: '4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    expect(classifyLicense('CC BY 2.0')).toMatchObject({ url: 'https://creativecommons.org/licenses/by/2.0/' });
    expect(classifyLicense('CC BY-SA 2.1 jp')).toMatchObject({ port: 'jp', url: 'https://creativecommons.org/licenses/by-sa/2.1/jp/' });
    expect(classifyLicense('', { License: 'cc-by-sa-3.0-de' })).toMatchObject({ url: 'https://creativecommons.org/licenses/by-sa/3.0/de/' });
    expect(classifyLicense('CC0')).toMatchObject({ url: 'https://creativecommons.org/publicdomain/zero/1.0/' });
    expect(classifyLicense('CC BY-SA')).toMatchObject({ ok: true, url: '' });
    expect(licenseUrlFor('pd')).toBe('');
    expect(licenseUrlFor('cc-by', '4.0', '<x>')).toBe('https://creativecommons.org/licenses/by/4.0/');
  });

  it('falls back to the machine-readable License field and honours NonFree', () => {
    expect(classifyLicense('', { License: 'cc-by-sa-4.0' })).toMatchObject({ ok: true, kind: 'cc-by-sa' });
    expect(classifyLicense('', { License: 'pd' })).toMatchObject({ ok: true, kind: 'pd' });
    expect(classifyLicense('', { License: 'cc-by-nc-2.0' })).toMatchObject({ ok: false });
    expect(classifyLicense('CC BY 4.0', { NonFree: 'true' })).toMatchObject({ ok: false, kind: 'nonfree' });
  });

  it('knows when attribution is required', () => {
    expect(attributionRequired('cc-by-sa')).toBe(true);
    expect(attributionRequired('cc-by', { AttributionRequired: 'false' })).toBe(true);
    expect(attributionRequired('pd', { AttributionRequired: 'false' })).toBe(false);
    expect(attributionRequired('cc0', { AttributionRequired: 'true' })).toBe(true);
  });
});

describe('credits', () => {
  it('turns Commons HTML into plain text', () => {
    expect(htmlToText('<bdi><a href="//commons.wikimedia.org/wiki/User:A" title="User:A">Example&nbsp;Photographer</a></bdi>')).toBe('Example Photographer');
    expect(htmlToText('<div class="fn value">\n<a href="x">Hokusai</a> (1760&#8211;1849)\n</div>')).toBe('Hokusai (1760–1849)');
    expect(htmlToText('Tom &amp; Jerry &#x6771;&#20140; <script>alert(1)</script>&bogus;')).toBe('Tom & Jerry 東京 &bogus;');
    expect(htmlToText(undefined)).toBe('');
  });

  it('finds the author link, absolute and https, skipping talk pages', () => {
    expect(firstLink('<a href="//commons.wikimedia.org/wiki/User:Example_Photographer">x</a>')).toBe('https://commons.wikimedia.org/wiki/User:Example_Photographer');
    expect(firstLink('<a href="/wiki/User:Edo">Edo</a>')).toBe('https://commons.wikimedia.org/wiki/User:Edo');
    expect(firstLink("<a class='external' href='https://www.flickr.com/people/example/'>x</a>")).toBe('https://www.flickr.com/people/example/');
    expect(firstLink('Edo (<a href="/wiki/User_talk:Edo">talk</a>)')).toBeNull();
    expect(firstLink('<a href="javascript:alert(1)">x</a>')).toBeNull();
    expect(firstLink('<a href="/w/index.php?title=User:X&action=edit&redlink=1">X</a>')).toBeNull();
    expect(firstLink('plain text')).toBeNull();
  });

  it('cleans author credits', () => {
    expect(authorCredit({ Artist: '江戸 太郎 (<a href="/wiki/User_talk:Edo">talk</a>)' })).toBe('江戸 太郎');
    expect(authorCredit({ Artist: '<span lang="en">Unknown author</span>' })).toBe('Unknown author');
    expect(authorCredit({ Credit: 'Photo: Jane Doe' })).toBe('Jane Doe');
    expect(authorCredit({})).toBe('Unknown author');
    expect(authorCredit({ Artist: 'x'.repeat(300) })).toHaveLength(118);
    expect(Array.from(authorCredit({ Artist: '📷'.repeat(200) }))).toHaveLength(118);
  });

  it('uses the attribution the author asked for, and never credits "Own work" as a name', () => {
    expect(authorCredit({ Attribution: 'Photo by <b>Jane Doe</b>', Artist: '<a href="/wiki/User:JD">JD</a>' })).toBe('Jane Doe');
    expect(authorCredit({ Attribution: '© Taro Yamada / CC BY-SA 4.0', Artist: 'Taro' })).toBe('© Taro Yamada / CC BY-SA 4.0');
    expect(authorCredit({ Credit: '<span class="int-own-work" lang="en">Own work</span>' })).toBe('Unknown author');
    expect(authorCredit({ Credit: 'Transferred from en.wikipedia' })).toBe('Unknown author');
    expect(authorCredit({ Artist: '<div>Jane</div><div>Doe Studio</div>' })).toBe('Jane Doe Studio');
  });

  it('keeps credits plain text: markup and control characters never survive', () => {
    const artist = '<img src=x onerror="alert(1)"><a href="javascript:alert(2)">Eve</a>&lt;script&gt;\u0007';
    const text = authorCredit({ Artist: artist });
    expect(text).toBe('Eve<script>');
    expect([...text].some((c) => c.charCodeAt(0) < 0x20)).toBe(false);
    expect(firstLink(artist)).toBeNull();
  });

  it('names the work for CC 2.0/3.0 credits', () => {
    expect(workTitle({ ObjectName: 'Senbon <i>Torii</i>' }, 'File:X.jpg')).toBe('Senbon Torii');
    expect(workTitle({}, 'File:Fushimi Inari, gates.jpeg')).toBe('Fushimi Inari, gates');
  });

  it('allows only http(s) links', () => {
    expect(httpUrl('https://commons.wikimedia.org/wiki/File:A.jpg')).toBe('https://commons.wikimedia.org/wiki/File:A.jpg');
    expect(httpUrl('//commons.wikimedia.org/wiki/File:A.jpg')).toBe('https://commons.wikimedia.org/wiki/File:A.jpg');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '/wiki/File:A.jpg', '', undefined]) expect(httpUrl(bad)).toBe('');
  });

  it('keeps licence links to http(s), upgrading creativecommons.org', () => {
    expect(cleanLicenseUrl('http://creativecommons.org/publicdomain/zero/1.0/deed.en')).toBe('https://creativecommons.org/publicdomain/zero/1.0/deed.en');
    expect(cleanLicenseUrl('javascript:alert(1)')).toBe('');
    expect(cleanLicenseUrl(undefined)).toBe('');
  });
});

describe('evaluateCandidate', () => {
  const results = parseImageInfoResponse(fixture('imageinfo-v2.json'));

  it('accepts a large CC BY-SA photo with a full credit', () => {
    const verdict = evaluateCandidate(results.get('File:Example torii gates.jpg'));
    expect(verdict).toMatchObject({ ok: true, title: 'File:Example torii gates.jpg' });
    expect(verdict.credit).toEqual({
      title: 'Example torii gates',
      author: 'Example Photographer',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Example_Photographer',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example_torii_gates.jpg',
      attributionRequired: true,
      restrictions: '',
    });
  });

  it('accepts public domain art without requiring attribution', () => {
    const verdict = evaluateCandidate(results.get('File:Example woodblock print of a mountain.jpg'));
    expect(verdict.ok).toBe(true);
    expect(verdict.credit).toMatchObject({ author: 'Example Printmaker (1760–1849)', license: 'Public domain', attributionRequired: false, licenseUrl: '' });
  });

  it('fills in the licence deed when Commons gives no LicenseUrl, and rejects a CC credit it cannot link', () => {
    const result = (ext) => ({ title: 'File:T.jpg', missing: false, invalid: false, info: { width: 3000, height: 2000, mime: 'image/jpeg', descriptionurl: 'javascript:alert(1)', extmetadata: ext } });
    expect(evaluateCandidate(result({ LicenseShortName: 'CC BY-SA 3.0', Artist: 'A' })).credit).toMatchObject({
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:T.jpg',
    });
    expect(evaluateCandidate(result({ LicenseShortName: 'CC BY-SA', Artist: 'A' }))).toMatchObject({ ok: false, reason: /no licence link/ });
  });

  it('explains every rejection', () => {
    expect(evaluateCandidate(results.get('File:Example noncommercial maple.jpg')).reason).toMatch(/NonCommercial/);
    expect(evaluateCandidate(results.get('File:Example small shrine.jpg')).reason).toMatch(/too small \(1200×800/);
    expect(evaluateCandidate(results.get('File:Example map of Kyoto.svg')).reason).toMatch(/not a photo/);
    expect(evaluateCandidate(results.get('File:Does not exist anywhere.jpg')).reason).toMatch(/no such file/);
    expect(evaluateCandidate(undefined).ok).toBe(false);
  });

  it('can relax the size floor', () => {
    expect(evaluateCandidate(results.get('File:Example small shrine.jpg'), { minLongEdge: 1000 })).toMatchObject({
      ok: true,
      credit: { license: 'CC0', author: 'Unknown author', attributionRequired: false },
    });
  });
});

describe('outputs', () => {
  it('plans widths without upscaling', () => {
    expect(planWidths(2048)).toEqual([480, 960, 1600]);
    expect(planWidths(1600)).toEqual([480, 960, 1600]);
    expect(planWidths(1200)).toEqual([480, 960, 1200]);
    expect(planWidths(1000)).toEqual([480, 960]);
    expect(planWidths(300)).toEqual([300]);
    expect(planWidths(0)).toEqual([]);
  });

  it('names files and recognises its own outputs', () => {
    expect(outputName('kyoto-senbon-torii', 960)).toBe('kyoto-senbon-torii-960.webp');
    expect(ownsOutput('kyoto-gate', 'kyoto-gate-960.webp')).toBe(true);
    expect(ownsOutput('kyoto-gate', 'kyoto-gate-2-960.webp')).toBe(false);
    expect(ownsOutput('kyoto-gate', 'kyoto-gate-960.jpg')).toBe(false);
  });

  it('formats colours and records', () => {
    expect(toHex({ r: 210, g: 58, b: 34 })).toBe('#d23a22');
    expect(toHex({ r: -4, g: 300, b: 7.6 })).toBe('#00ff08');
    const record = buildRecord({
      id: 'x',
      file: 'File:X.jpg',
      width: 1600,
      height: 1067,
      widths: [480, 960, 1600],
      lqip: 'data:image/webp;base64,AA',
      color: '#123456',
      credit: { author: 'A', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg', attributionRequired: true },
      fetchedAt: '2026-10-17T00:00:00.000Z',
    });
    expect(Object.keys(record)).toEqual([
      'id',
      'file',
      'width',
      'height',
      'widths',
      'lqip',
      'color',
      'title',
      'author',
      'authorUrl',
      'license',
      'licenseUrl',
      'sourceUrl',
      'attributionRequired',
      'fetchedAt',
    ]);
    expect(record.authorUrl).toBe('');
  });

  it('lays out contact sheets', () => {
    expect(contactSheetLayout(5, { tile: 100, label: 20, gap: 10, maxCols: 3 })).toMatchObject({ cols: 3, rows: 2, width: 340, height: 270 });
    expect(contactSheetLayout(1, { tile: 100, label: 20, gap: 10 }).cells).toEqual([{ x: 10, y: 10 }]);
    expect(xmlEscape('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
  });
});

describe('manifests and arguments', () => {
  it('checks manifests and reports problems', () => {
    const { photos, problems, brochure } = readManifest(
      { brochure: 'kyoto-thousand-gates', photos: [{ id: 'kyoto-senbon-torii', candidates: ['File:A.jpg'] }, { id: 'Bad Id' }, null, { id: 'kyoto-empty', candidates: [] }, { id: 'kyoto-search-only', query: 'Kiyomizu-dera' }] },
      'kyoto.json',
    );
    expect(brochure).toBe('kyoto-thousand-gates');
    // A slot with only a search query is fine: the download searches Commons for it.
    expect(photos.map((p) => p.id)).toEqual(['kyoto-senbon-torii', 'kyoto-empty', 'kyoto-search-only']);
    expect(problems).toEqual([
      'kyoto.json: photo 2 needs a kebab-case "id"',
      'kyoto.json: photo 3 is not an object',
      'kyoto.json: kyoto-empty has no usable "file", "candidates" or "query"',
    ]);
    expect(readManifest({}, 'x.json').problems).toEqual(['x.json: no "photos" array']);
  });

  it('matches --only against manifests, brochures and ids', () => {
    const slot = { manifest: 'kyoto', brochure: 'kyoto-thousand-gates', id: 'kyoto-senbon-torii' };
    expect(matchesOnly([], slot)).toBe(true);
    expect(matchesOnly(['kyoto'], slot)).toBe(true);
    expect(matchesOnly(['kyoto.json'], slot)).toBe(true);
    expect(matchesOnly(['kyoto-thousand-gates'], slot)).toBe(true);
    expect(matchesOnly(['kyoto-senbon-torii'], slot)).toBe(true);
    expect(matchesOnly(['tokyo'], slot)).toBe(false);
  });

  it('parses flags', () => {
    expect(parseArgs(['a.jpg', '--force', '--only', 'x', '--only=y', '--license-url', 'https://e.x'], { boolean: ['force'], string: ['only', 'license-url'] })).toEqual({
      _: ['a.jpg'],
      force: true,
      only: ['x', 'y'],
      licenseUrl: 'https://e.x',
    });
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/);
    expect(() => parseArgs(['--only'], { string: ['only'] })).toThrow(/needs a value/);
  });
});
