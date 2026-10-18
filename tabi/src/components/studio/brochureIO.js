/**
 * JSON export/import for Studio drafts. Exports are the brochure itself plus
 * a small envelope; imports accept that envelope or a bare brochure, and are
 * sanitised into a safe, editable user draft (unknown page types dropped, and
 * old map pages — a retired type — left out; colours and enums validated,
 * fresh ids). The brochure's own photos (userPhotos) travel inside the file as
 * data: URLs; on import only inline JPEG, PNG and WebP within the size caps
 * are kept (photoUpload.js), and fields that pointed at a photo left behind
 * are cleared.
 */
import { ART_STYLES, FORMATS } from '../../data/schema.js';
import { CATEGORY_MAP } from '../../data/categories.js';
import { REGION_MAP } from '../../data/regions.js';
import { SEASON_MAP } from '../../data/seasons.js';
import { hasKey } from '../../data/lookup.js';
import { isKnownPageType, isRetiredPageType, normalizePage, sanitizeLocation, sanitizeSources } from '../../data/sanitize.js';
import { createId, slugify } from '../../lib/id.js';
import { isHex } from '../brochure/art/color.js';
import { PALETTE_MAP } from './palettes.js';
import { USER_PHOTO_BUDGET, sanitizeUserPhotos } from './photoUpload.js';

export const EXPORT_FORMAT = 'tabi-brochure';
export const EXPORT_VERSION = 1;
/** Imports larger than this are refused before parsing: the photo budget plus room for the pages. */
export const MAX_IMPORT_BYTES = USER_PHOTO_BUDGET + 1_500_000;
const MAX_PAGES = 40;
const MAX_TAGS = 12;

const FALLBACK_THEME = { ...PALETTE_MAP['shu-kinari'].theme, typeface: 'serif' };

/** Pretty-printed JSON for download. Volatile library fields are dropped. */
export function serializeBrochure(doc) {
  const { slug: _slug, featured: _featured, ...brochure } = doc ?? {};
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, brochure }, null, 2);
}

/** "tokyo-in-48-hours.tabi.json" */
export function exportFileName(doc) {
  return `${slugify(doc?.title) || 'brochure'}.tabi.json`;
}

const str = (value, max = 400) => (typeof value === 'string' ? value.slice(0, max) : '');

function sanitizeTheme(theme) {
  const source = theme && typeof theme === 'object' ? theme : {};
  const out = {};
  for (const key of ['paper', 'ink', 'accent', 'accent2', 'muted']) {
    out[key] = isHex(source[key]) ? source[key].trim().toLowerCase() : FALLBACK_THEME[key];
  }
  out.typeface = ['serif', 'sans', 'mono'].includes(source.typeface) ? source.typeface : 'serif';
  return out;
}

/** Keep plain JSON values only (no functions, prototypes or absurd nesting). */
function plain(value, depth = 0) {
  if (depth > 6) return undefined;
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 24).map((v) => plain(v, depth + 1)).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      // An own "__proto__" key (JSON.parse creates one) would re-parent `out`.
      if (key === '__proto__') continue;
      const clean = plain(v, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

/** Clear "user:<key>" photo ids whose upload is not in `photos` (a page field, an item, the cover). */
function dropMissingUserPhotos(doc, photos) {
  const keep = (id) => typeof id !== 'string' || !id.startsWith('user:') || Boolean(photos && Object.hasOwn(photos, id.slice(5)));
  const fixItems = (items) => (Array.isArray(items) && items.some((item) => !keep(item?.photo)) ? items.map((item) => (keep(item?.photo) ? item : { ...item, photo: '' })) : items);
  const pages = doc.pages.map((page) => {
    const items = fixItems(page.items);
    if (keep(page.photo) && items === page.items) return page;
    return { ...page, ...(keep(page.photo) ? {} : { photo: '' }), ...(items === page.items ? {} : { items }) };
  });
  const cover = keep(doc.cover.photo) ? doc.cover : { ...doc.cover, photo: '' };
  return { ...doc, cover, pages };
}

/**
 * Parse an exported file's text into a fresh draft.
 * Returns { ok: true, doc, dropped, droppedPhotos } or { ok: false, error } with a message for people
 * (`dropped`: unreadable pages; `droppedPhotos`: uploads that were unsafe or over the size caps).
 */
export function parseBrochureJson(text, { makeId = createId, now = new Date() } = {}) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'That file is empty.' };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'That file is too large to be a brochure.' };

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }

  const source = data && typeof data === 'object' && data.format === EXPORT_FORMAT ? data.brochure : data;
  if (!source || typeof source !== 'object' || !Array.isArray(source.pages)) {
    return { ok: false, error: 'This doesn’t look like a Tabi brochure — it has no pages.' };
  }

  const known = source.pages.filter((p) => p && typeof p === 'object' && isKnownPageType(p.type));
  // Map pages (a retired type) are left out on purpose: Tabi shows photographs of the places instead.
  const retired = source.pages.filter((p) => p && typeof p === 'object' && isRetiredPageType(p.type)).length;
  // Pages keep plain JSON only, then the same field rules as stored brochures:
  // photo ids are strings, coordinates are real, links are http(s) only.
  const pages = known.slice(0, MAX_PAGES).map((p) => normalizePage({ ...plain(p), id: makeId('pg'), type: p.type }));
  if (pages.length === 0) return { ok: false, error: 'None of the pages in that file could be read.' };

  const cover = source.cover && typeof source.cover === 'object' ? source.cover : {};
  const seed = Number.parseInt(cover.seed, 10);
  const tags = Array.isArray(source.tags) ? source.tags.filter((t) => typeof t === 'string' && t.trim()) : [];

  const doc = {
    id: makeId('b'),
    slug: '',
    title: str(source.title, 120).trim(),
    titleJp: str(source.titleJp, 12).trim() || '旅',
    subtitle: str(source.subtitle, 200),
    category: hasKey(CATEGORY_MAP, source.category) ? source.category : 'heritage',
    region: hasKey(REGION_MAP, source.region) ? source.region : 'kansai',
    seasons: Array.isArray(source.seasons) ? [...new Set(source.seasons.filter((s) => hasKey(SEASON_MAP, s)))] : [],
    organization: str(source.organization, 80),
    summary: str(source.summary, 400),
    tags: [...new Set(tags.map((t) => t.trim().toLowerCase().slice(0, 32)))].slice(0, MAX_TAGS),
    format: FORMATS.some((f) => f.id === source.format) ? source.format : 'booklet',
    updatedAt: now.toISOString(),
    readMinutes: 1,
    featured: false,
    source: 'user',
    theme: sanitizeTheme(source.theme),
    cover: {
      art: ART_STYLES.includes(cover.art) ? cover.art : 'hinomaru',
      seed: Number.isFinite(seed) && seed > 0 ? seed : 1,
      ...(typeof cover.photo === 'string' && cover.photo.trim() ? { photo: cover.photo.trim().slice(0, 80) } : {}),
    },
    pages,
  };
  // The real place a brochure is about, and where its facts come from.
  const location = sanitizeLocation(plain(source.location));
  if (location && Object.keys(location).length) doc.location = location;
  const sources = sanitizeSources(plain(source.sources)).slice(0, 12);
  if (sources.length) doc.sources = sources;
  if (typeof source.factsChecked === 'string' && source.factsChecked.trim()) doc.factsChecked = str(source.factsChecked, 40).trim();
  // The brochure's own photos: inline JPEG/PNG/WebP only, within the per-photo and per-brochure caps.
  const { photos, dropped: droppedPhotos } = sanitizeUserPhotos(source.userPhotos, { budget: USER_PHOTO_BUDGET });
  if (photos) doc.userPhotos = photos;
  return { ok: true, doc: dropMissingUserPhotos(doc, photos), dropped: source.pages.length - pages.length - retired, retired, droppedPhotos };
}
