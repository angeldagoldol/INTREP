import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../../lib/cn.js';
import { ease, spring } from '../../../lib/motion.js';
import styles from './ActiveFilters.module.css';

const pill = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.16, ease: ease.in } },
};

/**
 * Removable pills summarising the active filters, plus "Clear all".
 * `pills` come from describeFilters(); `onRemove(patch)`, `onClear()`.
 */
export function ActiveFilters({ pills, onRemove, onClear, className }) {
  return (
    <div className={cn(styles.active, className)}>
      <ul className={styles.list} aria-label="Active filters">
        <AnimatePresence initial={false} mode="popLayout">
          {pills.map((p) => (
            <motion.li key={p.key} layout="position" variants={pill} initial="hidden" animate="show" exit="exit">
              <button
                type="button"
                className={styles.pill}
                style={p.color ? { '--pill': p.color } : undefined}
                aria-label={`Remove ${p.kind.toLowerCase()} filter: ${p.label}`}
                onClick={() => onRemove(p.patch)}
              >
                {p.color && <span className={styles.dot} aria-hidden="true" />}
                <span className={styles.label}>{p.label}</span>
                {p.jp && (
                  <span lang="ja" className={styles.jp} aria-hidden="true">
                    {p.jp}
                  </span>
                )}
                <X className={styles.x} aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {pills.length > 1 && (
        <button type="button" className={styles.clear} onClick={onClear}>
          Clear all
        </button>
      )}
    </div>
  );
}
