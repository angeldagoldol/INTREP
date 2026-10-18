import { motion } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import styles from './MenuToggle.module.css';

const top = { closed: { y: -4, rotate: 0 }, open: { y: 0, rotate: 45 } };
// Shorter second stroke sits flush right (scaled about its centre, then nudged).
const bottom = { closed: { y: 4, x: 3.25, rotate: 0, scaleX: 0.64 }, open: { y: 0, x: 0, rotate: -45, scaleX: 1 } };

/**
 * Two-line hamburger that folds into an ×. Disclosure button for the
 * mobile menu (aria-expanded / aria-controls).
 * Props: open, onClick, controls (id of the menu), className.
 */
export function MenuToggle({ open, onClick, controls, className }) {
  return (
    <button
      type="button"
      className={cn(styles.toggle, className)}
      aria-expanded={open}
      aria-controls={controls}
      aria-label="Menu"
      onClick={onClick}
    >
      <motion.span className={styles.lines} initial={false} animate={open ? 'open' : 'closed'} aria-hidden="true">
        <motion.span className={styles.line} variants={top} transition={spring.snappy} />
        <motion.span className={styles.line} variants={bottom} transition={spring.snappy} />
      </motion.span>
    </button>
  );
}
