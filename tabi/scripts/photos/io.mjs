/**
 * File and network plumbing for the photo scripts: project paths, manifests,
 * the generated registry, the download's own state (.cache/photo-fetch/:
 * journal, failures, status, lock) and a polite Commons client (descriptive
 * User-Agent, maxlag, Retry-After, API requests one at a time, timeouts,
 * HTTPS_PROXY).
 */
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMONS_API,
  apiError,
  chunk,
  DOWNLOAD_WIDTH,
  imageInfoUrl,
  mergeQueryResponses,
  owesImageInfo,
  parseImageInfoResponse,
  readManifest,
  retryDelay,
  searchImageInfoUrl,
  searchResults,
  sortRecords,
} from './lib.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** PHOTOS_MANIFEST_DIR points the scripts at another manifest folder (for trying things out). */
export const MANIFEST_DIR = process.env.PHOTOS_MANIFEST_DIR ? path.resolve(process.env.PHOTOS_MANIFEST_DIR) : path.join(ROOT, 'src/data/photos/manifest');
export const GENERATED_FILE = path.join(ROOT, 'src/data/photos/photos.generated.json');
export const PUBLIC_DIR = path.join(ROOT, 'public/photos');
export const CANDIDATE_DIR = path.join(ROOT, '.cache/photo-candidates');
/** The download's own bookkeeping (gitignored): never shipped, safe to delete. */
export const STATE_DIR = path.join(ROOT, '.cache/photo-fetch');
/** Photos downloaded but not yet published in photos.generated.json (resumed by the next run). */
export const JOURNAL_FILE = path.join(STATE_DIR, 'journal.json');
/** Slots that recently found no usable picture: { [id]: { at, sig, reason } }. */
export const FAILURES_FILE = path.join(STATE_DIR, 'failures.json');
/** What the download is doing, for the dev server's notice (vite.config.js: tabi-photo-status). */
export const STATUS_FILE = path.join(STATE_DIR, 'status.json');
/** One download at a time: { pid, at }. */
export const LOCK_FILE = path.join(STATE_DIR, 'lock.json');

const UPLOAD_ORIGIN = 'https://upload.wikimedia.org';

/**
 * Wikimedia asks API clients for a descriptive User-Agent with a way to reach
 * the operator: set PHOTOS_CONTACT (a URL or e-mail address) when you run the scripts.
 */
export function userAgent() {
  const contact = process.env.PHOTOS_CONTACT?.trim();
  return `TabiBrochures-PhotoFetch/1.1 (static travel-brochure site; downloads freely licensed photos once, then serves them itself${contact ? `; ${contact}` : '; set PHOTOS_CONTACT to add a contact'}) node/${process.versions.node}`;
}

/* ----------------------------------------------------------------- routing */

/**
 * FOR TESTS ONLY. TABI_COMMONS_API (a stand-in for https://commons.wikimedia.org/w/api.php)
 * and TABI_COMMONS_UPLOAD (for https://upload.wikimedia.org) send the download's
 * requests to a fake Commons server; the URLs recorded in photos.generated.json
 * stay Wikimedia's. Never set them for real use.
 */
export function testRoutes(env = process.env) {
  const api = typeof env.TABI_COMMONS_API === 'string' ? env.TABI_COMMONS_API.trim() : '';
  const upload = typeof env.TABI_COMMONS_UPLOAD === 'string' ? env.TABI_COMMONS_UPLOAD.trim().replace(/\/+$/, '') : '';
  return api || upload ? { api, upload } : null;
}

/** Where a Commons URL is really fetched from (itself, unless a test routes it elsewhere). */
export function routeUrl(url, routes = testRoutes()) {
  if (!routes) return url;
  if (routes.api && url.startsWith(COMMONS_API)) return routes.api + url.slice(COMMONS_API.length);
  if (routes.upload && url.startsWith(`${UPLOAD_ORIGIN}/`)) return routes.upload + url.slice(UPLOAD_ORIGIN.length);
  return url;
}

/* ------------------------------------------------------------------ proxy */

/** The proxy the environment names (HTTPS_PROXY, HTTP_PROXY, either case), or ''. */
export function proxyFromEnv(env = process.env) {
  return env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || '';
}

let transportPromise = null;

/**
 * The fetch the scripts use. Node's built-in fetch ignores HTTPS_PROXY unless
 * it was started with NODE_USE_ENV_PROXY=1 (Node ≥ 22.21 / 24): behind a proxy
 * the scripts use undici's EnvHttpProxyAgent (undici comes with the project's
 * test tools), which honours HTTPS_PROXY, HTTP_PROXY and NO_PROXY.
 * → { fetch, proxy: 'none' | 'node' | 'undici' | 'unused' }
 */
export function transport() {
  transportPromise ??= (async () => {
    if (!proxyFromEnv()) return { fetch: globalThis.fetch, proxy: 'none' };
    if (process.env.NODE_USE_ENV_PROXY === '1') return { fetch: globalThis.fetch, proxy: 'node' };
    try {
      const undici = await import('undici');
      if (typeof undici.EnvHttpProxyAgent === 'function' && typeof undici.fetch === 'function') {
        const dispatcher = new undici.EnvHttpProxyAgent();
        return { fetch: (url, init) => undici.fetch(url, { ...init, dispatcher }), proxy: 'undici' };
      }
    } catch {
      // not installed: fall through
    }
    return { fetch: globalThis.fetch, proxy: 'unused' };
  })();
  return transportPromise;
}

/* ---------------------------------------------------------------- network */

const OFFLINE_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']);

/** The low-level code of a network error (fetch wraps it in `cause`), or ''. */
export function errorCode(error) {
  let e = error;
  for (let i = 0; i < 4 && e; i += 1) {
    if (typeof e.code === 'string' && e.code) return e.code;
    e = e.cause;
  }
  return '';
}

/** True when a request never reached Commons at all (no internet, DNS, a firewall, a proxy that refused). */
export function isOfflineError(error) {
  if (!error || error.status) return false;
  if (OFFLINE_CODES.has(errorCode(error))) return true;
  return error.name === 'TypeError' && /fetch failed/i.test(error.message ?? '');
}

/** A timer that an AbortSignal cuts short. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * GET with retries on 429/5xx/maxlag (honouring Retry-After) and on network
 * errors, a `timeout` per attempt, and `signal` to stop at once. A request
 * that cannot reach Commons at all is tried twice, not five times, so an
 * offline run ends quickly. Returns the Response (ok) or throws.
 */
export async function politeFetch(url, { retries = 4, accept = '*/*', timeout = 30_000, signal } = {}) {
  const { fetch: doFetch } = await transport();
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw signal.reason;
    let response;
    try {
      const timer = AbortSignal.timeout(timeout);
      response = await doFetch(routeUrl(url), {
        headers: { 'User-Agent': userAgent(), 'Api-User-Agent': userAgent(), Accept: accept },
        signal: signal ? AbortSignal.any([signal, timer]) : timer,
      });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      lastError = error;
      const offline = isOfflineError(error);
      if (attempt === retries || (offline && attempt >= 1)) break;
      await sleep(offline ? 1000 : retryDelay(attempt), signal);
      continue;
    }
    if (response.ok) return response;
    // Release the connection: an unread body keeps the socket busy.
    await response.body?.cancel().catch(() => {});
    lastError = new Error(`HTTP ${response.status} for ${url}`);
    lastError.status = response.status;
    if (response.status !== 429 && response.status < 500) throw lastError;
    if (attempt < retries) await sleep(retryDelay(attempt, response.headers.get('retry-after')), signal);
  }
  throw lastError;
}

// Wikimedia's API etiquette: one request at a time, even while images download in parallel.
let apiQueue = Promise.resolve();
function oneAtATime(task) {
  const run = apiQueue.then(task, task);
  apiQueue = run.catch(() => {});
  return run;
}

/** One API request, repeated while Commons answers maxlag/ratelimited. → parsed JSON */
async function apiGet(url, fetchImpl, { signal } = {}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { json, retryAfter } = await oneAtATime(async () => {
      const response = await fetchImpl(url, { accept: 'application/json', signal });
      return { json: await response.json(), retryAfter: response.headers?.get?.('retry-after') };
    });
    const error = apiError(json);
    if (error && (error.code === 'maxlag' || error.code === 'ratelimited')) {
      await sleep(retryDelay(attempt, retryAfter ?? (error.code === 'maxlag' ? 5 : undefined)), signal);
      continue;
    }
    if (error) throw new Error(`Commons API error ${error.code}: ${error.info}`);
    return json;
  }
  throw new Error('Commons kept answering "maxlag" (it is busy); try again later');
}

/**
 * imageinfo for many titles → Map(title → result). Batches of 50, one request
 * at a time (Wikimedia's API etiquette), maxlag-aware, following `continue`
 * until each batch is complete. `fetchImpl` is for tests.
 */
export async function queryImageInfo(titles, { thumbWidth = DOWNLOAD_WIDTH, fetchImpl = politeFetch, maxRounds = 20, signal } = {}) {
  const results = new Map();
  for (const batch of chunk([...new Set(titles)])) {
    const rounds = [];
    let cont;
    do {
      const json = await apiGet(imageInfoUrl(batch, { thumbWidth, cont }), fetchImpl, { signal });
      rounds.push(json);
      cont = json?.continue && typeof json.continue === 'object' ? json.continue : undefined;
    } while (cont && rounds.length < maxRounds);
    if (cont) throw new Error(`Commons kept sending "continue" for ${batch.length} titles; try fewer at once (--only)`);
    for (const [title, result] of parseImageInfoResponse(mergeQueryResponses(rounds), batch)) results.set(title, result);
  }
  return results;
}

/**
 * One page of a Commons search for `query` (bitmap files, `limit` a page, with
 * imageinfo and a 1920 px thumbnail), following `continue` while imageinfo is
 * owed. `offset` asks for a later page (a previous answer's `nextOffset`).
 *   → { results: [parsed result + index, best-ranked first], nextOffset }
 */
export async function searchImageInfo(query, { offset, limit = 20, fetchImpl = politeFetch, maxRounds = 10, signal } = {}) {
  const rounds = [];
  let cont = offset ? { gsroffset: offset, continue: 'gsroffset||' } : undefined;
  let last;
  do {
    const json = await apiGet(searchImageInfoUrl(query, { limit, cont }), fetchImpl, { signal });
    rounds.push(json);
    last = json?.continue;
    cont = owesImageInfo(last) ? { ...cont, ...last } : undefined;
  } while (cont && rounds.length < maxRounds);
  const merged = mergeQueryResponses(rounds);
  const nextOffset = Number(last?.gsroffset) || null;
  return { results: searchResults(merged, parseImageInfoResponse(merged)), nextOffset };
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

/** A friendly explanation for a network failure (lines, without a trailing newline). */
export function networkHint(error, { proxy = 'none' } = {}) {
  const cause = errorCode(error) || error?.status || error?.message || 'no answer';
  const lines = [
    `Could not reach Wikimedia Commons (${cause}) — is this computer offline?`,
    'Check the internet connection, then run `npm run photos:fetch` (or restart `npm run dev`) to get the real photos.',
    'Until then the site shows placeholder art where a photo is missing.',
  ];
  if (proxy === 'unused') {
    lines.push('HTTPS_PROXY is set, but this Node cannot use it by itself. Use Node 22.21 or newer and run', '  NODE_USE_ENV_PROXY=1 npm run photos:fetch   (Windows PowerShell: $env:NODE_USE_ENV_PROXY=1; npm run photos:fetch)');
  } else if (proxy === 'undici' || proxy === 'node') {
    lines.push(`A proxy is set (${redactProxy(proxyFromEnv())}): check that it lets commons.wikimedia.org and upload.wikimedia.org through.`);
  }
  lines.push('If wikimedia.org is blocked on this network, `npm run photos:import` adds a photo you own or licensed.');
  return lines.join('\n');
}

/** A proxy URL without its password. */
export function redactProxy(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.href.replace(/\/$/, '');
  } catch {
    return 'set';
  }
}

/* ------------------------------------------------------------------ files */

/** Every manifest: [{ name, file, brochure, photos, problems }], sorted by name. */
export async function loadManifests() {
  let names = [];
  try {
    names = (await readdir(MANIFEST_DIR)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const file of names) {
    const name = file.replace(/\.json$/, '');
    let json = null;
    let problems = [];
    try {
      json = JSON.parse(await readFile(path.join(MANIFEST_DIR, file), 'utf8'));
    } catch (error) {
      problems = [`${file}: ${error.message}`];
    }
    const parsed = json ? readManifest(json, file) : { brochure: null, photos: [], problems: [] };
    out.push({ name, file, brochure: parsed.brochure, photos: parsed.photos, problems: [...problems, ...parsed.problems] });
  }
  return out;
}

/**
 * The generated registry ({} when the file does not exist yet). A file that
 * exists but cannot be read is an error, not an empty registry: carrying on
 * would overwrite every record (local imports included) on the next save.
 */
export async function loadGenerated(file = GENERATED_FILE) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)} is not valid JSON (${error.message}); fix or restore it before fetching.`);
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error(`${path.relative(ROOT, file)} should hold an object of photo records.`);
  return json;
}

/** Write JSON atomically (temp file + rename), so an interrupted run never leaves half a file. */
export async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, file);
}

/** Write the registry atomically, sorted by id so it diffs cleanly. */
export async function saveGenerated(records, file = GENERATED_FILE) {
  await writeJsonAtomic(file, sortRecords(records));
}

/**
 * Publish `records` ({ [id]: record }) into photos.generated.json as it is on
 * disk now (merged, so a photo another tool added meanwhile is kept). → the merged registry
 */
export async function publishRecords(records, file = GENERATED_FILE) {
  const merged = { ...(await loadGenerated(file)), ...records };
  await saveGenerated(merged, file);
  return merged;
}

/** JSON from a file, or `fallback` when it is missing or unreadable (the download's own state files). */
export async function readJson(file, fallback) {
  try {
    const json = JSON.parse(await readFile(file, 'utf8'));
    return json && typeof json === 'object' && !Array.isArray(json) ? json : fallback;
  } catch {
    return fallback;
  }
}

/** True while a process with this pid runs (a lock or status left by a crashed run is stale). */
export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Take the download lock (false when another live download holds it); a stale lock is taken over. */
export async function acquireLock(file = LOCK_FILE) {
  await mkdir(path.dirname(file), { recursive: true });
  const mine = JSON.stringify({ pid: process.pid, at: Date.now() });
  try {
    await writeFile(file, mine, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const held = await readJson(file, null);
  if (held && held.pid !== process.pid && processAlive(held.pid)) return false;
  await writeFile(file, mine);
  return true;
}

/** Give the lock back (only if it is ours). */
export async function releaseLock(file = LOCK_FILE) {
  const held = await readJson(file, null);
  if (held?.pid === process.pid) await unlink(file).catch(() => {});
}
