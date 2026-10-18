import { useCallback, useEffect, useMemo } from 'react';
import { useIsPresent } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { rememberLibrarySearch } from '../../lib/librarySearch.js';
import { parseFilters, toSearchParams } from './libraryParams.js';

/**
 * Library filters, stored in the URL so they are shareable and the back
 * button steps through them.
 *   const [filters, update] = useLibraryFilters();
 *   update({ category: 'food' });                 // pushes a history entry
 *   update({ q: 'kyo' }, { replace: true });      // replaces it (typing)
 */
export function useLibraryFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  // The reader's "Library" link returns to this view (lib/librarySearch.js).
  // Not while the page animates out: the router already holds the next URL.
  const present = useIsPresent();
  useEffect(() => {
    if (present) rememberLibrarySearch(toSearchParams(filters).toString());
  }, [filters, present]);

  const update = useCallback(
    (patch, { replace = false } = {}) => {
      setParams((current) => toSearchParams({ ...parseFilters(current), ...patch }), { replace, preventScrollReset: true });
    },
    [setParams],
  );

  return [filters, update];
}
