import { motion } from 'framer-motion';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/index.js';
import { BrochurePage } from '../../../components/brochure/index.js';
import { relativeSaved } from '../../../components/studio/studioFormat.js';
import { useNow } from '../../../components/studio/useStudio.js';
import { getRegion } from '../../../data/regions.js';
import { ease } from '../../../lib/motion.js';
import { pluralize } from '../../../lib/format.js';
import styles from './ContinueDraft.module.css';

/**
 * "Continue your draft" band: the draft's cover as a miniature, its title,
 * size and last save, and buttons to continue or discard.
 *   <ContinueDraft draft={{ doc, savedAt }} onContinue={…} onDiscard={…} />
 */
export function ContinueDraft({ draft, onContinue, onDiscard }) {
  const now = useNow();
  const { doc } = draft;
  const cover = doc.pages.find((p) => p.type === 'cover') ?? doc.pages[0];
  const region = doc.region ? getRegion(doc.region).label : '';

  return (
    <motion.section
      className={`container ${styles.wrap}`}
      aria-labelledby="continue-title"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.out, delay: 0.35 } }}
    >
      <div className={styles.band}>
        <div className={styles.thumb} aria-hidden="true">
          {cover && <BrochurePage brochure={doc} page={cover} index={0} total={doc.pages.length} isStatic />}
        </div>
        <div className={styles.text}>
          <p className={styles.eyebrow}>
            Continue where you left off <span lang="ja">· 続き</span>
          </p>
          <h2 id="continue-title" className={styles.title}>
            {doc.title?.trim() || 'Untitled brochure'}
          </h2>
          <p className={styles.meta}>
            {pluralize(doc.pages.length, 'page')}
            {region && ` · ${region}`}
            {draft.savedAt ? ` · saved ${relativeSaved(draft.savedAt, now)}` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" iconRight={<ArrowRight />} onClick={onContinue}>
            Continue editing
          </Button>
          <Button variant="ghost" iconLeft={<Trash2 />} onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
