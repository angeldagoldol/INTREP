import { motion } from 'framer-motion';
import { pad } from '../../lib/format.js';
import { ease, fadeUp, viewportOnce } from '../../lib/motion.js';
import styles from './Credits.module.css';

const rule = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.1, ease: ease.out } },
};

/**
 * One numbered section of the Credits page: "01 Photographs ──── 写真", a
 * standfirst, then its content. The heading takes focus (tabIndex -1) when
 * the contents list jumps to it.
 * Props: id (the section's DOM id), num, title, jp, lede, children.
 */
export function CreditsSection({ id, num, title, jp, lede, children }) {
  const headingId = `${id}-title`;
  return (
    <section id={id} className={styles.section} aria-labelledby={headingId}>
      <div className="container">
        <motion.div className={styles.sectionHead} initial="hidden" whileInView="show" viewport={viewportOnce}>
          <span className={styles.sectionNum} aria-hidden="true">
            {pad(num)}
          </span>
          <h2 id={headingId} className={styles.sectionTitle} tabIndex={-1}>
            {title}
          </h2>
          <motion.span className={styles.sectionRule} variants={rule} aria-hidden="true" />
          <span lang="ja" className={styles.sectionJp}>
            {jp}
          </span>
        </motion.div>
        {lede && (
          <motion.p className={styles.sectionLede} initial="hidden" whileInView="show" viewport={viewportOnce} variants={fadeUp}>
            {lede}
          </motion.p>
        )}
        {children}
      </div>
    </section>
  );
}
