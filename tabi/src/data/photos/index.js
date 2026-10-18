/**
 * Real, credited photographs of the places in the brochures.
 *
 *   import { getPhoto, creditsFor } from '../../data/photos/index.js';
 *   const photo = getPhoto('kyoto-senbon-torii');
 *   // → { id, alt, caption, place, focus, use, width, height, lqip, color,
 *   //     credit: { title, author, authorUrl, license, licenseUrl, sourceUrl },
 *   //     src(width), srcSet, available, live? } — or null for an unknown id
 *   resolvePhoto('user:abc', brochure)  // the brochure's own upload (brochure.userPhotos.abc), same shape
 *
 * Sources, in order of preference for each slot:
 *   1. ./photos.generated.json — bundled with the site by `npm run photos:fetch`;
 *   2. live from Wikimedia Commons — looked up by the visitor's browser
 *      (live.js) from the slot's manifest candidates or search query;
 *   3. nothing yet: `available: false`, and <Photo> shows its fallback art.
 * Lookups are synchronous; a live photo appears once it has been resolved, so
 * components that draw from these functions subscribe through
 * useLivePhotos() (components/photo/useLivePhotos.js), which also asks for the ids.
 * ./manifest/<brochure>.json says what each photo shows (docs/REAL_CONTENT.md).
 * `npm run dev` downloads the photos in the background on the first run; in
 * development the registry takes each published batch in without a reload
 * (updateBundledPhotos, through Vite's HMR).
 * Imported by the brochure renderer (a lazy chunk), never by the app entry.
 */
import generated from './photos.generated.json';
import { createLivePhotos, liveSlots } from './live.js';
import { livePhotosEnabled, subscribeLivePhotosSetting } from './liveSetting.js';
import { createPhotoRegistry } from './registry.js';

const manifests = import.meta.glob('./manifest/*.json', { eager: true, import: 'photos' });

let records = generated;
const isBundled = (id) => Array.isArray(records?.[id]?.widths) && records[id].widths.length > 0;
const slots = liveSlots(manifests, { skip: isBundled });

/**
 * The browser's Commons resolver (live.js). Vitest never reaches Wikimedia:
 * suites that exercise live photos build their own with a fake fetch.
 */
export const livePhotos = createLivePhotos({
  slots,
  enabled: livePhotosEnabled,
  subscribeEnabled: subscribeLivePhotosSetting,
  ...(import.meta.env?.MODE === 'test' ? { fetch: null, storage: null } : {}),
});

let registry = createPhotoRegistry(manifests, records, { live: livePhotos });

export const getPhoto = (id) => registry.getPhoto(id);
export const listPhotos = () => registry.listPhotos();
export const creditsFor = (brochure) => registry.creditsFor(brochure);
export const resolvePhoto = (id, brochure) => registry.resolvePhoto(id, brochure);
export { PHOTO_WIDTHS, USER_PHOTO_PREFIX, isUserPhotoId, photoIdsIn, photoUrl, pickWidth, safeImageSrc } from './registry.js';

/** How many manifest slots have a photo bundled with the site (photos.generated.json), and how many slots there are. */
export function bundledCount() {
  const ids = new Set(Object.values(manifests).flatMap((photos) => (Array.isArray(photos) ? photos.map((p) => p?.id) : [])));
  let bundled = 0;
  for (const id of ids) if (isBundled(id)) bundled += 1;
  return { bundled, total: ids.size };
}

/* Bundled photos can change while the page is open: in development, `npm run dev` downloads
   the real photos in the background and publishes photos.generated.json in a few batches.
   The registry takes each batch in without a reload; subscribers re-render. */
let version = 0;
const listeners = new Set();

/** Calls `listener` when any photo lookup may answer differently (a live photo resolved, or new bundled photos). */
export function subscribePhotos(listener) {
  const off = livePhotos.subscribe(listener);
  listeners.add(listener);
  return () => {
    off();
    listeners.delete(listener);
  };
}

/** A string that changes when what these ids show changes ("\n"-joined ids, as useLivePhotos keys them). */
export function photosSnapshot(key) {
  return `${version}|${livePhotos.snapshot(key)}`;
}

/** Take in a newer photos.generated.json: bundled photos replace live ones (and art) slot by slot. */
export function updateBundledPhotos(next) {
  records = next && typeof next === 'object' ? next : {};
  // Newly bundled slots need nothing more from Commons.
  for (const id of [...slots.keys()]) if (isBundled(id)) slots.delete(id);
  registry = createPhotoRegistry(manifests, records, { live: livePhotos });
  version += 1;
  for (const listener of [...listeners]) listener();
}

if (import.meta.hot) {
  import.meta.hot.accept('./photos.generated.json', (module) => {
    if (module) updateBundledPhotos(module.default);
  });
}
