/**
 * Route pages and the palette panel are lazy, content-hashed chunks. A tab
 * left open across a deploy asks for chunk files that no longer exist, and
 * an offline tab cannot fetch them at all: both surface as a rejected
 * dynamic import. The first case heals with a reload (the new index.html
 * names the new chunks), so the error boundary reloads once on its own;
 * the 30 s window keeps a chunk that is really gone from reloading forever.
 */

/** Messages Chromium, Firefox, Safari and Vite's preloader use for a failed chunk. */
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading (?:CSS )?chunk \S+ failed/i;

/** sessionStorage key holding the time of the last automatic reload. */
export const CHUNK_RELOAD_KEY = 'tabi:chunk-reload';
export const CHUNK_RELOAD_WINDOW = 30_000;

function session() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** True when `error` is a lazy chunk (JS or CSS) that failed to download. */
export function isChunkLoadError(error) {
  if (!error) return false;
  const text = typeof error === 'string' ? error : `${error.name ?? ''} ${error.message ?? ''}`;
  return CHUNK_ERROR.test(text);
}

/**
 * Should this error reload the page by itself? Only for a chunk error, while
 * online (a reload offline would swap the app for the browser's error page),
 * with working sessionStorage, and not within 30 s of the last such reload.
 * Pure apart from reading `storage`; `env` is injectable for tests.
 */
export function shouldAutoReload(error, env = {}) {
  const {
    storage = session(),
    now = Date.now(),
    online = typeof navigator === 'undefined' || navigator.onLine !== false,
  } = env;
  if (!isChunkLoadError(error) || !online || !storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    const since = now - last;
    return !(last > 0 && since >= 0 && since < CHUNK_RELOAD_WINDOW);
  } catch {
    return false;
  }
}

/** Remember this reload, then run `reload`. Returns false (and does not reload) if the stamp cannot be stored. */
export function reloadForChunk({ storage = session(), now = Date.now(), reload = () => window.location.reload() } = {}) {
  try {
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}
