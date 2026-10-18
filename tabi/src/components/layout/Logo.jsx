import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ease, spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import styles from './Logo.module.css';

const MotionLink = motion.create(Link);

const seal = {
  rest: { rotate: -8, scale: 1, y: 0 },
  hover: { rotate: 0, scale: 1.04, y: -2, transition: spring.bouncy },
  press: { rotate: 3, scale: 0.84, y: 0, transition: { duration: 0.12, ease: ease.out } },
};

// Ink impression that blooms out of the seal when it is "stamped".
const ring = {
  rest: { scale: 0.7, opacity: 0 },
  hover: { scale: [0.9, 1.65], opacity: [0.55, 0], transition: { duration: 0.7, ease: ease.out } },
  press: { scale: 1, opacity: 0.4 },
};

const word = {
  rest: { x: 0 },
  hover: { x: 2, transition: spring.snappy },
};

/**
 * Tabi wordmark: a vermilion seal stamped with 旅 ("journey") beside the
 * name. Links home; the seal straightens and stamps on hover/press.
 * Props: className, onClick.
 */
export function Logo({ className, onClick }) {
  return (
    <MotionLink
      to="/"
      className={cn(styles.logo, className)}
      aria-label="Tabi, home"
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap="press"
      onClick={onClick}
    >
      <span className={styles.markWrap} aria-hidden="true">
        <motion.span className={styles.ring} variants={ring} />
        <motion.span className={styles.mark} variants={seal}>
          <span lang="ja" className={styles.glyph}>
            旅
          </span>
        </motion.span>
      </span>
      <motion.span className={styles.word} variants={word} aria-hidden="true">
        Tabi
      </motion.span>
    </MotionLink>
  );
}
