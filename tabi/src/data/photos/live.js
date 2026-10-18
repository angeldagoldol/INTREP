/**
 * Live photos: real photographs from Wikimedia Commons, looked up by the
 * visitor's browser when a photo slot has no bundled file
 * (photos.generated.json). No build step, no server: the Commons API answers
 * anonymous CORS requests (`origin=*`), and the pictures are Wikimedia's own
 * thumbnails on upload.wikimedia.org.
 *
 * For each slot (a manifest entry: id, use, candidates, query) the resolver
 * takes the first candidate that passes the policy (commons.js: exists, free
 * licence, ≥ 1600 px, JPEG/PNG/WebP), else the best Commons search result for
 * the slot's `query` (shape for its `use`, then size). Slots requested in the
 * same tick go out together, in rounds that keep requests few:
 *   1. the first candidate of every slot (≤ 50 titles per request),
 *   2. every other candidate of the slots still without a photo,
 *   3. one search per slot still without a photo.
 * Results are kept in memory and in localStorage (`tabi:live-photos:v1`:
 * photos for 30 days, "nothing usable" for a day), keyed by a signature of
 * the slot's candidates and query, so editing a manifest refreshes its slot;
 * each round's finds are saved as soon as the round ends.
 *
 * It never asks while the visitor is offline (navigator.onLine), while the
 * setting "Load photos from Wikimedia Commons" is off (liveSetting.js), or
 * after a request was blocked (no network, a CSP in a sandboxed preview):
 * that fails once, silently — no console noise — and every slot keeps its
 * art until the browser comes back online. Switching the setting off (or
 * going offline) mid-batch aborts the requests in flight and asks nothing
 * more. Images that fail to load are reported back (reportImageError); three
 * failures before any success stop live images — and further API requests —
 * for the session.
 *
 *   const live = createLivePhotos({ slots: liveSlots(manifests) });
 *   live.request(['kyoto-senbon-torii', …]);   // coalesced into one batch
 *   live.get(id)          // → image { file, width, height, widths, srcSet, src(w), credit, … } | null
 *   live.status(id)       // 'none' | 'off' | 'idle' | 'loading' | 'ready' | 'failed'
 *   live.subscribe(fn)    // called after every change; → unsubscribe
 *   live.snapshot(ids)    // a string that changes when any of these ids does (useSyncExternalStore)
 *   live.health()         // { asked, ready, failed, loading, waiting, enabled, online, blocked } (the photo notice)
 */
import {
  BATCH_SIZE,
  apiError,
  chunk,
  evaluateLive,
  imageInfoUrl,
  liveImageSet,
  mergeQueryResponses,
  normalizeFileTitle,
  owesImageInfo,
  parseImageInfoResponse,
  pickSearchResult,
  sanitizeLiveRecord,
  searchResults,
  searchUrl,
} from './commons.js';

export const LIVE_CACHE_KEY = 'tabi:live-photos:v1';
const DAY = 24 * 60 * 60 * 1000;
/** How long a found photo is trusted before it is looked up again. */
export const LIVE_TTL_MS = 30 * DAY;
/** How long "no usable photo for this slot" is remembered. */
export const LIVE_FAIL_TTL_MS = DAY;
const MAX_CONTINUE = 5;
const IMAGE_ERRORS_TO_STOP = 3;

const STATUS_CODE = { none: 'n', off: 'o', idle: 'i', loading: 'l', ready: 'r', failed: 'f' };

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** A short, stable hash of a string (FNV-1a, base 36). */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * The slots the resolver can look up, from manifest modules (as
 * createPhotoRegistry takes them): Map(id → { id, use, titles, query, sig }).
 * `titles` are the normalised candidates (the curated `file` first, when a
 * manifest still carries it); `skip(id)` leaves out slots that need no live
 * photo (a bundled one exists). Slots with neither candidates nor query are
 * left out.
 */
export function liveSlots(manifests = {}, { skip } = {}) {
  const slots = new Map();
  for (const key of Object.keys(manifests ?? {}).sort()) {
    const value = manifests[key];
    const photos = Array.isArray(value) ? value : Array.isArray(value?.photos) ? value.photos : [];
    for (const entry of photos) {
      const id = isRecord(entry) ? str(entry.id) : '';
      if (!id || slots.has(id) || skip?.(id)) continue;
      const raw = [entry.file, ...(Array.isArray(entry.candidates) ? entry.candidates : [])];
      const titles = [...new Set(raw.map(normalizeFileTitle).filter(Boolean))];
      const query = str(entry.query).slice(0, 200);
      if (!titles.length && !query) continue;
      const use = str(entry.use) || 'any';
      slots.set(id, { id, use, titles, query, sig: hash(`${use}\n${titles.join('\n')}\n${query}`) });
    }
  }
  return slots;
}

class LiveError extends Error {
  /**
   * kind: 'blocked' (the request never reached Commons), 'transient' (try again another time)
   * or 'stopped' (the visitor switched live photos off, or went offline, while a batch was out).
   */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // storage disabled: memory only
  }
}

function defaultOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * A live-photo resolver. Options (all optional; tests pass their own):
 * - `slots`        Map from liveSlots()
 * - `fetch`        the transport (default: the browser's fetch); null = never ask
 * - `storage`      a localStorage-like object (default: window.localStorage), null = memory only
 * - `now`          clock (ms)
 * - `online`       () → boolean (default: navigator.onLine)
 * - `enabled`      () → boolean (the visitor's setting); `subscribeEnabled(fn)` to hear changes
 * - `delay`        ms to wait for more requests before a batch goes out (default 0: the same tick)
 * - `concurrency`  API requests in flight at once (default 2)
 * - `timeout`      ms before a request is given up (default 15 s)
 */
export function createLivePhotos({
  slots = new Map(),
  fetch: transport = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  storage = defaultStorage(),
  now = Date.now,
  online = defaultOnline,
  enabled = () => true,
  subscribeEnabled,
  delay = 0,
  concurrency = 2,
  timeout = 15_000,
} = {}) {
  /** id → { status: 'loading'|'ready'|'failed', at?, record?, image?, keep? (persist a failure) } */
  const state = new Map();
  const wanted = new Set();
  const listeners = new Set();
  const stats = { requests: 0, batches: 0, cached: 0 };
  let hydrated = false;
  let timer = null;
  let apiBlocked = false;
  let imagesBlocked = false;
  let imageErrors = 0;
  let imageLoads = 0;
  let active = 0;
  const waiting = [];
  /** AbortControllers of the requests in flight, so switching live photos off stops them at once. */
  const inFlight = new Set();

  /* ----------------------------------------------------------- cache */

  function readCache() {
    try {
      const raw = storage?.getItem(LIVE_CACHE_KEY);
      const json = raw ? JSON.parse(raw) : null;
      return isRecord(json) && json.v === 1 && isRecord(json.photos) ? json.photos : {};
    } catch {
      return {};
    }
  }

  /** A cache entry, if it is for this slot and still fresh: { at, record } | { at, failed } | null. */
  function freshEntry(id, entry, time) {
    const slot = slots.get(id);
    if (!slot || !isRecord(entry) || entry.s !== slot.sig || !Number.isFinite(entry.at)) return null;
    const age = time - entry.at;
    if (age < 0) return null;
    if (entry.r) {
      const record = age <= LIVE_TTL_MS ? sanitizeLiveRecord(entry.r) : null;
      return record ? { at: entry.at, record } : null;
    }
    return entry.fail && age <= LIVE_FAIL_TTL_MS ? { at: entry.at, failed: true } : null;
  }

  function hydrate() {
    if (hydrated) return;
    hydrated = true;
    const time = now();
    for (const [id, entry] of Object.entries(readCache())) {
      const fresh = freshEntry(id, entry, time);
      if (!fresh || state.has(id)) continue;
      if (fresh.record) setReady(id, fresh.record, fresh.at);
      else state.set(id, { status: 'failed', at: fresh.at, keep: true });
      stats.cached += 1;
    }
  }

  /** Writes what is known, merged with what other tabs wrote meanwhile (newest wins); expired entries drop out. */
  function persist() {
    if (!storage) return;
    const time = now();
    const photos = {};
    for (const [id, entry] of Object.entries(readCache())) {
      if (freshEntry(id, entry, time)) photos[id] = entry;
    }
    for (const [id, s] of state) {
      const slot = slots.get(id);
      if (!slot || (photos[id] && photos[id].at > s.at)) continue;
      if (s.status === 'ready') photos[id] = { s: slot.sig, at: s.at, r: s.record };
      else if (s.status === 'failed' && s.keep) photos[id] = { s: slot.sig, at: s.at, fail: 1 };
    }
    try {
      storage.setItem(LIVE_CACHE_KEY, JSON.stringify({ v: 1, photos }));
    } catch {
      /* quota full or storage disabled: the memory cache still works */
    }
  }

  /* ----------------------------------------------------------- state */

  function setReady(id, record, at = now()) {
    const set = liveImageSet(record);
    if (!set.widths.length) {
      state.set(id, { status: 'failed', at, keep: true });
      return;
    }
    const image = Object.freeze({
      file: record.file,
      width: record.width,
      height: record.height,
      widths: set.widths,
      srcSet: set.srcSet,
      src: set.src,
      credit: Object.freeze({ ...record.credit }),
      attributionRequired: record.attributionRequired,
      via: record.via,
    });
    state.set(id, { status: 'ready', at, record, image });
  }

  function setFailed(id, keep) {
    state.set(id, { status: 'failed', at: now(), keep });
  }

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  function isEnabled() {
    return Boolean(enabled());
  }

  function canAsk() {
    return Boolean(transport) && isEnabled() && !apiBlocked && !imagesBlocked && online();
  }

  /** A batch already out stops between requests (and its requests are aborted) once it may no longer ask. */
  function stopped() {
    return !canAsk();
  }

  /** The live image for a slot (null while off, unknown, loading or failed). */
  function get(id) {
    const key = str(id);
    if (!key || !slots.has(key) || !isEnabled() || imagesBlocked) return null;
    hydrate();
    const s = state.get(key);
    return s?.status === 'ready' ? s.image : null;
  }

  function status(id) {
    const key = str(id);
    if (!key || !slots.has(key)) return 'none';
    if (!isEnabled() || imagesBlocked) return 'off';
    hydrate();
    const s = state.get(key);
    if (s) return s.status;
    return canAsk() ? 'idle' : 'off';
  }

  /** One character per id (plus the global flags): equal strings mean nothing these ids show has changed. */
  function snapshot(ids) {
    const list = typeof ids === 'string' ? (ids ? ids.split('\n') : []) : Array.isArray(ids) ? ids : [];
    let out = `${isEnabled() ? 1 : 0}${apiBlocked || imagesBlocked ? 1 : 0}:`;
    for (const id of list) out += STATUS_CODE[status(id)];
    return out;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * How the slots asked for so far are doing, for the photo notice:
   * { asked, ready, failed, loading, waiting, enabled, online, blocked, transport }.
   * `asked` counts slots still known (bundled ones are dropped from `slots`);
   * `waiting` = asked but not looked up yet (offline, off, blocked or not sent).
   */
  function health() {
    hydrate();
    const out = { asked: 0, ready: 0, failed: 0, loading: 0, waiting: 0 };
    for (const id of wanted) {
      if (!slots.has(id)) continue;
      out.asked += 1;
      const s = state.get(id);
      if (!s) out.waiting += 1;
      else if (s.status === 'ready') out.ready += 1;
      else if (s.status === 'failed') out.failed += 1;
      else out.loading += 1;
    }
    return { ...out, enabled: isEnabled(), online: online(), blocked: apiBlocked || imagesBlocked, transport: Boolean(transport) };
  }

  /* --------------------------------------------------------- requests */

  /** Asks for these slots soon (same tick by default), together with any other ids asked for meanwhile. */
  function request(ids) {
    hydrate();
    let added = false;
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const key = str(id);
      if (!key || !slots.has(key) || wanted.has(key)) continue;
      wanted.add(key);
      added = true;
    }
    if (added) schedule();
  }

  function schedule() {
    if (timer !== null || !canAsk()) return;
    timer = setTimeout(flush, delay);
  }

  function flush() {
    timer = null;
    if (!canAsk()) return;
    const ids = [...wanted].filter((id) => !state.has(id));
    if (!ids.length) return;
    stats.batches += 1;
    for (const id of ids) state.set(id, { status: 'loading' });
    notify();
    resolveBatch(ids)
      .catch(() => {})
      .finally(() => {
        // Anything a blocked batch left unresolved goes back to waiting (asked again once online).
        for (const id of ids) if (state.get(id)?.status === 'loading') state.delete(id);
        persist();
        notify();
      });
  }

  async function limited(task) {
    if (active >= concurrency) await new Promise((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  }

  async function getJson(url) {
    if (apiBlocked) throw new LiveError('blocked', 'blocked');
    if (stopped()) throw new LiveError('stopped', 'stopped');
    stats.requests += 1;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const clock = controller ? setTimeout(() => controller.abort(), timeout) : null;
    if (controller) inFlight.add(controller);
    let response;
    try {
      response = await transport(url, { credentials: 'omit', mode: 'cors', signal: controller?.signal });
    } catch (error) {
      // Switched off or offline meanwhile: not Commons' fault. A timeout is worth another try
      // later; anything else never reached Commons.
      if (stopped() && !apiBlocked) throw new LiveError('stopped', 'stopped');
      throw new LiveError(error?.name === 'AbortError' ? 'transient' : 'blocked', 'request failed');
    } finally {
      if (clock) clearTimeout(clock);
      if (controller) inFlight.delete(controller);
    }
    if (!response?.ok) throw new LiveError('transient', `HTTP ${response?.status}`);
    let json;
    try {
      json = await response.json();
    } catch {
      throw new LiveError('transient', 'not JSON');
    }
    if (apiError(json)) throw new LiveError('transient', apiError(json).code);
    return json;
  }

  /** A query and its continuations (while Commons still owes imageinfo), merged into one response. */
  async function query(makeUrl) {
    const responses = [];
    let cont;
    for (let round = 0; round < MAX_CONTINUE; round += 1) {
      const json = await limited(() => getJson(makeUrl(cont)));
      responses.push(json);
      cont = json.continue;
      if (!owesImageInfo(cont)) break;
    }
    return mergeQueryResponses(responses);
  }

  function fail(error, ids) {
    if (error?.kind === 'stopped') return; // the slots go back to waiting
    if (error?.kind === 'blocked') {
      apiBlocked = true;
      return; // the slots go back to waiting
    }
    for (const id of ids) setFailed(id, false);
  }

  /**
   * Looks up `titlesFor(slot)` for every slot, ≤ 50 titles per request (titles
   * shared by two slots are asked once); then each slot takes its first title
   * that passes, in the slot's own order.
   */
  async function tryTitles(list, titlesFor) {
    const jobs = list.map((slot) => [slot, titlesFor(slot)]).filter(([, titles]) => titles.length);
    const titles = [...new Set(jobs.flatMap(([, t]) => t))];
    const parsed = new Map();
    await Promise.all(
      chunk(titles, BATCH_SIZE).map(async (part) => {
        try {
          for (const [title, result] of parseImageInfoResponse(await query((cont) => imageInfoUrl(part, cont)), part)) parsed.set(title, result);
        } catch (error) {
          fail(
            error,
            jobs.filter(([, mine]) => mine.some((title) => part.includes(title))).map(([slot]) => slot.id),
          );
        }
      }),
    );
    for (const [slot, mine] of jobs) {
      if (state.get(slot.id)?.status !== 'loading') continue;
      for (const title of mine) {
        const verdict = parsed.has(title) ? evaluateLive(parsed.get(title), 'candidate') : null;
        if (verdict?.ok) {
          setReady(slot.id, verdict.record);
          break;
        }
      }
    }
  }

  function shownFiles() {
    const files = new Set();
    for (const s of state.values()) if (s.status === 'ready') files.add(s.record.file);
    return files;
  }

  async function searchFor(slot) {
    let record = null;
    try {
      const merged = await query((cont) => searchUrl(slot.query, { cont }));
      record = pickSearchResult(searchResults(merged, parseImageInfoResponse(merged)), slot.use, { exclude: shownFiles() });
    } catch (error) {
      fail(error, [slot.id]);
      return;
    }
    if (state.get(slot.id)?.status !== 'loading') return;
    if (record) setReady(slot.id, record);
    else setFailed(slot.id, true);
  }

  async function resolveBatch(ids) {
    const pending = () => ids.map((id) => slots.get(id)).filter((slot) => slot && state.get(slot.id)?.status === 'loading');
    // 1. The curated first choice of every slot: usually one request for a whole brochure.
    // What each round found is saved straight away: a reload or a closed tab mid-batch keeps it.
    await tryTitles(pending(), (slot) => slot.titles.slice(0, 1));
    if (stopped()) return;
    persist();
    notify();
    // 2. The other candidates of the slots still without a photo.
    await tryTitles(pending(), (slot) => slot.titles.slice(1));
    if (stopped()) return;
    persist();
    notify();
    // 3. Commons search, one request per slot still without a photo.
    const rest = pending();
    await Promise.all(rest.filter((slot) => slot.query).map((slot) => searchFor(slot)));
    if (stopped()) return;
    for (const slot of pending()) setFailed(slot.id, true);
  }

  /* ----------------------------------------------------------- images */

  /** A live image failed to load (deleted, blocked by a CSP…): its slot shows the art for this session. */
  function reportImageError(id) {
    const key = str(id);
    if (state.get(key)?.status !== 'ready') return;
    setFailed(key, false);
    imageErrors += 1;
    if (imageLoads === 0 && imageErrors >= IMAGE_ERRORS_TO_STOP) {
      imagesBlocked = true; // and nothing more is asked of the API this session: its photos could not be shown
      abortAll();
    }
    notify();
  }

  function reportImageLoad() {
    imageLoads += 1;
  }

  function abortAll() {
    for (const controller of [...inFlight]) controller.abort();
  }

  /** Back online (or switched back on): forget transient failures and ask for what is still wanted. */
  function resume() {
    apiBlocked = false;
    imagesBlocked = false;
    imageErrors = 0;
    for (const [id, s] of state) if (s.status === 'failed' && !s.keep) state.delete(id);
    notify();
    schedule();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', resume);
    window.addEventListener('offline', notify);
  }
  subscribeEnabled?.(() => {
    if (isEnabled()) resume();
    else {
      abortAll(); // switched off: not one more request goes to Wikimedia
      notify();
    }
  });

  return {
    get,
    status,
    snapshot,
    subscribe,
    request,
    reportImageError,
    reportImageLoad,
    resume,
    health,
    /** Counters for diagnostics and tests: { requests (API calls), batches, cached (entries read back from storage) }. */
    stats: () => ({ ...stats }),
    has: (id) => slots.has(str(id)),
  };
}
