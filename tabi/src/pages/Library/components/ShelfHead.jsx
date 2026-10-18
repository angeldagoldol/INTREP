import { motion } from 'framer-motion';
import { cn } from '../../../lib/cn.js';
import { ease, viewportOnce } from '../../../lib/motion.js';
import { pad } from '../../../lib/format.js';
import styles from './ShelfHead.module.css';

const rule = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.1, ease: ease.out } },
};

/**
 * Section running head: "02  Recently viewed ───────── 閲覧履歴".
 * `id` goes on the <h2> so the section can be labelled by it; `aside` is
 * any trailing node (count, button).
 */
export function ShelfHead({ id, num, title, jp, aside, className }) {
  return (
    <motion.div className={cn(styles.head, className)} initial="hidden" whileInView="show" viewport={viewportOnce}>
      <span className={styles.num} aria-hidden="true">
        {pad(num)}
      </span>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <motion.span className={styles.line} variants={rule} aria-hidden="true" />
      {jp && (
        <span lang="ja" className={styles.jp}>
          {jp}
        </span>
      )}
      {aside && <div className={styles.aside}>{aside}</div>}
    </motion.div>
  );
}
