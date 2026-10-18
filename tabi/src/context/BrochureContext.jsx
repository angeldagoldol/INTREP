import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BUILTINS as BROCHURES } from '../data/catalog.js';
import { sanitizeStoredBrochure } from '../data/sanitize.js';
import { readStorage, writeStorage } from '../lib/storage.js';
import { createId, uniqueSlug } from '../lib/id.js';
import { estimateReadMinutes } from '../lib/format.js';

const BrochureContext = createContext(null);
const RECENT_LIMIT = 8;

/**
 * Brochures from storage, normalised so every renderer can trust them
 * (data/sanitize.js): anything without a string id, slug and at least one
 * readable page is dropped, unreadable pages are skipped and fields of the
 * wrong type are reset. Valid records come back unchanged.
 */
export function sanitizeUserBrochures(value) {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeStoredBrochure).filter(Boolean);
}

/** A unique list of string ids; anything else in storage is ignored. */
export function sanitizeIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && id))];
}

const STORAGE_READERS = {
  brochures: () => sanitizeUserBrochures(readStorage('brochures', [])),
  favorites: () => sanitizeIds(readStorage('favorites', [])),
  recent: () => sanitizeIds(readStorage('recent', [])).slice(0, RECENT_LIMIT),
};

/**
 * The brochure library: built-in brochures plus the ones a visitor makes in
 * the Studio (persisted to localStorage), favourites and recently-viewed
 * history. Built-ins are outlines from src/data/catalog.js (every field, but
 * pages without their text): render pages through useFullBrochure().
 */
export function BrochureProvider({ children }) {
  const [userBrochures, setUserBrochures] = useState(STORAGE_READERS.brochures);
  const [favoriteIds, setFavoriteIds] = useState(STORAGE_READERS.favorites);
  const [recentIds, setRecentIds] = useState(STORAGE_READERS.recent);
  // The latest user list, for writes that must know synchronously whether
  // storage accepted them. Updated wherever the state is replaced.
  const userRef = useRef(userBrochures);

  // Keep several open tabs in step: a brochure published or favourited in one
  // tab shows up in the others without a reload.
  useEffect(() => {
    const setUser = (list) => {
      userRef.current = list;
      setUserBrochures(list);
    };
    const setters = { brochures: setUser, favorites: setFavoriteIds, recent: setRecentIds };
    const onStorage = (event) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === null) {
        Object.entries(setters).forEach(([key, set]) => set(STORAGE_READERS[key]()));
        return;
      }
      const key = event.key.startsWith('tabi:') ? event.key.slice(5) : null;
      if (key && setters[key]) setters[key](STORAGE_READERS[key]());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const brochures = useMemo(() => [...userBrochures, ...BROCHURES], [userBrochures]);

  /**
   * Write the next user list to storage first and only show it when the write
   * succeeded, so the UI never claims a brochure is saved when it is not
   * (full quota, storage disabled). Returns whether it was saved.
   */
  const persistUser = useCallback((updater) => {
    const next = updater(userRef.current);
    if (!writeStorage('brochures', next)) return false;
    userRef.current = next;
    setUserBrochures(next);
    return true;
  }, []);

  const getBySlug = useCallback((slug) => brochures.find((b) => b.slug === slug) ?? null, [brochures]);
  const getById = useCallback((id) => brochures.find((b) => b.id === id) ?? null, [brochures]);

  /**
   * Create or update a user brochure. Returns the saved copy (with final
   * id/slug), or null when storage refused the write (nothing changes then).
   */
  const saveBrochure = useCallback(
    (draft) => {
      const list = userRef.current;
      const all = [...list, ...BROCHURES];
      const existing = draft.id ? list.find((b) => b.id === draft.id) : undefined;
      // Only the brochure being updated may keep its own slug; a draft that
      // still carries a built-in's id (a remix) must not take that slug.
      const taken = new Set(all.filter((b) => b !== existing).map((b) => b.slug));
      const idTaken = Boolean(draft.id) && all.some((b) => b.id === draft.id);
      const saved = {
        ...draft,
        id: existing ? draft.id : draft.id && !idTaken ? draft.id : createId('b'),
        slug: uniqueSlug(draft.slug || draft.title, taken),
        source: 'user',
        updatedAt: new Date().toISOString(),
        readMinutes: estimateReadMinutes(draft),
      };
      const ok = persistUser((current) => (existing ? current.map((b) => (b.id === saved.id ? saved : b)) : [saved, ...current]));
      return ok ? saved : null;
    },
    [persistUser],
  );

  /** Remove a user brochure (and its favourite/recent entries). Returns false when storage refused. */
  const deleteBrochure = useCallback(
    (id) => {
      if (!persistUser((list) => list.filter((b) => b.id !== id))) return false;
      setFavoriteIds((ids) => {
        if (!ids.includes(id)) return ids;
        const next = ids.filter((x) => x !== id);
        writeStorage('favorites', next);
        return next;
      });
      setRecentIds((ids) => {
        if (!ids.includes(id)) return ids;
        const next = ids.filter((x) => x !== id);
        writeStorage('recent', next);
        return next;
      });
      return true;
    },
    [persistUser],
  );

  const toggleFavorite = useCallback((id) => {
    setFavoriteIds((ids) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
      writeStorage('favorites', next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id) => favoriteIds.includes(id), [favoriteIds]);

  const markViewed = useCallback((id) => {
    setRecentIds((ids) => {
      if (ids[0] === id) return ids;
      const next = [id, ...ids.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
      writeStorage('recent', next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      brochures,
      builtins: BROCHURES,
      userBrochures,
      favoriteIds,
      recentIds,
      getBySlug,
      getById,
      saveBrochure,
      deleteBrochure,
      toggleFavorite,
      isFavorite,
      markViewed,
    }),
    [
      brochures,
      userBrochures,
      favoriteIds,
      recentIds,
      getBySlug,
      getById,
      saveBrochure,
      deleteBrochure,
      toggleFavorite,
      isFavorite,
      markViewed,
    ],
  );

  return <BrochureContext.Provider value={value}>{children}</BrochureContext.Provider>;
}

export function useBrochures() {
  const ctx = useContext(BrochureContext);
  if (!ctx) throw new Error('useBrochures must be used inside <BrochureProvider>');
  return ctx;
}
