import { useId, useLayoutEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { BrochureCard } from '../../../components/brochure/BrochureCard.jsx';
import { cn } from '../../../lib/cn.js';
import { ease } from '../../../lib/motion.js';
import { describeFilters } from '../filterBrochures.js';
import { NO_TRACKS, emptyCells, readTracks } from '../gridTracks.js';
import { ActiveFilters } from '../components/ActiveFilters.jsx';
import { CreateTile } from '../components/CreateTile.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ShelfHead } from '../components/ShelfHead.jsx';
import styles from './Results.module.css';

const swap = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: ease.in } },
};

/** Columns of a CSS grid (auto-fill), re-measured as it resizes. Returns [ref, tracks]. */
function useGridTracks(enabled) {
  const [element, setElement] = useState(null);
  const [tracks, setTracks] = useState(NO_TRACKS);
  useLayoutEffect(() => {
    if (!enabled || !element) return undefined;
    const measure = () => {
      const next = readTracks(getComputedStyle(element).gridTemplateColumns);
      setTracks((prev) => (prev.count === next.count && Math.abs(prev.width - next.width) < 0.5 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, element]);
  return [setElement, enabled ? tracks : NO_TRACKS];
}

/**
 * "All brochures" / search results: running head, a live result count,
 * removable filter pills, then the cards. Cards glide to their new places
 * when filters change (LayoutGroup + popLayout); switching grid/list
 * cross-fades the whole set. Shows <EmptyState> when nothing matches.
 * Unfiltered, a grid whose last row has empty cells ends with a "create
 * your own" tile spanning exactly those cells, so the shelf ends flush.
 */
export function Results({ num, results, total, filters, filtering, brochures, favoriteIds, onChange, onApply, onClear, ref }) {
  const headingId = useId();
  const pills = describeFilters(filters);
  const count = results.length;
  const view = filters.view === 'list' ? 'list' : 'grid';
  const [gridRef, tracks] = useGridTracks(view === 'grid' && !filtering && count > 0);
  const endSpan = emptyCells(count, tracks.count);

  return (
    <section ref={ref} className={styles.results} aria-labelledby={headingId}>
      <div className="container">
        <ShelfHead id={headingId} num={num} title={filtering ? 'Results' : 'All brochures'} jp={filtering ? '検索結果' : '一覧'} />

        <div className={styles.summary}>
          <p className={styles.count} aria-live="polite" aria-atomic="true">
            <strong>{count}</strong> {count === 1 ? 'brochure' : 'brochures'}
            {filtering && <span className={styles.of}> of {total}</span>}
          </p>
          {pills.length > 0 && (
            <ActiveFilters pills={pills} onRemove={(patch) => onChange(patch)} onClear={() => onClear()} />
          )}
        </div>

        {count === 0 ? (
          <EmptyState filters={filters} brochures={brochures} favoriteIds={favoriteIds} onApply={onApply} onClear={() => onClear()} />
        ) : (
          <LayoutGroup id="library-results">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                ref={view === 'grid' ? gridRef : undefined}
                className={cn(styles.cards, styles[view])}
                variants={swap}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <AnimatePresence mode="popLayout">
                  {results.map((brochure, i) => (
                    <BrochureCard key={brochure.id ?? brochure.slug} brochure={brochure} index={i} variant={view} layout />
                  ))}
                  {endSpan > 0 && (
                    <motion.div
                      key="create-tile"
                      className={styles.createItem}
                      style={{ gridColumn: `span ${endSpan}` }}
                      layout="position"
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: ease.out, delay: 0.3 } }}
                      exit={{ opacity: 0, transition: { duration: 0.18, ease: ease.in } }}
                    >
                      <CreateTile span={endSpan} style={{ '--col': `${tracks.width}px` }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
    </section>
  );
}
