import { motion } from 'framer-motion';
import { RevealText } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { ease, fadeUp, viewportOnce } from '../../../lib/motion.js';
import styles from './SectionHead.module.css';

const rule = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.2, ease: ease.out } },
};

/**
 * Editorial section opener: a numbered running head on a hairline
 * ("03 — Featured … 特集"), a word-by-word headline and an optional aside.
 *
 * - `section` `{ num, label, jp }` from homeContent SECTIONS.
 * - `title`   RevealText `text`: a string or segments (`{ text, className }`).
 * - `intro`   short standfirst; `action` any node (usually a Button) under it.
 * - `layout`  'split' (headline left, aside right) or 'stack'.
 */
export function SectionHead({ section, title, intro, action, layout = 'split', className }) {
  return (
    <header className={cn(styles.head, styles[layout], className)}>
      <motion.div className={styles.running} initial="hidden" whileInView="show" viewport={viewportOnce}>
        <span className={styles.num}>{section.num}</span>
        <span className={styles.label}>{section.label}</span>
        <motion.span className={styles.line} variants={rule} aria-hidden="true" />
        <span lang="ja" className={styles.jp}>
          {section.jp}
        </span>
      </motion.div>

      <div className={styles.body}>
        <RevealText as="h2" text={title} className={styles.title} />
        {(intro || action) && (
          <motion.div className={styles.aside} variants={fadeUp} initial="hidden" whileInView="show" viewport={viewportOnce}>
            {intro && <p className={styles.intro}>{intro}</p>}
            {action && <div className={styles.action}>{action}</div>}
          </motion.div>
        )}
      </div>
    </header>
  );
}
