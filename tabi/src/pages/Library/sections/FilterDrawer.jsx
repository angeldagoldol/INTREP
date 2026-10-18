import { useId } from 'react';
import { ArrowDownUp, MapPin } from 'lucide-react';
import { Button, Drawer, Switch } from '../../../components/ui/index.js';
import { hasActiveFilters, toggleSeason } from '../filterBrochures.js';
import { CategoryChips } from '../components/CategoryChips.jsx';
import { SeasonToggles } from '../components/SeasonToggles.jsx';
import { SelectControl } from '../components/SelectControl.jsx';
import { ViewToggle } from '../components/ViewToggle.jsx';
import { SORT_OPTIONS, regionOptions } from './filterOptions.js';
import styles from './FilterDrawer.module.css';

/** A labelled block of controls inside the drawer. */
function Group({ title, jp, children }) {
  const id = useId();
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h3 id={id} className={styles.heading}>
        {title}
        {jp && (
          <span lang="ja" className={styles.jp}>
            {jp}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

/**
 * Mobile filters in a bottom sheet. Changes apply live (the count on the
 * "Show N results" button updates as you tap); the button just closes it.
 */
export function FilterDrawer({ open, onClose, filters, facets, resultCount, favoritesCount, onChange, onClear }) {
  const active = hasActiveFilters({ ...filters, q: '' });
  return (
    <Drawer
      side="bottom"
      open={open}
      onClose={onClose}
      title="Filters"
      description="Narrow the library by mood, season and place."
      className={styles.drawer}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={() => onClear({ keepQuery: true })} disabled={!active}>
            Clear all
          </Button>
          <Button className={styles.show} onClick={onClose}>
            {resultCount === 0 ? 'No results — close' : `Show ${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
          </Button>
        </div>
      }
    >
      <div className={styles.groups}>
        <Group title="Category" jp="分類">
          <CategoryChips
            wrap
            value={filters.category}
            counts={facets.category}
            total={facets.allCategories}
            onChange={(category) => onChange({ category })}
          />
        </Group>

        <Group title="Season" jp="季節">
          <SeasonToggles
            labelled
            value={filters.seasons}
            counts={facets.season}
            onToggle={(id) => onChange({ seasons: toggleSeason(filters.seasons, id) })}
          />
        </Group>

        <div className={styles.pair}>
          <SelectControl
            showLabel
            label="Region"
            icon={<MapPin />}
            value={filters.region}
            options={regionOptions(facets.region)}
            onChange={(region) => onChange({ region })}
          />
          <SelectControl
            showLabel
            label="Sort by"
            icon={<ArrowDownUp />}
            value={filters.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => onChange({ sort })}
          />
        </div>

        <div className={styles.row}>
          <Switch
            checked={filters.fav}
            onChange={(fav) => onChange({ fav })}
            label={`Saved only (${favoritesCount})`}
          />
          <ViewToggle value={filters.view} onChange={(view) => onChange({ view })} />
        </div>
      </div>
    </Drawer>
  );
}
