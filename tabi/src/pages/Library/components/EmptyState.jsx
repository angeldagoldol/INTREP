import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Heart, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/index.js';
import { fadeUp, stagger } from '../../../lib/motion.js';
import { DEFAULT_FILTERS, describeFilters, filterBrochures } from '../filterBrochures.js';
import { EmptyIllustration } from './EmptyIllustration.jsx';
import styles from './EmptyState.module.css';

/** Starting points offered when nothing matches; only ones with results are shown. */
const SUGGESTIONS = [
  { label: 'Kyoto', patch: { q: 'Kyoto' } },
  { label: 'Onsen', jp: '温泉', patch: { category: 'onsen' } },
  { label: 'Festivals', jp: '祭', patch: { category: 'festivals' } },
  { label: 'Winter', jp: '冬', patch: { seasons: ['winter'] } },
  { label: 'Food', jp: '食', patch: { category: 'food' } },
  { label: 'Islands', jp: '島', patch: { category: 'islands' } },
];

const CLEARED = { q: '', category: '', seasons: [], region: '', fav: false };

/**
 * No results: an illustration, what was asked for, a few one-tap ways out
 * and "Clear filters" — never a dead end.
 * - `filters` the active filters; `brochures`/`favoriteIds` to vet suggestions
 * - `onApply(patch)` replace the filters; `onClear()`
 */
export function EmptyState({ filters, brochures, favoriteIds, onApply, onClear }) {
  const noFavourites = filters.fav && favoriteIds.length === 0;
  const asked = describeFilters({ ...filters, fav: false }).map((p) => p.label);

  const suggestions = useMemo(
    () =>
      SUGGESTIONS.filter(
        (s) => filterBrochures(brochures, { ...DEFAULT_FILTERS, ...s.patch }, { favoriteIds }).length > 0,
      ).slice(0, 5),
    [brochures, favoriteIds],
  );

  return (
    <motion.div className={styles.empty} variants={stagger(0.08)} initial="hidden" animate="show">
      <div className={styles.art}>
        <EmptyIllustration />
      </div>

      <div className={styles.copy}>
        <motion.p variants={fadeUp} className={styles.eyebrow}>
          <span lang="ja">見つかりません</span> · Nothing found
        </motion.p>
        <motion.h3 variants={fadeUp} className={styles.title}>
          {noFavourites ? 'No saved brochures yet' : 'No brochures match'}
        </motion.h3>
        <motion.p variants={fadeUp} className={styles.text}>
          {noFavourites ? (
            <>
              Tap the <Heart className={styles.inlineIcon} aria-hidden="true" />
              <span className="sr-only">heart</span> on any brochure to keep it here for later.
            </>
          ) : asked.length > 0 ? (
            <>
              Nothing for <strong>{asked.join(' · ')}</strong>
              {filters.fav ? ' among your saved brochures' : ''}. Try a broader search, or start from one of these:
            </>
          ) : (
            'Nothing here yet. Start from one of these:'
          )}
        </motion.p>

        {!noFavourites && suggestions.length > 0 && (
          <motion.ul variants={fadeUp} className={styles.suggestions} aria-label="Suggestions">
            {suggestions.map((s) => (
              <li key={s.label}>
                <button type="button" className={styles.suggestion} onClick={() => onApply({ ...CLEARED, ...s.patch })}>
                  {s.jp && (
                    <span lang="ja" className={styles.jp} aria-hidden="true">
                      {s.jp}
                    </span>
                  )}
                  {s.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}

        <motion.div variants={fadeUp} className={styles.actions}>
          <Button onClick={onClear} iconLeft={<RotateCcw />}>
            {noFavourites ? 'Show all brochures' : 'Clear filters'}
          </Button>
          <Button to="/studio" variant="ghost" iconRight={<ArrowUpRight />}>
            Make your own
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
