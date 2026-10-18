/**
 * Where the visitor left off in each brochure, so "Continue reading" can
 * reopen the page instead of the cover. Stored as `tabi:progress`
 * ({ [brochureId]: pageIndex }), newest last, at most MAX_ENTRIES long.
 * Page 0 (the cover) is not stored: there is nothing to resume.
 */
import { readStorage, writeStorage } from './storage.js';

const KEY = 'progress';
export const MAX_ENTRIES = 40;

const isPage = (value) => Number.isInteger(value) && value > 0;

/** Every saved position, with anything malformed dropped. */
export function readProgress() {
  const stored = readStorage(KEY, {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  return Object.fromEntries(Object.entries(stored).filter(([id, page]) => id && isPage(page)));
}

/** The page to resume `brochure` at: 0 when unknown, clamped to its pages. */
export function progressOf(brochure, progress = readProgress()) {
  const count = Array.isArray(brochure?.pages) ? brochure.pages.length : 0;
  const page = brochure?.id && Object.hasOwn(progress, brochure.id) ? progress[brochure.id] : 0;
  return count > 0 ? Math.min(Math.max(page, 0), count - 1) : 0;
}

/** Viewer path that reopens `brochure` at `page` (the reader clamps stale values). */
export function resumePath(brochure, page = 0) {
  const path = `/brochures/${encodeURIComponent(brochure?.slug ?? '')}`;
  return isPage(page) ? `${path}?p=${page}` : path;
}

/** Remember that `id` is open at `page` (0 forgets it). Returns false if storage refused. */
export function saveProgress(id, page) {
  if (typeof id !== 'string' || !id) return false;
  // A Map keeps insertion order and treats any id (even "__proto__") as data.
  const positions = new Map(Object.entries(readProgress()));
  const keep = isPage(page);
  const unchanged = keep ? positions.get(id) === page && [...positions.keys()].at(-1) === id : !positions.has(id);
  if (unchanged) return true;
  positions.delete(id);
  if (keep) positions.set(id, page);
  return writeStorage(KEY, Object.fromEntries([...positions].slice(-MAX_ENTRIES)));
}
