/**
 * The photo picker's library, as pure functions: the built-in real photos
 * (data/photos listPhotos()) grouped by the brochure that uses them, searched
 * across caption, place, alt text and brochure, filtered by region and
 * availability, with suggestions for the field being edited. Status labels
 * say honestly which photos are downloaded and which still show the art.
 */
import { fold, foldQuery } from '../layout/search.js';
import { photoIdsIn } from '../../data/photos/registry.js';

/** Entry "group" for photos that no built-in brochure shows (the home page's, imports). */
export const OTHER_GROUP = 'more';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Library entries, one per registry photo, in brochure order:
 *   { id, photo, caption, place, alt, use, orientation, available, brochure, group, haystack }
 * `brochure` is the first built-in that uses the photo ({ slug, title, titleJp, region, theme, cover })
 * or null; `orientation` is 'portrait' | 'landscape' | 'any' (measured once downloaded,
 * else from the manifest's `use`).
 */
export function buildLibrary(photos, brochures = []) {
  const owner = new Map();
  const order = new Map();
  (Array.isArray(brochures) ? brochures : []).forEach((b) => {
    photoIdsIn(b).forEach((id, i) => {
      if (owner.has(id)) return;
      owner.set(id, b);
      order.set(id, i);
    });
  });
  const brochureIndex = new Map((brochures ?? []).map((b, i) => [b, i]));
  const entries = (Array.isArray(photos) ? photos : [])
    .filter((photo) => photo && typeof photo.id === 'string' && !photo.user)
    .map((photo) => {
      const b = owner.get(photo.id) ?? null;
      const brochure = b && {
        slug: b.slug,
        title: text(b.title),
        titleJp: text(b.titleJp),
        region: text(b.region),
        theme: b.theme,
        cover: b.cover,
      };
      return {
        id: photo.id,
        photo,
        caption: text(photo.caption),
        place: text(photo.place),
        alt: text(photo.alt),
        use: text(photo.use) || 'any',
        orientation: orientationOf(photo),
        available: Boolean(photo.available),
        brochure,
        group: brochure ? brochure.slug : OTHER_GROUP,
        haystack: fold([photo.caption, photo.place, photo.alt, photo.id.replace(/-/g, ' '), brochure?.title, brochure?.titleJp].filter(Boolean).join(' · ')),
        rank: b ? brochureIndex.get(b) * 1000 + order.get(photo.id) : Number.MAX_SAFE_INTEGER,
      };
    });
  return entries.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

/** 'portrait' | 'landscape' | 'any' — from the downloaded size, else the manifest's intended use. */
export function orientationOf(photo) {
  if (photo?.width && photo?.height) return photo.height > photo.width ? 'portrait' : 'landscape';
  if (photo?.use === 'cover') return 'portrait';
  if (photo?.use === 'wide') return 'landscape';
  return 'any';
}

/**
 * Entries matching a search: every word of `query` must appear (folded:
 * case, accents, width, kana); `region` keeps one region's brochures
 * ('' = all); `readyOnly` keeps downloaded photos.
 */
export function searchLibrary(entries, { query = '', region = '', readyOnly = false } = {}) {
  const words = foldQuery(query).split(' ').filter(Boolean);
  return entries.filter(
    (entry) =>
      (!region || entry.brochure?.region === region) &&
      (!readyOnly || entry.available) &&
      words.every((word) => entry.haystack.includes(word)),
  );
}

/** Entries grouped for display: [{ key, title, titleJp, region, entries }], brochures first, "More photos" last. */
export function groupLibrary(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.group)) {
      groups.set(entry.group, {
        key: entry.group,
        title: entry.brochure?.title || 'More photos',
        titleJp: entry.brochure?.titleJp || '写真',
        region: entry.brochure?.region || '',
        entries: [],
      });
    }
    groups.get(entry.group).entries.push(entry);
  }
  const list = [...groups.values()];
  return [...list.filter((g) => g.key !== OTHER_GROUP), ...list.filter((g) => g.key === OTHER_GROUP)];
}

/** Region ids that have photos, in the order given (data/regions.js order). */
export function regionsWithPhotos(entries, regionIds) {
  const present = new Set(entries.map((e) => e.brochure?.region).filter(Boolean));
  return regionIds.filter((id) => present.has(id));
}

const STOP = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'a', 'to', 'from', 'with', 'for', 'your', 'new', 'view', 'place']);

/** Folded words of 3+ letters from the hints ("Fushimi Inari Taisha" → fushimi, inari, taisha). */
export function hintWords(hints) {
  const words = new Set();
  for (const hint of hints ?? []) {
    for (const word of fold(hint).split(/[^\p{L}\p{N}]+/u)) {
      if (word.length >= 3 && !STOP.has(word) && !/^\d+$/.test(word)) words.add(word);
    }
  }
  return [...words];
}

/**
 * Photos that fit what is being edited, best first: each hint word found in
 * the photo's place or caption scores (place counts double); photos of the
 * same brochure get a small bonus. `hints` are strings such as the place's
 * name, the brochure title and its location; `preferred` an orientation.
 */
export function suggestPhotos(entries, { hints = [], brochureSlug = '', preferred = '', limit = 6, exclude = '' } = {}) {
  const words = hintWords(hints);
  if (!words.length) return [];
  return entries
    .filter((entry) => entry.id !== exclude)
    .map((entry) => {
      const place = fold(entry.place);
      const caption = fold(`${entry.caption} ${entry.alt}`);
      let score = 0;
      for (const word of words) {
        if (place.includes(word)) score += 2;
        else if (caption.includes(word)) score += 1;
      }
      if (score > 0 && brochureSlug && entry.brochure?.slug === brochureSlug) score += 0.5;
      if (score > 0 && preferred && entry.orientation === preferred) score += 0.25;
      return { entry, score };
    })
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score || a.entry.rank - b.entry.rank)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * How a photo field's current value stands, for its status line:
 *   { kind: 'empty' | 'ready' | 'pending' | 'user' | 'broken' | 'unknown', label, detail }
 * 'pending' = a real photo chosen but not downloaded yet (the art shows for now);
 * 'broken' = an upload whose data is unusable; 'unknown' = an id nobody knows.
 */
export function photoStatus(id, record) {
  const value = text(id);
  if (!value) return { kind: 'empty', label: 'No photo', detail: 'The page shows the brochure’s cover art.' };
  if (!record) {
    return value.startsWith('user:')
      ? { kind: 'broken', label: 'Photo missing', detail: 'This upload is no longer in the brochure. Choose another photo.' }
      : { kind: 'unknown', label: 'Unknown photo', detail: `“${value}” isn’t in the photo library. Choose another photo.` };
  }
  if (record.user) {
    return record.available
      ? { kind: 'user', label: 'Your photo', detail: [record.width && record.height ? `${record.width} × ${record.height}` : '', 'stored in this brochure'].filter(Boolean).join(' · ') }
      : { kind: 'broken', label: 'Photo can’t be shown', detail: 'Its image data is damaged. Upload it again.' };
  }
  return record.available
    ? { kind: 'ready', label: 'Real photo', detail: 'Downloaded and credited' }
    : { kind: 'pending', label: 'Not downloaded yet', detail: 'The cover art stands in until the photo arrives.' };
}

/** { total, ready } counts for the library summary. */
export function libraryCounts(entries) {
  return { total: entries.length, ready: entries.filter((e) => e.available).length };
}

/** A stable small number for an id (seeds the stand-in art of photos not downloaded yet). */
export function idSeed(id) {
  let h = 2166136261;
  for (const ch of String(id ?? '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return 1 + ((h >>> 0) % 9973);
}
