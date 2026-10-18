/**
 * The photo registry, as pure functions: manifest entries (what a photo shows:
 * alt, caption, place, focus — written by researchers) merged with generated
 * records (what was downloaded: size, LQIP, colour, credit — written by
 * scripts/photos/fetch.mjs). index.js builds the app's registry from the real
 * files; tests build one from fixtures.
 *
 * A brochure can also carry its own photos (the Studio's uploads):
 *   brochure.userPhotos = { [key]: { src, alt, caption?, focus?, width, height,
 *                                     credit: { author, license, licenseUrl?, sourceUrl? } } }
 * and page photo fields reference them as "user:<key>". `src` must be a
 * data:image/… URL (png, jpeg, webp, gif, avif) or a blob: URL; anything else
 * leaves the photo unavailable, so its fallback art shows. resolvePhoto(id,
 * brochure) answers both kinds of id with the same record shape.
 *
 * Live photos (live.js): a slot without a bundled file can be shown straight
 * from Wikimedia Commons once the visitor's browser has looked it up. Pass
 * `{ live }` (an object with get(id) → live image | null) and every lookup
 * prefers, in order: the bundled photo, the live photo, nothing (the art).
 */
import { safeImageSrc } from './safeImageSrc.js';

/** Widths the pipeline writes (public/photos/<id>-<w>.webp). */
export const PHOTO_WIDTHS = [480, 960, 1600];

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** An absolute http(s) URL, or '' — credit links never carry javascript:, data: or relative URLs. */
function webUrl(value) {
  const text = str(value);
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    return new URL(text).href;
  } catch {
    return '';
  }
}

/** Relative URL of one output file; relative so the site works from any sub-path (base './'). */
export function photoUrl(id, width) {
  return `photos/${id}-${width}.webp`;
}

/** The output width to use for a slot `width` px wide: the smallest that covers it, else the largest. */
export function pickWidth(widths, width) {
  if (!widths.length) return null;
  const target = Number(width) || widths.at(-1);
  return widths.find((w) => w >= target) ?? widths.at(-1);
}

/** Prefix of photo ids that point into brochure.userPhotos ("user:<key>"). */
export const USER_PHOTO_PREFIX = 'user:';

/** True for "user:<key>" ids (a photo the brochure carries itself). */
export function isUserPhotoId(id) {
  return typeof id === 'string' && id.trim().startsWith(USER_PHOTO_PREFIX) && id.trim().length > USER_PHOTO_PREFIX.length;
}

export { safeImageSrc };

const positive = (value) => (Number.isFinite(value) && value > 0 ? Math.round(value) : null);
/** "50% 40%" / "left top" style object-position: letters, digits, %, ., spaces, minus only. */
const focusValue = (value) => {
  const focus = str(value);
  return focus && /^[a-z0-9%.\s-]{1,40}$/i.test(focus) ? focus : '50% 50%';
};

// One record per userPhotos entry object, so re-renders keep the same record (and loading state).
const userRecords = new WeakMap();
let userToken = 0;

/**
 * The photo record for an uploaded photo (brochure.userPhotos[key]), shaped
 * like a registry photo; `user: true`, a single `src` and no srcSet.
 * Unavailable (fallback art) when its src is not a safe inline image.
 */
export function userPhotoRecord(key, entry) {
  if (!isRecord(entry)) return null;
  const cached = userRecords.get(entry);
  if (cached && cached.id === `${USER_PHOTO_PREFIX}${key}`) return cached;
  const src = safeImageSrc(entry.src);
  const credit = isRecord(entry.credit) ? entry.credit : {};
  const width = positive(entry.width);
  const height = width ? positive(entry.height) : null;
  const record = Object.freeze({
    id: `${USER_PHOTO_PREFIX}${key}`,
    alt: str(entry.alt),
    caption: str(entry.caption),
    place: '',
    focus: focusValue(entry.focus),
    use: 'any',
    width: height ? width : null,
    height,
    widths: height ? [width] : [],
    lqip: '',
    color: '',
    credit: Object.freeze({
      title: str(credit.title),
      author: str(credit.author),
      authorUrl: webUrl(credit.authorUrl),
      license: str(credit.license),
      licenseUrl: webUrl(credit.licenseUrl),
      sourceUrl: webUrl(credit.sourceUrl),
    }),
    attributionRequired: Boolean(str(credit.author) || str(credit.license)),
    available: Boolean(src),
    user: true,
    /** Changes whenever the entry does, so <Photo> restarts its loading state. */
    token: `user-${++userToken}`,
    src: () => src || null,
    srcSet: '',
  });
  userRecords.set(entry, record);
  return record;
}

/** brochure.userPhotos[key] for a "user:<key>" id (own keys only), as a photo record; else null. */
export function resolveUserPhoto(id, brochure) {
  if (!isUserPhotoId(id) || !isRecord(brochure) || !isRecord(brochure.userPhotos)) return null;
  const key = id.trim().slice(USER_PHOTO_PREFIX.length);
  return Object.hasOwn(brochure.userPhotos, key) ? userPhotoRecord(key, brochure.userPhotos[key]) : null;
}

/**
 * A manifest entry merged with its generated record. A photo the download
 * found by searching Commons (`via: 'search'`, not a researched candidate)
 * takes the work's own title as alt text, as a live one does: the manifest's
 * may not describe it.
 */
function mergePhoto(id, entry, record) {
  const widths = Array.isArray(record?.widths) ? record.widths.filter((w) => Number.isInteger(w) && w > 0).sort((a, b) => a - b) : [];
  const available = widths.length > 0;
  const width = available && Number.isFinite(record.width) ? record.width : null;
  const height = available && Number.isFinite(record.height) ? record.height : null;
  const searched = available && record.via === 'search';
  return Object.freeze({
    id,
    alt: searched ? str(record.title) || str(entry?.caption) || str(entry?.alt) : str(entry?.alt),
    caption: str(entry?.caption),
    place: str(entry?.place),
    focus: str(entry?.focus) || '50% 50%',
    use: str(entry?.use) || 'any',
    width,
    height,
    widths,
    // Whole-value match: the preview goes into a CSS url("…"), so nothing may follow the base64.
    lqip: available && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.lqip ?? '') ? record.lqip : '',
    color: available && /^#[0-9a-f]{6}$/i.test(record.color ?? '') ? record.color : '',
    credit: Object.freeze({
      title: str(record?.title),
      author: str(record?.author),
      authorUrl: webUrl(record?.authorUrl),
      license: str(record?.license),
      licenseUrl: webUrl(record?.licenseUrl),
      sourceUrl: webUrl(record?.sourceUrl),
    }),
    attributionRequired: record?.attributionRequired !== false,
    available,
    user: false,
    ...(searched ? { via: 'search' } : {}),
    token: available ? widths.join(',') : 'none',
    /** URL for a slot `w` px wide (null until downloaded). */
    src: (w) => (available ? photoUrl(id, pickWidth(widths, w)) : null),
    srcSet: available ? widths.map((w) => `${photoUrl(id, w)} ${w}w`).join(', ') : '',
  });
}

/**
 * A registry photo shown live from Commons: the manifest's words (alt,
 * caption, place, focus, use) with the live image's size, sources and credit.
 * `live: true`; no LQIP or colour (<Photo> keeps the art under it while it loads).
 * A photo found by searching Commons (not a researched candidate) takes the
 * work's own title as alt text, since the manifest's may not describe it.
 */
function mergeLive(base, image) {
  const widths = Array.isArray(image?.widths) ? image.widths.filter((w) => Number.isInteger(w) && w > 0) : [];
  const width = positive(image?.width);
  const height = positive(image?.height);
  if (!widths.length || !width || !height || typeof image.src !== 'function' || !str(image.srcSet)) return null;
  const credit = isRecord(image.credit) ? image.credit : {};
  const searched = image.via === 'search';
  return Object.freeze({
    id: base.id,
    alt: searched ? str(credit.title) || base.caption || base.alt : base.alt,
    caption: base.caption,
    place: base.place,
    focus: base.focus,
    use: base.use,
    width,
    height,
    widths,
    lqip: '',
    color: '',
    credit: Object.freeze({
      title: str(credit.title),
      author: str(credit.author),
      authorUrl: webUrl(credit.authorUrl),
      license: str(credit.license),
      licenseUrl: webUrl(credit.licenseUrl),
      sourceUrl: webUrl(credit.sourceUrl),
    }),
    attributionRequired: image.attributionRequired !== false,
    available: true,
    user: false,
    live: true,
    via: searched ? 'search' : 'candidate',
    file: str(image.file),
    token: `live:${str(image.file)}`,
    src: (w) => image.src(w) ?? null,
    srcSet: image.srcSet,
  });
}

/**
 * Build a registry from manifest modules ({ path: { brochure, photos: [...] } }
 * or their `photos` arrays) and generated records ({ [id]: record }).
 * The first manifest entry for an id wins; ids only in the generated file
 * (an import not listed yet) still resolve, without alt text.
 * `options.live` (live.js) supplies Commons photos for slots not bundled.
 */
export function createPhotoRegistry(manifests = {}, generated = {}, { live = null } = {}) {
  const entries = new Map();
  for (const key of Object.keys(manifests ?? {}).sort()) {
    const value = manifests[key];
    const photos = Array.isArray(value) ? value : Array.isArray(value?.photos) ? value.photos : [];
    for (const entry of photos) {
      if (isRecord(entry) && typeof entry.id === 'string' && entry.id && !entries.has(entry.id)) entries.set(entry.id, entry);
    }
  }
  const records = isRecord(generated) ? generated : {};
  const photos = new Map();
  for (const [id, entry] of entries) photos.set(id, mergePhoto(id, entry, isRecord(records[id]) ? records[id] : null));
  for (const id of Object.keys(records)) {
    if (!photos.has(id) && isRecord(records[id])) photos.set(id, mergePhoto(id, null, records[id]));
  }

  // One merged record per live image, so re-renders keep the same record (and <Photo> its loading state).
  const liveRecords = new WeakMap();
  function withLive(photo) {
    if (!photo || photo.available || !live) return photo;
    const image = live.get(photo.id);
    if (!isRecord(image)) return photo;
    if (!liveRecords.has(image)) liveRecords.set(image, mergeLive(photo, image));
    return liveRecords.get(image) ?? photo;
  }

  /** The merged photo for an id — bundled, else live, else not available — or null for unknown ids (and non-strings). */
  function getPhoto(id) {
    return typeof id === 'string' ? withLive(photos.get(id.trim()) ?? null) : null;
  }

  /** Every known photo, sorted by id. */
  function listPhotos() {
    return [...photos.values()].map(withLive).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Any photo id a page can hold: "user:<key>" → the brochure's own uploaded
   * photo (brochure.userPhotos), anything else → the registry. Null when unknown.
   */
  function resolvePhoto(id, brochure) {
    return isUserPhotoId(id) ? resolveUserPhoto(id, brochure) : getPhoto(id);
  }

  /** Credits for the photos a brochure shows (downloaded registry photos and its own
   *  uploads), in reading order, once each:
   *  [{ id, caption, place, title, author, authorUrl, license, licenseUrl, sourceUrl, attributionRequired, user }]
   *  (title = the work's title on Commons; links are http(s) or ''). Uploads
   *  without an author or licence have nothing to credit and are left out. */
  function creditsFor(brochure) {
    return photoIdsIn(brochure)
      .map((id) => resolvePhoto(id, brochure))
      .filter((photo) => photo?.available && (!photo.user || photo.credit.author || photo.credit.license))
      .map((photo) => ({
        id: photo.id,
        caption: photo.caption,
        place: photo.place,
        ...photo.credit,
        attributionRequired: photo.attributionRequired,
        user: photo.user,
      }));
  }

  return { getPhoto, listPhotos, creditsFor, photoIdsIn, resolvePhoto };
}

/**
 * Every photo id a brochure uses, once each, in reading order: the cover's,
 * then each page's own `photo` and the `photo` of its items (gallery,
 * features). Ids are not checked against the registry.
 */
export function photoIdsIn(brochure) {
  const ids = [];
  const add = (value) => {
    const id = str(value);
    if (id && !ids.includes(id)) ids.push(id);
  };
  if (!isRecord(brochure)) return ids;
  if (isRecord(brochure.cover)) add(brochure.cover.photo);
  for (const page of Array.isArray(brochure.pages) ? brochure.pages : []) {
    if (!isRecord(page)) continue;
    add(page.photo);
    for (const item of Array.isArray(page.items) ? page.items : []) if (isRecord(item)) add(item.photo);
  }
  return ids;
}
