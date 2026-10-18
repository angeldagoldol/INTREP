/**
 * The built-in brochures as the app holds them: outlines in the entry chunk,
 * full brochures loaded on demand.
 *
 * Twelve real brochures are ~140 KB of page text, which no route needs for
 * its first paint. `./brochures/index.js?outline` (scripts/build/brochure-outline.mjs)
 * gives each brochure with all its top-level fields (title, cover, theme,
 * location, sources, factsChecked…) and a stub per page — id, type, name,
 * nameJp, kicker, photo and item photos. That is everything
 * the Library, search, palette, Credits and the Studio's photo library read.
 * Anything that draws pages (the reader, the Home flip sketch, a Studio remix)
 * gets the full brochure from `loadBrochure`/`useFullBrochure`; each one is its
 * own lazy chunk.
 *
 * src/data/brochures.js still exports the full BROCHURES for tests and the
 * playground; app code imports this module instead.
 */
import { BROCHURES as OUTLINES } from './brochures/index.js?outline';

const FULL = import.meta.glob(['./brochures/*.js', '!./brochures/index.js', '!./brochures/*.test.js'], { import: 'default' });

/** Built-in brochures, in the curated (Featured) order, as outlines. */
export const BUILTINS = OUTLINES;

// Only these exact objects are outlines: a stored or imported brochure that
// happens to carry an `outline` field is never mistaken for one.
const outlines = new WeakSet(OUTLINES.filter((b) => b && typeof b.outline === 'string' && FULL[`./brochures/${b.outline}.js`]));

/** True for a built-in outline whose pages still have to be loaded. */
export function isOutline(brochure) {
  return Boolean(brochure) && typeof brochure === 'object' && outlines.has(brochure);
}

/** Mark a promise's outcome on it, as React's `use()` reads it (no extra suspend once settled). */
function track(promise) {
  promise.status = 'pending';
  promise.then(
    (value) => {
      promise.status = 'fulfilled';
      promise.value = value;
    },
    (reason) => {
      promise.status = 'rejected';
      promise.reason = reason;
    },
  );
  return promise;
}

const ready = new WeakMap();
function settled(value) {
  if (!value || typeof value !== 'object') return Promise.resolve(value ?? null);
  let promise = ready.get(value);
  if (!promise) {
    promise = Promise.resolve(value);
    promise.status = 'fulfilled';
    promise.value = value;
    ready.set(value, promise);
  }
  return promise;
}

const loads = new Map();

/**
 * The full brochure: a promise that is already settled for anything that is
 * not an outline (a user brochure, a template, a full built-in). Loads are
 * shared; a failed one (offline, a deploy replaced the chunk) is forgotten so
 * the next call retries.
 */
export function loadBrochure(brochure) {
  if (!isOutline(brochure)) return settled(brochure);
  const stem = brochure.outline;
  let promise = loads.get(stem);
  if (!promise) {
    promise = track(
      FULL[`./brochures/${stem}.js`]().then((full) => {
        if (!full || typeof full !== 'object' || !Array.isArray(full.pages)) throw new Error(`Brochure “${stem}” could not be read`);
        return full;
      }),
    );
    loads.set(stem, promise);
    promise.catch(() => {
      if (loads.get(stem) === promise) loads.delete(stem);
    });
  }
  return promise;
}

/** Start loading a brochure's pages ahead of time (a deep link, a hovered card). Never throws. */
export function preloadBrochure(brochure) {
  loadBrochure(brochure).catch(() => {});
}

/** The full brochure if it is already at hand, else null (never starts a load). */
export function peekBrochure(brochure) {
  if (!isOutline(brochure)) return brochure ?? null;
  const promise = loads.get(brochure.outline);
  return promise?.status === 'fulfilled' ? promise.value : null;
}
