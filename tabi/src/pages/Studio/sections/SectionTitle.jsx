import { motion } from 'framer-motion';
import { ease, viewportOnce } from '../../../lib/motion.js';
import styles from './SectionTitle.module.css';

/**
 * Numbered section heading with a Japanese gloss and a hairline that draws
 * itself across the page when scrolled into view.
 *   <SectionTitle index="01" title="Start from a template" jp="型から" note="5 templates" id="templates" />
 */
export function SectionTitle({ index, title, jp, note, id }) {
  return (
    <div className={styles.head}>
      <span className={styles.index}>{index}</span>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <motion.span
        className={styles.rule}
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1, transition: { duration: 1.2, ease: ease.out } }}
        viewport={viewportOnce}
      />
      {jp && (
        <span lang="ja" className={styles.jp}>
          {jp}
        </span>
      )}
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}
