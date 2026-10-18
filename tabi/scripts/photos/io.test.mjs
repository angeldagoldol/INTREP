// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LOCK_STALE_MS,
  acquireLock,
  heartbeatLock,
  isOfflineError,
  loadGenerated,
  networkHint,
  politeFetch,
  proxyFromEnv,
  publishRecords,
  queryImageInfo,
  readJson,
  redactProxy,
  releaseLock,
  requestTrouble,
  routeUrl,
  saveGenerated,
  searchImageInfo,
  stopHint,
  testRoutes,
  userAgent,
} from './io.mjs';

/** A stand-in for politeFetch: answers from a list of JSON bodies and records the URLs asked for. */
function fakeApi(bodies) {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(new URL(url));
    const body = bodies[urls.length - 1];
    if (!body) throw new Error(`unexpected request ${urls.length}`);
    return { json: async () => body, headers: new Headers() };
  };
  return { urls, fetchImpl };
}

const imageinfo = (name) => [
  { width: 3000, height: 2000, mime: 'image/jpeg', url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}`, extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'A' } } },
];

describe('queryImageInfo', () => {
  it('follows "continue" until the batch is complete, then answers every title', async () => {
    const { urls, fetchImpl } = fakeApi([
      {
        continue: { iicontinue: 'B.jpg|20200101000000', continue: '||' },
        query: { pages: [{ title: 'File:A.jpg', imageinfo: imageinfo('A.jpg') }, { title: 'File:B.jpg' }] },
      },
      { batchcomplete: true, query: { pages: [{ title: 'File:A.jpg' }, { title: 'File:B.jpg', imageinfo: imageinfo('B.jpg') }] } },
    ]);
    const results = await queryImageInfo(['File:A.jpg', 'File:B.jpg', 'File:A.jpg'], { fetchImpl });
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get('iicontinue')).toBe('B.jpg|20200101000000');
    expect(urls[1].searchParams.get('titles')).toBe('File:A.jpg|File:B.jpg');
    expect(results.get('File:A.jpg').info.url).toMatch(/A\.jpg$/);
    expect(results.get('File:B.jpg').info.url).toMatch(/B\.jpg$/);
  });

  it('asks in batches of 50, one request at a time', async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `File:P${i}.jpg`);
    const bodies = [0, 1, 2].map(() => ({ batchcomplete: true, query: { pages: [] } }));
    let inFlight = 0;
    let most = 0;
    const { urls, fetchImpl } = fakeApi(bodies);
    const slow = async (url) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return fetchImpl(url);
    };
    const results = await queryImageInfo(titles, { fetchImpl: slow });
    expect(urls.map((u) => u.searchParams.get('titles').split('|').length)).toEqual([50, 50, 20]);
    expect(most).toBe(1);
    expect(results.get('File:P7.jpg')).toMatchObject({ missing: true });
  });

  it('gives up on endless continuation and reports API errors', async () => {
    const loop = { continue: { iicontinue: 'x', continue: '||' }, query: { pages: [] } };
    await expect(queryImageInfo(['File:A.jpg'], { fetchImpl: fakeApi([loop, loop, loop]).fetchImpl, maxRounds: 3 })).rejects.toThrow(/continue/);
    await expect(queryImageInfo(['File:A.jpg'], { fetchImpl: fakeApi([{ error: { code: 'badvalue', info: 'nope' } }]).fetchImpl })).rejects.toThrow(/badvalue: nope/);
  });

  it('identifies itself the way Wikimedia asks', () => {
    expect(userAgent()).toMatch(/^TabiBrochures-PhotoFetch\/1\.\d \(.+\) node\//);
  });
});

describe('the generated registry file', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tabi-registry-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('starts empty when missing, and round-trips sorted records without leaving temp files', async () => {
    const file = path.join(dir, 'photos.generated.json');
    expect(await loadGenerated(file)).toEqual({});
    await saveGenerated({ 'b-photo': { id: 'b-photo' }, 'a-photo': { id: 'a-photo' } }, file);
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['a-photo', 'b-photo']);
    expect(await loadGenerated(file)).toEqual({ 'a-photo': { id: 'a-photo' }, 'b-photo': { id: 'b-photo' } });
    expect(await readdir(dir)).toEqual(['photos.generated.json']);
  });

  it('refuses a damaged file instead of treating it as empty (which would wipe every record on save)', async () => {
    const file = path.join(dir, 'broken.json');
    await writeFile(file, '{ "a-photo": { "id": "a-ph');
    await expect(loadGenerated(file)).rejects.toThrow(/not valid JSON/);
    await writeFile(file, '[]');
    await expect(loadGenerated(file)).rejects.toThrow(/object of photo records/);
  });
});

describe('searchImageInfo — the search fallback', () => {
  const hit = (title, index, width = 4000, height = 2600) => ({ title, index, imageinfo: [{ ...imageinfo(title.slice(5))[0], width, height }] });

  it('asks for bitmap files with a 1920 px thumbnail, follows continuation while imageinfo is owed, and ranks by the search', async () => {
    const { urls, fetchImpl } = fakeApi([
      {
        continue: { iicontinue: 'B.jpg|2020', continue: 'gsroffset||' },
        query: { pages: [hit('File:B.jpg', 2), { title: 'File:A.jpg', index: 1 }] },
      },
      {
        batchcomplete: true,
        continue: { gsroffset: 20, continue: 'gsroffset||' },
        query: { pages: [{ title: 'File:B.jpg', index: 2 }, hit('File:A.jpg', 1)] },
      },
    ]);
    const { results, nextOffset } = await searchImageInfo('Kiyomizu-dera', { fetchImpl });
    expect(urls).toHaveLength(2);
    const first = Object.fromEntries(urls[0].searchParams);
    expect(first).toMatchObject({ generator: 'search', gsrnamespace: '6', gsrsearch: 'Kiyomizu-dera filetype:bitmap', gsrlimit: '20', iiurlwidth: '1920', maxlag: '5' });
    expect(urls[1].searchParams.get('iicontinue')).toBe('B.jpg|2020');
    expect(results.map((r) => [r.title, r.index])).toEqual([
      ['File:A.jpg', 1],
      ['File:B.jpg', 2],
    ]);
    expect(results[0].info.width).toBe(4000);
    // The next page is not fetched by itself: the caller asks for it only when nothing qualified.
    expect(nextOffset).toBe(20);
  });

  it('asks for a later page by offset', async () => {
    const { urls, fetchImpl } = fakeApi([{ batchcomplete: true, query: { pages: [hit('File:C.jpg', 21)] } }]);
    const { results, nextOffset } = await searchImageInfo('Takoyaki Osaka', { fetchImpl, offset: 20 });
    expect(urls[0].searchParams.get('gsroffset')).toBe('20');
    expect(results.map((r) => r.title)).toEqual(['File:C.jpg']);
    expect(nextOffset).toBeNull();
  });

  it('sends API requests one at a time, even when searches and lookups overlap', async () => {
    let inFlight = 0;
    let most = 0;
    const fetchImpl = async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { json: async () => ({ batchcomplete: true, query: { pages: [] } }), headers: new Headers() };
    };
    await Promise.all([
      searchImageInfo('a', { fetchImpl }),
      searchImageInfo('b', { fetchImpl }),
      queryImageInfo(['File:A.jpg'], { fetchImpl }),
    ]);
    expect(most).toBe(1);
  });
});

describe('network helpers', () => {
  it('routes Commons requests to a test server only when the test variables say so', () => {
    const api = 'https://commons.wikimedia.org/w/api.php?action=query&titles=File%3AA.jpg';
    const image = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/1920px-A.jpg';
    expect(testRoutes({})).toBeNull();
    expect(routeUrl(api, null)).toBe(api);
    const routes = testRoutes({ TABI_COMMONS_API: 'http://127.0.0.1:9/w/api.php', TABI_COMMONS_UPLOAD: 'http://127.0.0.1:9/' });
    expect(routeUrl(api, routes)).toBe('http://127.0.0.1:9/w/api.php?action=query&titles=File%3AA.jpg');
    expect(routeUrl(image, routes)).toBe('http://127.0.0.1:9/wikipedia/commons/thumb/a/ab/A.jpg/1920px-A.jpg');
    expect(routeUrl('https://example.org/x', routes)).toBe('https://example.org/x');
  });

  it('tells "no internet" apart from an answer it did not like', () => {
    const offline = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND commons.wikimedia.org'), { code: 'ENOTFOUND' }) });
    expect(isOfflineError(offline)).toBe(true);
    expect(isOfflineError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isOfflineError(Object.assign(new Error('HTTP 404'), { status: 404 }))).toBe(false);
    expect(isOfflineError(new Error('Commons API error badvalue'))).toBe(false);
    expect(networkHint(offline)).toMatch(/Could not reach Wikimedia Commons \(ENOTFOUND\)[\s\S]*npm run photos:fetch/);
  });

  it('explains a network filter that replaces HTTPS certificates, with the Windows and macOS commands', () => {
    const cert = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }) });
    expect(isOfflineError(cert)).toBe(true);
    const hint = networkHint(cert);
    expect(hint).toMatch(/NODE_EXTRA_CA_CERTS=\/path\/to\/cert\.pem npm run photos:fetch/);
    expect(hint).toMatch(/\$env:NODE_EXTRA_CA_CERTS=/);
  });

  it('tells a file Commons has no good copy of apart from Commons turning the download away or asking it to slow down', () => {
    const http = (status) => Object.assign(new Error(`HTTP ${status}`), { status, url: 'https://upload.wikimedia.org/x.jpg' });
    expect([401, 403, 407, 451].map((s) => requestTrouble(http(s)))).toEqual(['refused', 'refused', 'refused', 'refused']);
    expect(requestTrouble(http(429))).toBe('throttled');
    expect(requestTrouble(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))).toBe('throttled');
    expect(requestTrouble(http(503))).toBe('server');
    expect(requestTrouble(http(404))).toBeNull();
    expect(requestTrouble(new Error('Input buffer contains unsupported image format'))).toBeNull();
    expect(stopHint(http(403))).toMatch(/turned the download away \(HTTP 403 from upload\.wikimedia\.org\)[\s\S]*PHOTOS_CONTACT=you@example\.com npm run photos:fetch[\s\S]*\$env:PHOTOS_CONTACT=/);
    expect(stopHint(http(407))).toMatch(/proxy wants a user name and password/);
    expect(stopHint(http(429))).toMatch(/busy and asked the download to slow down \(HTTP 429/);
    expect(stopHint(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))).toMatch(/answered too slowly/);
    expect(stopHint(http(503))).toMatch(/had trouble answering \(HTTP 503 from upload\.wikimedia\.org\)[\s\S]*carries on where it stopped/);
  });

  it('names the host, not the whole URL, in HTTP errors, and does not retry a refusal', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response('Please respect our robot policy', { status: 403 });
    };
    const url = `https://refused.example/w/api.php?titles=${'File:A long title.jpg|'.repeat(40)}`;
    const error = await politeFetch(url, { fetchImpl }).catch((e) => e);
    expect(error.message).toBe('HTTP 403 from refused.example');
    expect(error).toMatchObject({ status: 403, url });
    expect(calls).toBe(1);
  });

  it('honours Retry-After for every request to that host, not only the one that was told', async () => {
    const seen = [];
    const start = Date.now();
    const fetchImpl = async (url) => {
      seen.push({ url, at: Date.now() - start });
      if (seen.length === 1) return new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } });
      return new Response('ok');
    };
    const first = politeFetch('https://busy.example/a.jpg', { fetchImpl });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = politeFetch('https://busy.example/b.jpg', { fetchImpl });
    const other = politeFetch('https://calm.example/c.jpg', { fetchImpl });
    await Promise.all([first, second, other]);
    const at = (name) => seen.filter((s) => s.url.endsWith(name)).map((s) => s.at);
    expect(at('a.jpg')).toHaveLength(2);
    expect(at('a.jpg')[1]).toBeGreaterThanOrEqual(950);
    expect(at('b.jpg')[0]).toBeGreaterThanOrEqual(950); // waited although it was never told itself
    expect(at('c.jpg')[0]).toBeLessThan(500); // another host is not held up
  });

  it('reads the proxy from the environment and explains what to do when Node cannot use it', () => {
    expect(proxyFromEnv({})).toBe('');
    expect(proxyFromEnv({ https_proxy: 'http://proxy:3128' })).toBe('http://proxy:3128');
    expect(proxyFromEnv({ HTTPS_PROXY: 'http://a:1', HTTP_PROXY: 'http://b:2' })).toBe('http://a:1');
    expect(redactProxy('http://user:secret@proxy.example:3128')).toBe('http://user:***@proxy.example:3128');
    expect(networkHint(new Error('x'), { proxy: 'unused' })).toMatch(/NODE_USE_ENV_PROXY=1/);
  });
});

describe('the download’s own files', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tabi-fetch-state-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('publishes a batch into the registry as it is on disk now, keeping records another tool added', async () => {
    const file = path.join(dir, 'photos.generated.json');
    await saveGenerated({ 'local-photo': { id: 'local-photo', file: 'local:me.jpg' } }, file);
    const merged = await publishRecords({ 'b-photo': { id: 'b-photo' }, 'a-photo': { id: 'a-photo' } }, file);
    expect(Object.keys(merged).sort()).toEqual(['a-photo', 'b-photo', 'local-photo']);
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['a-photo', 'b-photo', 'local-photo']);
  });

  it('holds one lock at a time and takes over a lock left by a process that is gone', async () => {
    const lock = path.join(dir, 'lock.json');
    expect(await acquireLock(lock)).toBe(true);
    expect(await acquireLock(lock)).toBe(true); // ours already
    await writeFile(lock, JSON.stringify({ pid: process.ppid, at: Date.now() }));
    expect(await acquireLock(lock)).toBe(false); // a live process (our parent) holds it
    await writeFile(lock, JSON.stringify({ pid: process.ppid, at: Date.now() - LOCK_STALE_MS - 1 }));
    expect(await acquireLock(lock)).toBe(true); // not refreshed for a minute: that download died
    await writeFile(lock, JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() }));
    expect(await acquireLock(lock)).toBe(true); // its process is gone
    await writeFile(lock, JSON.stringify({ pid: process.pid, at: 1 }));
    await heartbeatLock(lock);
    expect((await readJson(lock, {})).at).toBeGreaterThan(Date.now() - 5000);
    await releaseLock(lock);
    expect(await readJson(lock, 'none')).toBe('none');
  });

  it('reads its state files leniently', async () => {
    const file = path.join(dir, 'state.json');
    expect(await readJson(file, { empty: true })).toEqual({ empty: true });
    await writeFile(file, 'not json');
    expect(await readJson(file, {})).toEqual({});
  });
});
