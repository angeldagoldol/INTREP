import { useId } from 'react';
import { motion } from 'framer-motion';
import { Chip } from '../../../components/ui/index.js';
import { CATEGORIES } from '../../../data/categories.js';
import { cn } from '../../../lib/cn.js';
import { spring } from '../../../lib/motion.js';
import styles from './CategoryChips.module.css';

/** Short chip labels; the full label stays in the accessible name. */
const SHORT = {
  cities: 'Cities',
  heritage: 'Temples',
  nature: 'Nature',
  islands: 'Islands',
  food: 'Food',
  onsen: 'Onsen',
  festivals: 'Festivals',
  craft: 'Craft',
};

const ALL = { id: '', label: 'All brochures', short: 'All', jp: '全て', color: 'var(--ink)' };
const OPTIONS = [ALL, ...CATEGORIES.map((c) => ({ ...c, short: SHORT[c.id] ?? c.label }))];

/**
 * Single-choice category filter as a row of chips. The ink "selected" pill
 * glides from chip to chip (shared layoutId) instead of blinking.
 * - `value`   selected category id ('' = all)
 * - `counts`  { [id]: n } from facetCounts; `total` for "All"
 * - `onChange(id)`
 * - `wrap`    wrap onto several lines (drawer) instead of one scrolling row
 */
export function CategoryChips({ value, counts = {}, total, onChange, wrap = false, className }) {
  const glider = useId();
  return (
    <div role="group" aria-label="Category" className={cn(styles.chips, wrap && styles.wrap, className)}>
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        const count = option.id ? (counts[option.id] ?? 0) : total;
        return (
          <Chip
            key={option.id || 'all'}
            selected={selected}
            count={count}
            color={option.id ? option.color : undefined}
            className={cn(styles.chip, count === 0 && !selected && styles.empty)}
            aria-label={`${option.label}, ${count} ${count === 1 ? 'brochure' : 'brochures'}`}
            onClick={() => onChange(selected ? '' : option.id)}
          >
            {selected && <motion.span layoutId={`category-${glider}`} className={styles.glider} transition={spring.snappy} />}
            <span className={styles.label}>{option.short}</span>
          </Chip>
        );
      })}
    </div>
  );
}
