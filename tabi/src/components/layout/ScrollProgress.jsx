import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { cn } from '../../lib/cn.js';
import styles from './ScrollProgress.module.css';

/**
 * Hairline vermilion bar that fills with page scroll progress.
 * Spring-smoothed, or exact under reduced motion. Decorative (aria-hidden).
 */
export function ScrollProgress({ className }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 32, restDelta: 0.0005 });
  return (
    <motion.span
      className={cn(styles.bar, className)}
      style={{ scaleX: reduce ? scrollYProgress : smooth }}
      aria-hidden="true"
    />
  );
}
