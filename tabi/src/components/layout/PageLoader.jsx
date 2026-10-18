import { motion, useReducedMotion } from 'framer-motion';
import { ease } from '../../lib/motion.js';
import styles from './PageLoader.module.css';

// An open brush circle (円相, ensō), started at one o'clock.
const ENSO = 'M78 17 C 56 8, 26 18, 17 44 C 8 70, 28 101, 58 103 C 88 105, 106 81, 103 55 C 101 41, 95 31, 88 25';

const draw = {
  hidden: { pathLength: 0, opacity: 1 },
  show: {
    pathLength: [0, 1, 1],
    opacity: [1, 1, 0],
    transition: { duration: 1.9, times: [0, 0.62, 1], ease: ease.inOut, repeat: Infinity, repeatDelay: 0.15 },
  },
};

/**
 * Suspense fallback while a route chunk loads: an ensō drawing itself in one
 * breath. Fades in after a short delay so fast loads never flash it; static
 * under reduced motion. Props: label.
 */
export function PageLoader({ label = 'Loading' }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.loader} role="status" aria-live="polite">
      <svg className={styles.enso} viewBox="0 0 120 120" aria-hidden="true">
        <circle className={styles.guide} cx="60" cy="60" r="43" />
        {reduce ? (
          <path className={styles.stroke} d={ENSO} />
        ) : (
          <>
            <motion.path className={styles.stroke} d={ENSO} variants={draw} initial="hidden" animate="show" />
            <motion.path className={styles.dry} d={ENSO} transform="translate(3 -2)" variants={draw} initial="hidden" animate="show" />
          </>
        )}
      </svg>
      <p className={styles.label}>
        <span lang="ja" className={styles.jp}>
          読み込み中
        </span>
        {label}…
      </p>
    </div>
  );
}
