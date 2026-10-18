import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ease } from '../../../lib/motion.js';
import styles from './OptionCard.module.css';

const reveal = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.out, delay: i * 0.1 } }),
};

/**
 * A wide starting-point card (blank page, remix…): illustration on the
 * left, title with Japanese gloss, a sentence and a call to action. The
 * whole card is one button.
 *   <OptionCard art={<BlankArt />} title="Blank brochure" jp="白紙" cta="Start blank" onChoose={…}>Text</OptionCard>
 */
export function OptionCard({ art, title, jp, cta, children, onChoose, index = 0, tone }) {
  return (
    <motion.li className={styles.item} variants={reveal} custom={index}>
      <article className={styles.card} data-tone={tone}>
        <div className={styles.art} aria-hidden="true">
          {art}
        </div>
        <div className={styles.body}>
          <h3 className={styles.title}>
            <button type="button" className={styles.choose} onClick={onChoose}>
              {title}
            </button>
            <span lang="ja" className={styles.jp}>
              {jp}
            </span>
          </h3>
          <p className={styles.text}>{children}</p>
          <span className={styles.cta} aria-hidden="true">
            {cta}
            <ArrowRight size={16} />
          </span>
        </div>
      </article>
    </motion.li>
  );
}
