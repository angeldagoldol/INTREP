import { afterEach, describe, expect, it, vi } from 'vitest';
import imageinfo from './fixtures/live-imageinfo.json';
import search from './fixtures/live-search.json';
import continued1 from './fixtures/live-continue-1.json';
import continued2 from './fixtures/live-continue-2.json';
import { LIVE_CACHE_KEY, LIVE_FAIL_TTL_MS, LIVE_TTL_MS, createLivePhotos, liveSlots } from './live.js';

/** Every file page in the fixtures, by title. */
const FILES = Object.fromEntries([...imageinfo.query.pages, ...search.query.pages].filter((p) => p.imageinfo).map((p) => [p.title, p]));
const TORII = 'File:Torii path at dawn.jpg';
const PAGODA = 'File:Pagoda portrait.jpg';
const NC = 'File:Maple noncommercial.jpg';
const MISSING = 'File:Does not exist anywhere.jpg';

/** A Commons API stand-in: answers imageinfo for known titles (missing otherwise) and canned searches. */
function fakeCommons({ files = FILES, searches = {}, respond } = {}) {
  const calls = [];
  const fetch = vi.fn(async (url) => {
    const u = new URL(url);
    calls.push(u.searchParams);
    if (respond) return respond(u.searchParams, calls.length);
    const p = u.searchParams;
    let pages;
    if (p.get('generator') === 'search') {
      const query = p.get('gsrsearch').replace(/ filetype:bitmap$/, '');
      pages = (searches[query] ?? []).map((title, i) => ({ ...files[title], index: i + 1 }));
    } else {
      pages = p.get('titles').split('|').map((title) => files[title] ?? { ns: 6, title, missing: true });
    }
    return { ok: true, status: 200, json: async () => ({ batchcomplete: true, query: { pages } }) };
  });
  return { fetch, calls };
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => JSON.parse(data.get(LIVE_CACHE_KEY) ?? 'null'),
  };
}

const manifest = (photos) => ({ './manifest/test.json': { brochure: 'test', photos } });

/** Lets queued batches (and their follow-up rounds) run to the end. */
async function settle(rounds = 30) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function setup({ photos, commons = fakeCommons(), storage = memoryStorage(), ...options }) {
  const live = createLivePhotos({ slots: liveSlots(manifest(photos)), fetch: commons.fetch, storage, ...options });
  return { live, commons, storage };
}

afterEach(() => vi.restoreAllMocks());

describe('liveSlots', () => {
  it('normalises candidates (curated file first), keeps the query and skips bundled or empty slots', () => {
    const slots = liveSlots(
      manifest([
        { id: 'a', use: 'cover', file: 'File:Torii_path_at_dawn.jpg', candidates: ['File:Other.jpg', 'File:Torii path at dawn.jpg'], query: 'torii' },
        { id: 'b', candidates: [], query: '' },
        { id: 'c', candidates: ['File:C.jpg'] },
      ]),
      { skip: (id) => id === 'c' },
    );
    expect([...slots.keys()]).toEqual(['a']);
    expect(slots.get('a')).toMatchObject({ use: 'cover', titles: [TORII, 'File:Other.jpg'], query: 'torii' });
    expect(slots.get('a').sig).toMatch(/^[0-9a-z]+$/);
  });
});

describe('createLivePhotos', () => {
  it('sends the slots asked for in the same tick as one request, and serves Commons thumbnails', async () => {
    const { live, commons } = setup({
      photos: [
        { id: 'a', use: 'wide', candidates: [TORII] },
        { id: 'b', use: 'cover', candidates: [PAGODA] },
        { id: 'c', use: 'any', candidates: [TORII] },
      ],
    });
    live.request(['a']);
    live.request(['b', 'c', 'a']);
    expect(live.status('a')).toBe('idle');
    await settle();
    expect(commons.fetch).toHaveBeenCalledTimes(1);
    const params = commons.calls[0];
    expect(params.get('titles').split('|')).toEqual([TORII, PAGODA]); // asked once each
    expect(params.get('origin')).toBe('*');
    expect(commons.fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', mode: 'cors' });
    expect(live.status('a')).toBe('ready');
    const a = live.get('a');
    expect(a).toMatchObject({ file: TORII, width: 4000, height: 2667, widths: [500, 960, 1280, 1920], via: 'candidate' });
    expect(a.srcSet).toContain('/1920px-Torii_path_at_dawn.jpg 1920w');
    expect(a.credit).toMatchObject({ author: 'Jane', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Torii_path_at_dawn.jpg' });
    expect(live.get('b').widths).toEqual([500, 960, 1200]);
    expect(live.get('a')).toBe(a); // stable identity for re-renders
    expect(live.stats()).toMatchObject({ requests: 1, batches: 1 });
  });

  it('puts at most 50 titles in a request', async () => {
    const photos = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, candidates: [`File:Photo ${i}.jpg`] }));
    const { live, commons } = setup({ photos });
    live.request(photos.map((p) => p.id));
    await settle();
    // Round 1 (first candidates) needs two requests; nothing exists, and no slot has a query.
    expect(commons.calls.map((p) => p.get('titles').split('|').length)).toEqual([50, 10]);
    expect(live.status('p0')).toBe('failed');
  });

  it('tries the other candidates next, then a Commons search, in as few requests as it can', async () => {
    const commons = fakeCommons({ searches: { 'Kiyomizu-dera': ['File:Kiyomizu-dera landscape.jpg', 'File:Kiyomizu-dera portrait.jpg'], nothing: [] } });
    const { live } = setup({
      commons,
      photos: [
        { id: 'x', use: 'wide', candidates: [NC, TORII] },
        { id: 'y', use: 'cover', candidates: [MISSING], query: 'Kiyomizu-dera' },
        { id: 'z', use: 'wide', query: 'nothing' },
        { id: 'w', use: 'wide', candidates: [TORII] },
      ],
    });
    const seen = [];
    live.subscribe(() => seen.push(live.snapshot(['x', 'y', 'z', 'w'])));
    live.request(['x', 'y', 'z', 'w']);
    await settle();
    // 1: first candidates (NC, MISSING, TORII) · 2: x's second candidate · 3–4: searches for y and z.
    expect(commons.calls).toHaveLength(4);
    expect(commons.calls[0].get('titles').split('|')).toEqual([NC, MISSING, TORII]);
    expect(commons.calls[1].get('titles')).toBe(TORII);
    expect(commons.calls.slice(2).map((p) => p.get('gsrsearch'))).toEqual(['Kiyomizu-dera filetype:bitmap', 'nothing filetype:bitmap']);
    expect(live.get('x').file).toBe(TORII);
    expect(live.get('y')).toMatchObject({ file: 'File:Kiyomizu-dera portrait.jpg', via: 'search' }); // the portrait suits a cover
    expect(live.status('z')).toBe('failed');
    expect(live.get('z')).toBeNull();
    // Early results are shown before the search round finishes.
    expect(seen.some((s) => s.endsWith('lllr'))).toBe(true);
  });

  it('follows "continue" until Commons has sent every file', async () => {
    const commons = fakeCommons({ respond: (p) => ({ ok: true, status: 200, json: async () => (p.has('iistart') ? continued2 : continued1) }) });
    const { live } = setup({ commons, photos: [{ id: 'one', use: 'cover', candidates: ['File:Continued one.jpg'] }] });
    live.request(['one']);
    await settle();
    expect(commons.calls).toHaveLength(2);
    expect(commons.calls[1].get('iistart')).toBe('20200101000000');
    expect(live.get('one')).toMatchObject({ file: 'File:Continued one.jpg', widths: [500, 960, 1280, 1920] });
  });

  it('remembers results on this device: a reload asks Commons nothing', async () => {
    const storage = memoryStorage();
    const photos = [
      { id: 'a', candidates: [TORII] },
      { id: 'gone', candidates: [MISSING] },
    ];
    const first = setup({ photos, storage });
    first.live.request(['a', 'gone']);
    await settle();
    const saved = storage.dump();
    expect(saved.v).toBe(1);
    expect(Object.keys(saved.photos).sort()).toEqual(['a', 'gone']);
    expect(saved.photos.gone.fail).toBe(1);

    const second = setup({ photos, storage });
    expect(second.live.get('a')).toMatchObject({ file: TORII });
    second.live.request(['a', 'gone']);
    await settle();
    expect(second.commons.fetch).not.toHaveBeenCalled();
    expect(second.live.status('gone')).toBe('failed');
    expect(second.live.stats().cached).toBe(2);
  });

  it('looks photos up again after 30 days, and slots with nothing usable after a day', async () => {
    const storage = memoryStorage();
    let time = Date.UTC(2026, 9, 1);
    const now = () => time;
    const photos = [
      { id: 'a', candidates: [TORII] },
      { id: 'gone', candidates: [MISSING] },
    ];
    setup({ photos, storage, now }).live.request(['a', 'gone']);
    await settle();

    time += LIVE_FAIL_TTL_MS + 1;
    const dayLater = setup({ photos, storage, now });
    dayLater.live.request(['a', 'gone']);
    await settle();
    expect(dayLater.commons.calls.map((p) => p.get('titles'))).toEqual([MISSING]);

    time += LIVE_TTL_MS;
    const monthLater = setup({ photos, storage, now });
    expect(monthLater.live.get('a')).toBeNull();
    monthLater.live.request(['a']);
    await settle();
    expect(monthLater.commons.calls.map((p) => p.get('titles'))).toEqual([TORII]);
  });

  it('forgets a slot whose candidates or query changed in the manifest', async () => {
    const storage = memoryStorage();
    setup({ photos: [{ id: 'a', candidates: [TORII] }], storage }).live.request(['a']);
    await settle();
    const edited = setup({ photos: [{ id: 'a', candidates: [PAGODA, TORII] }], storage });
    expect(edited.live.get('a')).toBeNull();
    edited.live.request(['a']);
    await settle();
    expect(edited.live.get('a').file).toBe(PAGODA);
  });

  it('asks nothing while offline, then catches up when the browser is back online', async () => {
    let online = false;
    const { live, commons } = setup({ photos: [{ id: 'a', candidates: [TORII] }], online: () => online });
    live.request(['a']);
    await settle();
    expect(commons.fetch).not.toHaveBeenCalled();
    expect(live.status('a')).toBe('off');
    online = true;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(commons.fetch).toHaveBeenCalledTimes(1);
    expect(live.status('a')).toBe('ready');
  });

  it('fails once and quietly when requests are blocked (no network, a CSP)', async () => {
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const commons = fakeCommons({
      respond: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const { live } = setup({ commons, photos: [{ id: 'a', candidates: [TORII] }, { id: 'b', candidates: [PAGODA] }, { id: 'c', candidates: [TORII], query: 'x' }] });
    live.request(['a', 'b']);
    await settle();
    expect(commons.fetch).toHaveBeenCalledTimes(1);
    expect(live.status('a')).toBe('off');
    expect(live.get('a')).toBeNull();
    expect(live.snapshot(['a'])).toBe('11:o');
    live.request(['c']);
    await settle();
    expect(commons.fetch).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps HTTP and API errors in memory only, so the next visit tries again', async () => {
    const storage = memoryStorage();
    const busy = fakeCommons({ respond: (p, n) => (n === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ error: { code: 'maxlag', info: 'Waiting' } }) }) });
    const first = setup({ commons: busy, storage, photos: [{ id: 'a', candidates: [TORII] }, { id: 'b', candidates: [PAGODA] }] });
    first.live.request(['a']);
    await settle();
    first.live.request(['b']);
    await settle();
    expect(first.live.status('a')).toBe('failed');
    expect(first.live.status('b')).toBe('failed');
    expect(storage.dump()?.photos ?? {}).toEqual({});
    const second = setup({ storage, photos: [{ id: 'a', candidates: [TORII] }] });
    second.live.request(['a']);
    await settle();
    expect(second.live.status('a')).toBe('ready');
  });

  it('shows and asks for nothing while the visitor has switched live photos off', async () => {
    let enabled = false;
    let onChange = () => {};
    const { live, commons } = setup({
      photos: [{ id: 'a', candidates: [TORII] }],
      enabled: () => enabled,
      subscribeEnabled: (fn) => {
        onChange = fn;
      },
    });
    live.request(['a']);
    await settle();
    expect(commons.fetch).not.toHaveBeenCalled();
    expect(live.status('a')).toBe('off');
    enabled = true;
    onChange();
    await settle();
    expect(live.get('a')).not.toBeNull();
    enabled = false;
    onChange();
    expect(live.get('a')).toBeNull();
  });

  it('stops live images for the session after three fail to load before any succeeds', async () => {
    const photos = ['a', 'b', 'c', 'd'].map((id) => ({ id, candidates: [TORII] }));
    const { live } = setup({ photos });
    live.request(photos.map((p) => p.id));
    await settle();
    live.reportImageError('a');
    expect(live.get('a')).toBeNull();
    expect(live.get('d')).not.toBeNull();
    live.reportImageError('b');
    live.reportImageError('c');
    expect(live.get('d')).toBeNull();
    expect(live.status('d')).toBe('off');
  });

  it('stops a batch already out when the visitor switches live photos off: requests aborted, nothing more asked', async () => {
    let enabled = true;
    let onChange = () => {};
    const signals = [];
    // Commons is slow to answer; the request only ends when it is aborted.
    const fetch = vi.fn(
      (url, init) =>
        new Promise((resolve, reject) => {
          signals.push(init.signal);
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const storage = memoryStorage();
    const live = createLivePhotos({
      slots: liveSlots(manifest([{ id: 'a', candidates: [NC, TORII], query: 'x' }])),
      fetch,
      storage,
      enabled: () => enabled,
      subscribeEnabled: (fn) => {
        onChange = fn;
      },
    });
    live.request(['a']);
    await settle(3);
    expect(fetch).toHaveBeenCalledTimes(1);
    enabled = false;
    onChange();
    expect(signals[0].aborted).toBe(true);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1); // no round 2, no search
    expect(live.status('a')).toBe('off');
    expect(storage.dump()?.photos ?? {}).toEqual({}); // nothing was decided about the slot
    // Switched back on, the slot is looked up from the start.
    fetch.mockImplementation(fakeCommons().fetch);
    enabled = true;
    onChange();
    await settle();
    expect(live.get('a').file).toBe(TORII);
  });

  it('saves each round as it ends, so a reload in the middle of a batch keeps what was found', async () => {
    const storage = memoryStorage();
    let calls = 0;
    const commons = fakeCommons();
    const fetch = vi.fn((url, init) => {
      calls += 1;
      // The search (round 3) never answers: the visitor reloads first.
      return new URL(url).searchParams.get('generator') === 'search' ? new Promise(() => {}) : commons.fetch(url, init);
    });
    const photos = [
      { id: 'a', candidates: [TORII] },
      { id: 'b', candidates: [NC, PAGODA] },
      { id: 'c', candidates: [MISSING], query: 'slow' },
    ];
    const first = createLivePhotos({ slots: liveSlots(manifest(photos)), fetch, storage });
    first.request(['a', 'b', 'c']);
    await settle();
    expect(calls).toBe(3);
    expect(first.status('c')).toBe('loading');
    const saved = storage.dump();
    expect(Object.keys(saved.photos).sort()).toEqual(['a', 'b']);
    const second = setup({ photos, storage });
    expect(second.live.get('a').file).toBe(TORII);
    expect(second.live.get('b').file).toBe(PAGODA);
  });

  it('asks the API nothing more once live images are known not to load (an img-src CSP)', async () => {
    const photos = ['a', 'b', 'c'].map((id) => ({ id, candidates: [TORII] }));
    const { live, commons } = setup({ photos: [...photos, { id: 'later', candidates: [PAGODA] }] });
    live.request(photos.map((p) => p.id));
    await settle();
    for (const p of photos) live.reportImageError(p.id);
    live.request(['later']);
    await settle();
    expect(commons.fetch).toHaveBeenCalledTimes(1);
    expect(live.status('later')).toBe('off');
  });

  it('never shows the same search result in two slots', async () => {
    const commons = fakeCommons({ searches: { torii: ['File:Kiyomizu-dera landscape.jpg', 'File:Kiyomizu-dera huge panorama.jpg'] } });
    const { live } = setup({ commons, concurrency: 1, photos: [{ id: 'a', use: 'wide', query: 'torii' }, { id: 'b', use: 'wide', query: 'torii' }] });
    live.request(['a', 'b']);
    await settle();
    expect(new Set([live.get('a').file, live.get('b').file]).size).toBe(2);
  });

  it('has a snapshot that changes only when the ids it covers do', async () => {
    const { live } = setup({ photos: [{ id: 'a', candidates: [TORII] }, { id: 'b', candidates: [PAGODA] }] });
    const before = live.snapshot(['a']);
    expect(before).toBe('10:i');
    expect(live.snapshot(['nope'])).toBe('10:n');
    live.request(['b']);
    await settle();
    expect(live.snapshot(['a'])).toBe(before);
    expect(live.snapshot('a\nb')).toBe('10:ir');
  });

  it('reports its health for the photo notice: what was asked, found, failed, and why nothing is asked', async () => {
    let online = true;
    const blocked = fakeCommons({
      respond: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const { live } = setup({ commons: blocked, online: () => online, photos: [{ id: 'a', candidates: [TORII] }, { id: 'b', candidates: [PAGODA] }] });
    expect(live.health()).toMatchObject({ asked: 0, ready: 0, enabled: true, online: true, blocked: false, transport: true });
    live.request(['a', 'b', 'not-a-slot']);
    await settle();
    expect(live.health()).toMatchObject({ asked: 2, ready: 0, waiting: 2, blocked: true });
    online = false;
    expect(live.health()).toMatchObject({ online: false });

    const ok = setup({ photos: [{ id: 'a', candidates: [TORII] }, { id: 'm', candidates: [MISSING] }] });
    ok.live.request(['a', 'm']);
    await settle();
    expect(ok.live.health()).toMatchObject({ asked: 2, ready: 1, failed: 1, loading: 0, waiting: 0, blocked: false });
    expect(setup({ fetch: null, photos: [] }).live.health().transport).toBe(false);
  });
});

