import { useRef, useState } from 'react';
import { ArrowDownUp, Heart, MapPin, SlidersHorizontal } from 'lucide-react';
import { Button, Chip } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { countActiveFilters, toggleSeason } from '../filterBrochures.js';
import { useNavHidden } from '../../../components/layout/navState.js';
import { useStuck } from '../useStuck.js';
import { CategoryChips } from '../components/CategoryChips.jsx';
import { SearchBox } from '../components/SearchBox.jsx';
import { SeasonToggles } from '../components/SeasonToggles.jsx';
import { SelectControl } from '../components/SelectControl.jsx';
import { ViewToggle } from '../components/ViewToggle.jsx';
import { FilterDrawer } from './FilterDrawer.jsx';
import { SORT_OPTIONS, regionOptions } from './filterOptions.js';
import styles from './LibraryToolbar.module.css';

/**
 * Sticky filter bar under the navbar (it slides up into the bar's place
 * while the navbar is tucked away). Desktop shows every control; below
 * 860px it collapses to search + "Filters (n)", which opens a bottom drawer.
 * - `filters`, `facets` (facetCounts), `resultCount`, `favoritesCount`
 * - `onChange(patch, { replace })` update the URL (filters push; a search pushes
 *   once, then replaces while typing); `onClear()`
 * - `searchRef` focus target for the "/" shortcut; `toolbarRef` the sticky bar
 * - `compact` mobile layout
 */
export function LibraryToolbar({
  filters,
  facets,
  resultCount,
  favoritesCount,
  onChange,
  onClear,
  searchRef,
  toolbarRef,
  compact,
}) {
  const sentinelRef = useRef(null);
  const stuck = useStuck(sentinelRef);
  // While the navbar is tucked away the bar slides up into its place. The
  // Navbar publishes this (focus, the palette and the mobile menu keep it shown).
  const tucked = useNavHidden();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  // The first query of a search pushes one history entry, so Back returns to
  // the view before it; later keystrokes (and clearing) replace that entry.
  const search = (
    <SearchBox
      className={styles.search}
      value={filters.q}
      inputRef={searchRef}
      onCommit={(q) => onChange({ q }, { replace: Boolean(filters.q.trim() || !q.trim()) })}
    />
  );

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <div
        ref={toolbarRef}
        className={styles.toolbar}
        data-stuck={stuck || undefined}
        data-tucked={tucked || undefined}
        role="region"
        aria-label="Search and filters"
      >
        <div className={cn('container', compact ? styles.compact : styles.full)}>
          {compact ? (
            <>
              {search}
              <Button
                variant={activeCount ? 'primary' : 'secondary'}
                iconLeft={<SlidersHorizontal />}
                className={styles.filtersButton}
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
              >
                {activeCount ? `Filters (${activeCount})` : 'Filters'}
              </Button>
            </>
          ) : (
            <>
              {search}
              <SeasonToggles
                className={styles.seasons}
                value={filters.seasons}
                counts={facets.season}
                onToggle={(id) => onChange({ seasons: toggleSeason(filters.seasons, id) })}
              />
              <SelectControl
                className={styles.region}
                label="Region"
                icon={<MapPin />}
                value={filters.region}
                options={regionOptions(facets.region)}
                onChange={(region) => onChange({ region })}
              />
              <SelectControl
                className={styles.sort}
                label="Sort by"
                icon={<ArrowDownUp />}
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(sort) => onChange({ sort })}
              />
              <Chip
                className={styles.saved}
                selected={filters.fav}
                icon={<Heart />}
                count={favoritesCount}
                aria-label={`Saved only, ${favoritesCount} saved`}
                onClick={() => onChange({ fav: !filters.fav })}
              >
                Saved
              </Chip>
              <ViewToggle className={styles.view} value={filters.view} onChange={(view) => onChange({ view })} />
              <div className={styles.chipsRow}>
                <CategoryChips
                  value={filters.category}
                  counts={facets.category}
                  total={facets.allCategories}
                  onChange={(category) => onChange({ category })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {compact && (
        <FilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          filters={filters}
          facets={facets}
          resultCount={resultCount}
          favoritesCount={favoritesCount}
          onChange={onChange}
          onClear={onClear}
        />
      )}
    </>
  );
}
