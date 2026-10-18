import { IconButton } from '../../../components/ui/index.js';
import { SEASONS } from '../../../data/seasons.js';
import { cn } from '../../../lib/cn.js';
import styles from './SeasonToggles.module.css';

/**
 * 春 夏 秋 冬 — multi-select season toggles, each in its wa-iro colour.
 * - `value`  selected season ids; `counts` { [id]: n }
 * - `onToggle(id)`
 * - `labelled` show the English name beside each kanji (drawer)
 */
export function SeasonToggles({ value = [], counts = {}, onToggle, labelled = false, className }) {
  return (
    <div role="group" aria-label="Season" className={cn(styles.seasons, labelled && styles.labelled, className)}>
      {SEASONS.map((season) => {
        const pressed = value.includes(season.id);
        const count = counts[season.id] ?? 0;
        const name = `${season.label} · ${season.months}`;
        const glyph = (
          <span lang="ja" className={styles.kanji}>
            {season.jp}
          </span>
        );
        if (labelled) {
          return (
            <button
              key={season.id}
              type="button"
              aria-pressed={pressed}
              className={cn(styles.toggle, styles.wide)}
              data-season={season.id}
              style={{ '--season': season.color }}
              onClick={() => onToggle(season.id)}
            >
              {glyph}
              <span className={styles.text}>
                <span className={styles.name}>{season.label}</span>
                <span className={styles.months}>{season.months}</span>
              </span>
              <span className={styles.count} aria-label={`${count} ${count === 1 ? 'brochure' : 'brochures'}`}>
                {count}
              </span>
            </button>
          );
        }
        return (
          <IconButton
            key={season.id}
            label={`${name} · ${count}`}
            aria-label={`${season.label}, ${count} ${count === 1 ? 'brochure' : 'brochures'}`}
            aria-pressed={pressed}
            tooltipSide="bottom"
            className={styles.toggle}
            data-season={season.id}
            style={{ '--season': season.color }}
            onClick={() => onToggle(season.id)}
            icon={glyph}
          />
        );
      })}
    </div>
  );
}
