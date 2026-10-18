import { motion, useReducedMotion } from 'framer-motion';
import { ease } from '../../../lib/motion.js';
import styles from './EmptyIllustration.module.css';

const ENSO = 'M196 46 C 150 18, 74 34, 52 92 C 30 150, 76 206, 136 206 C 196 206, 230 160, 222 108 C 217 80, 204 64, 188 56';
const LEAF =
  'M0 -9 L2.2 -3.4 L8 -5 L5 0.6 L9.4 3.6 L3.2 4.2 L3.4 9.6 L0 6 L-3.4 9.6 L-3.2 4.2 L-9.4 3.6 L-5 0.6 L-8 -5 L-2.2 -3.4 Z';

/**
 * An ensō brushed around an empty brochure stand, one maple leaf drifting
 * down: "nothing here — yet". Draws itself in; still under reduced motion.
 */
export function EmptyIllustration() {
  const reduce = useReducedMotion();
  const draw = (delay, duration = 1.3) =>
    reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration, delay, ease: ease.inOut } };
  const rise = (delay) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: ease.out } };

  return (
    <svg className={styles.art} viewBox="0 0 260 240" aria-hidden="true" focusable="false">
      <motion.path className={styles.enso} d={ENSO} {...draw(0.1)} />
      <motion.path className={styles.ensoDry} d={ENSO} transform="translate(4 -3)" {...draw(0.25)} />

      {/* Empty tri-fold brochure on its stand */}
      <motion.g {...rise(0.5)}>
        <path className={styles.panel} d="M86 92 L118 86 L118 168 L86 174 Z" />
        <path className={styles.panel} d="M118 86 L150 92 L150 174 L118 168 Z" />
        <path className={styles.panel} d="M150 92 L182 86 L182 168 L150 174 Z" />
        <path className={styles.lines} d="M94 104 L110 101 M94 112 L110 109 M94 120 L106 118 M126 101 L142 104 M126 109 L142 112 M158 104 L174 101 M158 112 L170 110" />
        <path className={styles.stand} d="M78 180 H190 M96 180 L92 196 M172 180 L176 196" />
      </motion.g>

      {/* A single momiji leaf, drifting */}
      <motion.g
        initial={reduce ? false : { x: 40, y: -150, rotate: -60, opacity: 0 }}
        animate={reduce ? undefined : { x: [40, -14, 0], y: [-150, -70, 0], rotate: [-60, 20, 28], opacity: [0, 1, 1] }}
        transition={{ duration: 3.4, delay: 0.9, ease: ease.soft, times: [0, 0.5, 1] }}
      >
        <path className={styles.leaf} d={LEAF} transform="translate(134 192) rotate(28)" />
      </motion.g>
    </svg>
  );
}
