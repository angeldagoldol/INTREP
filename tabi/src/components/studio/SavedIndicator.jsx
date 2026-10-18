import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert } from 'lucide-react';
import { ease } from '../../lib/motion.js';
import { relativeSaved } from './studioFormat.js';
import { useNow } from './useStudio.js';
import styles from './SavedIndicator.module.css';

function describe({ saving, savedAt, error, mode, dirty }, now) {
  if (error) return { state: 'error', text: 'Not saved — browser storage is full or blocked' };
  if (saving) return { state: 'saving', text: 'Saving…' };
  if (mode === 'edit' && !dirty) return { state: 'idle', text: 'No unsaved changes' };
  const when = relativeSaved(savedAt, now);
  if (mode === 'edit') return { state: 'saved', text: `Draft kept${when ? ` · ${when}` : ''}` };
  return { state: 'saved', text: `Saved${when ? ` · ${when}` : ''}` };
}

/**
 * Autosave status: "Saving…" while typing, "Saved · just now" once written,
 * and a clear error if storage refuses. Only settled states are announced.
 */
export function SavedIndicator({ saving, savedAt, error, mode = 'new', dirty = false, compact = false }) {
  const now = useNow(20_000);
  const { state, text } = describe({ saving, savedAt, error, mode, dirty }, now);

  return (
    <p className={styles.indicator} data-state={state} data-compact={compact || undefined} title={text}>
      <span className={styles.mark} aria-hidden="true">
        {state === 'error' ? <CircleAlert size={14} /> : state === 'saved' ? <Check size={12} strokeWidth={3} /> : <span className={styles.dot} />}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state === 'saving' ? 'saving' : text}
          className={styles.text}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: ease.out } }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          aria-hidden="true"
        >
          {text}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" role="status">
        {state === 'saving' ? '' : text}
      </span>
    </p>
  );
}
