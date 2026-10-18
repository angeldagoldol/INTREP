import { useRef } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';
import { useFinePointer } from '../../hooks/useMediaQuery.js';
import { cn } from '../../lib/cn.js';

const SPRING = { stiffness: 220, damping: 16, mass: 0.4 };

/**
 * Pulls its child toward the cursor while hovered, then springs back.
 * Inert on touch devices and with reduced motion.
 *   <Magnetic><Button>Start</Button></Magnetic>
 */
export function Magnetic({ children, strength = 0.3, className, style }) {
  const ref = useRef(null);
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const enabled = finePointer && !reduceMotion;

  const onPointerMove = (event) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      className={cn(className)}
      style={{ display: 'inline-flex', x, y, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.span>
  );
}
