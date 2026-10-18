import { motion } from 'framer-motion';
import { Hanko, RevealText, VerticalText } from '../../../components/ui/index.js';
import { fadeUp, stagger } from '../../../lib/motion.js';
import styles from './StudioMessage.module.css';

/**
 * Full-page editorial message for Studio dead ends (brochure not found,
 * read-only library brochure, a draft that would be replaced): a vertical
 * kanji, a seal, a headline, a sentence and the ways forward.
 *   <StudioMessage kanji="迷子" seal="無" eyebrow="Not found" title="…" actions={<Button …/>}>Text</StudioMessage>
 */
export function StudioMessage({ kanji, seal, eyebrow, title, children, actions, aside }) {
  return (
    <section className={`container ${styles.message}`}>
      <motion.div className={styles.text} initial="hidden" animate="show" variants={stagger(0.08, 0.1)}>
        <motion.p className="eyebrow" variants={fadeUp}>
          {eyebrow}
        </motion.p>
        <RevealText as="h1" text={title} immediate className={styles.title} />
        <motion.div className={styles.body} variants={fadeUp}>
          {children}
        </motion.div>
        {actions && (
          <motion.div className={styles.actions} variants={fadeUp}>
            {actions}
          </motion.div>
        )}
        {aside && <motion.div variants={fadeUp}>{aside}</motion.div>}
      </motion.div>
      <motion.div
        className={styles.art}
        aria-hidden="true"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 1, delay: 0.2 } }}
      >
        <VerticalText className={styles.kanji}>{kanji}</VerticalText>
        {seal && <Hanko text={seal} size={64} className={styles.seal} />}
      </motion.div>
    </section>
  );
}
