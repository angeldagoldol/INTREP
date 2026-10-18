import { useId } from 'react';
import { motion } from 'framer-motion';
import { SEASONS } from '../../../data/seasons.js';
import { spring } from '../../../lib/motion.js';
import styles from './SeasonPicker.module.css';

/**
 * Four toggles for the best seasons — 春 夏 秋 冬 — each tinted with its
 * season colour when on.
 *   <SeasonPicker value={['spring']} onChange={setSeasons} />
 */
export function SeasonPicker({ value, onChange, label = 'Best seasons' }) {
  const id = useId();
  const selected = new Set(Array.isArray(value) ? value : []);

  const toggle = (seasonId) => {
    const next = SEASONS.map((s) => s.id).filter((s) => (s === seasonId ? !selected.has(s) : selected.has(s)));
    onChange(next);
  };

  return (
    <div className={styles.field} role="group" aria-labelledby={id}>
      <span id={id} className={styles.label}>
        {label}
      </span>
      <div className={styles.row}>
        {SEASONS.map((season) => {
          const on = selected.has(season.id);
          return (
            <motion.button
              key={season.id}
              type="button"
              aria-pressed={on}
              className={styles.toggle}
              style={{ '--season': season.color }}
              onClick={() => toggle(season.id)}
              whileTap={{ scale: 0.92 }}
              transition={spring.bouncy}
            >
              <span lang="ja" className={styles.kanji} aria-hidden="true">
                {season.jp}
              </span>
              <span className={styles.name}>{season.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
