import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useHotkey } from '../../hooks/useHotkey.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { facetCounts, filterBrochures, hasActiveFilters } from './filterBrochures.js';
import { useLibraryFilters } from './useLibraryFilters.js';
import { LibraryHeader } from './sections/LibraryHeader.jsx';
import { LibraryToolbar } from './sections/LibraryToolbar.jsx';
import { RecentShelf } from './sections/RecentShelf.jsx';
import { Results } from './sections/Results.jsx';
import { YourShelf } from './sections/YourShelf.jsx';
import styles from './Library.module.css';

const CLEARED = { category: '', seasons: [], region: '', fav: false };

/**
 * #/brochures — the library. Every filter lives in the URL
 * (q, category, season, region, fav, sort, view). While nothing is
 * filtered, the visitor's own brochures and reading history sit above the
 * full collection; once they search or filter, the page is all results.
 */
export default function Library() {
  useDocumentTitle('Library');
  const { brochures, userBrochures, favoriteIds, recentIds, getById } = useBrochures();
  const [filters, update] = useLibraryFilters();
  const compact = useMediaQuery('(max-width: 859.98px)');
  const reduceMotion = useReducedMotion();
  const searchRef = useRef(null);
  const toolbarRef = useRef(null);
  const resultsRef = useRef(null);
  const revealPending = useRef(false);

  const ctx = useMemo(() => ({ favoriteIds }), [favoriteIds]);
  const results = useMemo(() => filterBrochures(brochures, filters, ctx), [brochures, filters, ctx]);
  const facets = useMemo(() => facetCounts(brochures, filters, ctx), [brochures, filters, ctx]);
  const recent = useMemo(() => recentIds.map(getById).filter(Boolean), [recentIds, getById]);
  const filtering = hasActiveFilters(filters);

  const stats = useMemo(() => {
    const saved = new Set(favoriteIds);
    return {
      brochures: brochures.length,
      regions: new Set(brochures.map((b) => b.region).filter(Boolean)).size,
      minutes: brochures.reduce((sum, b) => sum + (Number.isFinite(b.readMinutes) ? b.readMinutes : 0), 0),
      saved: brochures.filter((b) => saved.has(b.id)).length,
    };
  }, [brochures, favoriteIds]);

  const change = useCallback(
    (patch, options) => {
      revealPending.current = true;
      update(patch, options);
    },
    [update],
  );

  const clear = useCallback(
    ({ keepQuery = false } = {}) => change(keepQuery ? CLEARED : { ...CLEARED, q: '' }),
    [change],
  );

  useHotkey('/', () => searchRef.current?.focus());

  // After a filter change, if the results start above the sticky bar (the
  // reader had scrolled down), bring their top back into view.
  useLayoutEffect(() => {
    if (!revealPending.current) return;
    revealPending.current = false;
    const section = resultsRef.current;
    if (!section) return;
    const navHeight = parseFloat(getComputedStyle(section).getPropertyValue('--nav-h')) || 0;
    const limit = navHeight + (toolbarRef.current?.offsetHeight ?? 0);
    const top = section.getBoundingClientRect().top;
    if (top < limit) window.scrollBy({ top: top - limit, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [filters, reduceMotion]);

  let section = 0;
  const yoursNum = !filtering && userBrochures.length > 0 ? ++section : null;
  const recentNum = !filtering && recent.length > 0 ? ++section : null;
  const resultsNum = ++section;

  return (
    <div className={styles.page}>
      <LibraryHeader stats={stats} />

      <LibraryToolbar
        toolbarRef={toolbarRef}
        filters={filters}
        facets={facets}
        resultCount={results.length}
        favoritesCount={stats.saved}
        onChange={change}
        onClear={clear}
        searchRef={searchRef}
        compact={compact}
      />

      {yoursNum && <YourShelf num={yoursNum} brochures={userBrochures} />}
      {recentNum && <RecentShelf num={recentNum} brochures={recent} />}

      <Results
        ref={resultsRef}
        num={resultsNum}
        results={results}
        total={brochures.length}
        filters={filters}
        filtering={filtering}
        brochures={brochures}
        favoriteIds={favoriteIds}
        onChange={change}
        onApply={change}
        onClear={clear}
      />
    </div>
  );
}
