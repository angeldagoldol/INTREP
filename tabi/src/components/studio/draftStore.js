/**
 * Where the Studio keeps work in progress (localStorage via lib/storage):
 *  - 'studio-draft'       the new, unpublished brochure being made
 *  - 'studio-edit:<id>'   unsaved changes to a brochure already in the library
 * A draft record is { doc, selectedId, savedAt }.
 */
import { normalizeBrochure } from '../../data/sanitize.js';
import { readStorage, removeStorage, writeStorage } from '../../lib/storage.js';
import { sanitizeUserPhotos } from './photoUpload.js';

export const DRAFT_KEY = 'studio-draft';

export function editDraftKey(id) {
  return `studio-edit:${id}`;
}

/**
 * A stored draft, or null when missing or malformed. The doc is normalised
 * like a stored brochure (data/sanitize.js): unreadable pages are skipped and
 * fields of the wrong type reset, so the editor never meets a null page. Its
 * uploads (userPhotos) keep only safe inline images; a valid draft comes back
 * with the same values.
 */
export function readDraft(key) {
  const value = readStorage(key, null);
  if (!value || typeof value !== 'object') return null;
  const { selectedId, savedAt } = value;
  if (!value.doc || typeof value.doc !== 'object' || typeof value.doc.id !== 'string' || !Array.isArray(value.doc.pages)) return null;
  let doc = normalizeBrochure(value.doc);
  if (!doc) return null;
  if ('userPhotos' in doc) {
    const { photos } = sanitizeUserPhotos(doc.userPhotos);
    if (photos !== doc.userPhotos) {
      const { userPhotos: _unsafe, ...rest } = doc;
      doc = photos ? { ...rest, userPhotos: photos } : rest;
    }
  }
  return { doc, selectedId: typeof selectedId === 'string' ? selectedId : null, savedAt: Number(savedAt) || 0 };
}

/** Persist a draft; returns false when storage is unavailable or full. */
export function writeDraft(key, { doc, selectedId }, savedAt = Date.now()) {
  return writeStorage(key, { doc, selectedId, savedAt });
}

export function clearDraft(key) {
  removeStorage(key);
}

/** A short stand-in for an upload's data: URL (its length and last characters), so signatures stay small. */
function photoPrint(src) {
  return typeof src === 'string' ? `${src.length}:${src.slice(-64)}` : src;
}

/**
 * Content fingerprint that ignores bookkeeping fields, for "unsaved changes"
 * checks. Uploaded photos count by a short print of their data, not the
 * megabytes of base64 themselves (it runs on every edit).
 */
export function contentSignature(doc) {
  if (!doc) return '';
  const { updatedAt: _u, readMinutes: _r, slug: _s, source: _src, featured: _f, userPhotos, ...content } = doc;
  if (userPhotos && typeof userPhotos === 'object') {
    content.userPhotos = Object.fromEntries(Object.entries(userPhotos).map(([key, photo]) => [key, photo && typeof photo === 'object' ? { ...photo, src: photoPrint(photo.src) } : photo]));
  }
  return JSON.stringify(content);
}
