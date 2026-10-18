/**
 * Normalising brochures that come back from storage (localStorage written by
 * an older version, another tab, or a hand-edited value). Renderers and the
 * Studio may then rely on the shapes in schema.js: pages are objects with a
 * string id and a known type, text fields are strings, enums are known ids.
 *
 * A record that is already valid comes back with the same values in the same
 * key order (so content signatures and "unsaved changes" checks still match).
 * Missing optional fields stay missing; renderers already handle those.
 */
import { CATEGORY_MAP } from './categories.js';
import { hasKey } from './lookup.js';
import { safeImageSrc } from './photos/safeImageSrc.js';
import { REGION_MAP } from './regions.js';
import { ART_STYLES, CAPTION_PLACEMENTS, CREDIT_PLACEMENTS, FORMATS, PAGE_TYPES, RETIRED_PAGE_TYPES } from './schema.js';
import { SEASON_MAP } from './seasons.js';

const TEXT_FIELDS = ['title', 'titleJp', 'subtitle', 'summary', 'organization', 'updatedAt', 'factsChecked'];
const DEFAULT_CATEGORY = 'heritage';
const DEFAULT_REGION = 'kansai';
const DEFAULT_FORMAT = 'booklet';
const DEFAULT_COVER = { art: 'hinomaru', seed: 1 };

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * An absolute http(s) URL (trimmed), or '' for anything else — javascript:,
 * data:, mailto:, relative paths, junk. Links in brochures only ever go to the web.
 */
export function safeUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return '';
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname ? url : '';
  } catch {
    return '';
  }
}

/** A finite number in [min, max] (numeric strings are read too), or null. */
function coordinate(value, limit) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= -limit && n <= limit ? n : null;
}

export const toLat = (value) => coordinate(value, 90);
export const toLng = (value) => coordinate(value, 180);

/**
 * Copy-on-write editing of one record: `fix(key, value)` replaces a value
 * only when it differs, `drop(key)` removes a key, and `done()` returns the
 * original object when nothing changed (so valid data keeps its identity and
 * key order).
 */
function editor(record) {
  let out = record;
  const own = () => {
    if (out === record) out = { ...record };
    return out;
  };
  return {
    fix(key, value) {
      if (out[key] !== value) own()[key] = value;
    },
    drop(key) {
      if (key in out) delete own()[key];
    },
    done: () => out,
  };
}

/** Present text fields that are not strings become ''. */
function fixText(edit, record, keys) {
  for (const key of keys) if (key in record && typeof record[key] !== 'string') edit.fix(key, '');
}

/** Present lat/lng that are not usable coordinates are removed; numeric strings become numbers. */
function fixLatLng(edit, record) {
  for (const [key, read] of [
    ['lat', toLat],
    ['lng', toLng],
  ]) {
    if (!(key in record)) continue;
    const n = read(record[key]);
    if (n === null) edit.drop(key);
    else edit.fix(key, n);
  }
}

/** A list of records, each passed through `fix`; returns the same array when nothing changed. */
function fixList(value, fix) {
  if (!Array.isArray(value)) return [];
  let changed = false;
  const out = [];
  for (const item of value) {
    if (!isRecord(item)) {
      changed = true;
      continue;
    }
    const fixed = fix(item);
    if (fixed !== item) changed = true;
    out.push(fixed);
  }
  return changed ? out : value;
}

/** A present enum field outside `choices` is reset to the first choice. */
function fixChoice(edit, record, key, choices) {
  if (key in record && !choices.includes(record[key])) edit.fix(key, choices[0]);
}

function fixUrlField(edit, record, key) {
  if (key in record && safeUrl(record[key]) !== record[key]) edit.fix(key, safeUrl(record[key]));
}

const fixItem = (item) => {
  const edit = editor(item);
  fixText(edit, item, ['photo']);
  return edit.done();
};
const fixFact = (fact) => {
  const edit = editor(fact);
  for (const key of ['label', 'value']) {
    if (key in fact && typeof fact[key] !== 'string') edit.fix(key, typeof fact[key] === 'number' && Number.isFinite(fact[key]) ? String(fact[key]) : '');
  }
  return edit.done();
};
const fixDetail = (detail) => {
  const edit = editor(detail);
  fixUrlField(edit, detail, 'url');
  return edit.done();
};

/**
 * The fields of one page, made safe for renderers: photo ids are strings,
 * place coordinates are real coordinates, links are http(s) only
 * (place.website, contact.ctaUrl, contact details' url), lists hold records,
 * photo pages' caption and credit placements are known values and `span` is
 * 'left' | 'right' or absent.
 * A valid page comes back as the same object.
 */
export function normalizePage(page) {
  if (!isRecord(page)) return page;
  const edit = editor(page);
  fixText(edit, page, ['photo']);
  if ('items' in page && Array.isArray(page.items)) edit.fix('items', fixList(page.items, fixItem));
  switch (page.type) {
    case 'place':
      fixText(edit, page, ['kicker', 'name', 'nameJp', 'body']);
      fixUrlField(edit, page, 'website');
      if ('facts' in page) edit.fix('facts', fixList(page.facts, fixFact));
      fixLatLng(edit, page);
      break;
    case 'quote':
      fixText(edit, page, ['quoteJp']);
      break;
    case 'photo':
      fixText(edit, page, ['name', 'nameJp', 'caption']);
      fixChoice(edit, page, 'captionPlacement', CAPTION_PLACEMENTS);
      fixChoice(edit, page, 'creditPlacement', CREDIT_PLACEMENTS);
      // A span that is not a known half is dropped: the page is then a full-page photo.
      if ('span' in page && page.span !== 'left' && page.span !== 'right') edit.drop('span');
      break;
    case 'contact':
      fixUrlField(edit, page, 'ctaUrl');
      if ('details' in page && Array.isArray(page.details)) edit.fix('details', fixList(page.details, fixDetail));
      break;
    default:
  }
  return edit.done();
}

/** brochure.location: { name, nameJp, prefecture, lat, lng } with real coordinates, or null when unusable. */
export function sanitizeLocation(value) {
  if (!isRecord(value)) return null;
  const edit = editor(value);
  fixText(edit, value, ['name', 'nameJp', 'prefecture']);
  fixLatLng(edit, value);
  return edit.done();
}

/** brochure.sources: [{ label, url }] with http(s) URLs only; other entries are dropped. */
export function sanitizeSources(value) {
  if (!Array.isArray(value)) return [];
  let changed = false;
  const out = [];
  for (const source of value) {
    const url = isRecord(source) ? safeUrl(source.url) : '';
    if (!url) {
      changed = true;
      continue;
    }
    const edit = editor(source);
    edit.fix('url', url);
    fixText(edit, source, ['label']);
    const fixed = edit.done();
    if (fixed !== source) changed = true;
    out.push(fixed);
  }
  return changed ? out : value;
}

/** True for a page type Tabi no longer draws (schema.js RETIRED_PAGE_TYPES: old map pages). */
export const isRetiredPageType = (type) => RETIRED_PAGE_TYPES.includes(type);

/** True for a page type a renderer and the Studio can work with: in PAGE_TYPES and not retired. */
export const isKnownPageType = (type) => hasKey(PAGE_TYPES, type) && !isRetiredPageType(type);

/**
 * Pages a renderer and the Studio can work with: objects with a non-empty
 * string id (first one wins when ids repeat) and a type from PAGE_TYPES.
 * Pages of a retired type (an old brochure's or draft's map page) are dropped,
 * like any other unknown type, so old data never breaks.
 */
export function sanitizePages(pages) {
  if (!Array.isArray(pages)) return [];
  const seen = new Set();
  return pages
    .filter((page) => {
      if (!isRecord(page) || typeof page.id !== 'string' || !page.id || !isKnownPageType(page.type)) return false;
      if (seen.has(page.id)) return false;
      seen.add(page.id);
      return true;
    })
    .map(normalizePage);
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * brochure.userPhotos (photos uploaded in the Studio): the entries that are
 * objects with a safe inline image src (data:image/… or blob:, see
 * safeImageSrc), or null when none is left. Fields that point at a dropped
 * key fall back to the cover art, as any missing photo does.
 */
export function sanitizeUserPhotoMap(value) {
  if (!isRecord(value)) return null;
  let changed = false;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key) || !isRecord(entry) || !safeImageSrc(entry.src)) {
      changed = true;
      continue;
    }
    out[key] = entry;
  }
  if (!Object.keys(out).length) return null;
  return changed ? out : value;
}

function sanitizeCover(cover) {
  if (!isRecord(cover)) return { ...DEFAULT_COVER };
  const art = ART_STYLES.includes(cover.art) ? cover.art : DEFAULT_COVER.art;
  const seed = Number.isFinite(cover.seed) ? cover.seed : DEFAULT_COVER.seed;
  const photoOk = !('photo' in cover) || typeof cover.photo === 'string';
  if (art === cover.art && seed === cover.seed && photoOk) return cover;
  return photoOk ? { ...cover, art, seed } : { ...cover, art, seed, photo: '' };
}

/**
 * A brochure with safe field types, or null when it is not an object or has
 * no readable pages. Fields that are present with the wrong type are reset:
 * text to '', unknown category/region/format to a default, seasons and tags
 * to their valid string entries, a non-object theme to {}, a location that is
 * not an object is removed, sources keep their http(s) entries, uploads keep
 * the entries with a safe inline image, and each page goes through
 * normalizePage (photo ids, coordinates, links).
 */
export function normalizeBrochure(value) {
  if (!isRecord(value)) return null;
  const pages = sanitizePages(value.pages);
  if (pages.length === 0) return null;

  const out = { ...value, pages };
  for (const key of TEXT_FIELDS) {
    if (key in out && typeof out[key] !== 'string') out[key] = '';
  }
  if ('category' in out && !hasKey(CATEGORY_MAP, out.category)) out.category = DEFAULT_CATEGORY;
  if ('region' in out && !hasKey(REGION_MAP, out.region)) out.region = DEFAULT_REGION;
  if ('format' in out && !FORMATS.some((f) => f.id === out.format)) out.format = DEFAULT_FORMAT;
  if ('seasons' in out) {
    const seasons = Array.isArray(out.seasons) ? out.seasons.filter((id) => hasKey(SEASON_MAP, id)) : [];
    out.seasons = [...new Set(seasons)];
  }
  if ('tags' in out) out.tags = Array.isArray(out.tags) ? out.tags.filter((tag) => typeof tag === 'string') : [];
  if ('theme' in out && !isRecord(out.theme)) out.theme = {};
  if ('cover' in out) out.cover = sanitizeCover(out.cover);
  if ('readMinutes' in out && !(Number.isFinite(out.readMinutes) && out.readMinutes > 0)) out.readMinutes = 1;
  if ('featured' in out && typeof out.featured !== 'boolean') out.featured = false;
  if ('location' in out) {
    const location = sanitizeLocation(out.location);
    if (location) out.location = location;
    else delete out.location;
  }
  if ('sources' in out) out.sources = sanitizeSources(out.sources);
  if ('userPhotos' in out) {
    const photos = sanitizeUserPhotoMap(out.userPhotos);
    if (photos) out.userPhotos = photos;
    else delete out.userPhotos;
  }
  return out;
}

/** A stored user brochure: needs a string id and slug on top of normalizeBrochure. */
export function sanitizeStoredBrochure(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.slug !== 'string' || !value.slug) return null;
  return normalizeBrochure(value);
}
