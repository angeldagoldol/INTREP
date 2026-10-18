import { motion } from 'framer-motion';
import { ArrowLeft, PenLine } from 'lucide-react';
import { BrochureCard } from '../../components/brochure/index.js';
import { Button, Hanko, VerticalText } from '../../components/ui/index.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { fadeUp, stagger } from '../../lib/motion.js';
import styles from './ViewerNotFound.module.css';

/**
 * Friendly dead end for an unknown slug: say what happened, offer the way
 * back to the library, and three featured brochures to wander into.
 * Props: slug.
 */
export function ViewerNotFound({ slug }) {
  const { builtins } = useBrochures();
  const picks = builtins.filter((b) => b.featured).slice(0, 3);

  return (
    <section className={styles.page} aria-labelledby="viewer-missing-title">
      <motion.div className={`container ${styles.inner}`} initial="hidden" animate="show" variants={stagger(0.09, 0.05)}>
        <motion.div className={styles.mark} variants={fadeUp} aria-hidden="true">
          <VerticalText className={styles.maigo}>迷子</VerticalText>
          <Hanko text="無" shape="circle" size={58} className={styles.seal} />
        </motion.div>

        <div className={styles.copy}>
          <motion.p className="eyebrow" variants={fadeUp}>
            Brochure not found · <span lang="ja">迷子</span> maigo
          </motion.p>
          <motion.h1 id="viewer-missing-title" className={styles.title} variants={fadeUp}>
            This brochure has wandered off the path.
          </motion.h1>
          <motion.p className={styles.text} variants={fadeUp}>
            We could not find a brochure called <code className={styles.slug}>{slug || '(blank)'}</code>. It may have been
            renamed, or it was made in the Studio on another device — Studio brochures live in the browser that made them.
          </motion.p>
          <motion.div className={styles.actions} variants={fadeUp}>
            <Button variant="primary" size="lg" to="/brochures" iconLeft={<ArrowLeft />}>
              Back to the library
            </Button>
            <Button variant="secondary" size="lg" to="/studio" iconLeft={<PenLine />}>
              Make your own
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {picks.length > 0 && (
        <div className={`container ${styles.picks}`}>
          <h2 className={styles.picksTitle}>
            Try one of these instead{' '}
            <span lang="ja" className={styles.picksJp}>
              かわりに
            </span>
          </h2>
          <ul className={styles.grid}>
            {picks.map((b, i) => (
              <li key={b.id}>
                <BrochureCard brochure={b} index={i} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
