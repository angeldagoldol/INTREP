import { useRef } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';
import { useFinePointer } from '../../hooks/useMediaQuery.js';
import { cn } from '../../lib/cn.js';
import styles from './Tilt.module.css';

const SPRING = { stiffness: 200, damping: 20, mass: 0.6 };

/**
 * 3D tilt toward the cursor plus a soft spotlight that follows it.
 * The spotlight position is exposed as CSS vars --mx / --my (0–100%) so
 * children can react too. Inert on touch devices and with reduced motion.
 */
export function Tilt({ children, max = 7, glare = true, className, style, ...rest }) {
  const ref = useRef(null);
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const enabled = finePointer && !reduceMotion;

  const onPointerMove = (event) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    if (!enabled) return;
    rotateY.set((px - 0.5) * 2 * max);
    rotateX.set((0.5 - py) * 2 * max);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={cn(styles.tilt, className)}
      style={{ rotateX, rotateY, transformPerspective: 1000, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
      {glare && <span className={styles.glare} aria-hidden="true" />}
    </motion.div>
  );
}
