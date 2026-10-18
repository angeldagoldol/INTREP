import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ease } from '../../lib/motion.js';
import { formatNumber } from '../../lib/format.js';

/**
 * Number that counts up when scrolled into view. Renders through a motion
 * value (no React re-render per frame). Screen readers get the final value.
 *   <Counter value={14125} suffix=" islands" />
 */
export function Counter({ value, prefix = '', suffix = '', duration = 1.8, decimals = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(count, (v) => {
    const n = decimals ? Number(v.toFixed(decimals)) : Math.round(v);
    return `${prefix}${formatNumber(n)}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return undefined;
    if (reduceMotion) {
      count.set(value);
      return undefined;
    }
    const controls = animate(count, value, { duration, ease: ease.out });
    return () => controls.stop();
  }, [inView, reduceMotion, value, duration, count]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{`${prefix}${formatNumber(value)}${suffix}`}</span>
      <motion.span aria-hidden="true">{text}</motion.span>
    </span>
  );
}
