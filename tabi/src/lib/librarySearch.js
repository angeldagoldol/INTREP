/**
 * The Library's last query string ("?season=winter&view=list"), so the
 * reader's "Library" link returns to the view the visitor came from instead
 * of an unfiltered library. Kept for this tab only (sessionStorage,
 * `tabi:library-search`); every failure degrades to "no filters".
 */
const KEY = 'tabi:library-search';

let last = null;

/** "season=winter" or "?season=winter" → "?season=winter"; anything empty → "". */
function normalise(search) {
  const query = String(search ?? '').trim().replace(/^\?/, '');
  return query && !query.includes('#') ? `?${query}` : '';
}

/** Remember the Library's current query string (call it whenever it changes). */
export function rememberLibrarySearch(search) {
  last = normalise(search);
  try {
    window.sessionStorage.setItem(KEY, last);
  } catch {
    /* storage unavailable — the in-memory copy still covers this visit */
  }
}

/** The remembered query string, "" when there is none. */
export function lastLibrarySearch() {
  if (last !== null) return last;
  try {
    return normalise(window.sessionStorage.getItem(KEY));
  } catch {
    return '';
  }
}

/** Router path back to the Library view the visitor last had open. */
export function libraryPath() {
  return `/brochures${lastLibrarySearch()}`;
}

/** Tests only: forget the in-memory copy. */
export function resetLibrarySearchMemory() {
  last = null;
}
