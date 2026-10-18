import { motion, useReducedMotion } from 'framer-motion';
import { ease, spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import styles from './ToriiIllustration.module.css';

const ENSO = 'M244 40 A 116 116 0 1 0 300 118';
const fromBottom = { transformBox: 'fill-box', transformOrigin: '50% 100%' };
const fromCentre = { transformBox: 'fill-box', transformOrigin: '50% 50%' };
const REST = { opacity: 1, y: 0, scaleX: 1, scaleY: 1, pathLength: 1 };

/**
 * A lone torii inside a brush-drawn ensō, mist drifting at its feet. Builds
 * itself on mount: the circle draws, pillars rise, beams settle. Static
 * under reduced motion. Decorative (aria-hidden).
 */
export function ToriiIllustration({ className }) {
  const reduce = useReducedMotion();
  // Animate only the properties a piece starts "hidden" on, back to rest.
  const enter = (hidden, delay, transition = { duration: 0.7, ease: ease.out }) => {
    if (reduce) return {};
    const animate = Object.fromEntries(Object.keys(hidden).map((key) => [key, REST[key]]));
    return { initial: hidden, animate, transition: { ...transition, delay } };
  };

  const drift = (distance, duration) =>
    reduce
      ? {}
      : { animate: { x: [0, distance, 0] }, transition: { duration, ease: 'easeInOut', repeat: Infinity } };

  return (
    <svg className={cn(styles.art, className)} viewBox="0 0 360 320" aria-hidden="true" focusable="false">
      <motion.path className={styles.enso} d={ENSO} {...enter({ pathLength: 0 }, 0.15, { duration: 1.4, ease: ease.inOut })} />
      <motion.path
        className={styles.ensoDry}
        d={ENSO}
        transform="translate(5 -3)"
        {...enter({ pathLength: 0 }, 0.3, { duration: 1.4, ease: ease.inOut })}
      />

      <line className={styles.ground} x1="44" y1="262" x2="316" y2="262" />

      <g className={styles.shu}>
        <motion.path d="M112 104 H126 L130 262 H108 Z" style={fromBottom} {...enter({ scaleY: 0 }, 0.35)} />
        <motion.path d="M234 104 H248 L252 262 H230 Z" style={fromBottom} {...enter({ scaleY: 0 }, 0.43)} />
        <motion.rect x="78" y="132" width="204" height="11" rx="1.5" style={fromCentre} {...enter({ scaleX: 0 }, 0.72)} />
        <motion.rect x="172" y="108" width="16" height="24" style={fromBottom} {...enter({ scaleY: 0 }, 0.86)} />
        <motion.path d="M84 94 Q180 112 276 94 V104 Q180 122 84 104 Z" {...enter({ y: -26, opacity: 0 }, 0.92, spring.bouncy)} />
      </g>
      <g className={styles.sumi}>
        <motion.path d="M62 72 Q180 96 298 72 L291 89 Q180 110 69 89 Z" {...enter({ y: -40, opacity: 0 }, 1.02, spring.bouncy)} />
        <rect x="104" y="246" width="30" height="16" rx="2" />
        <rect x="226" y="246" width="30" height="16" rx="2" />
      </g>

      <g className={styles.mist}>
        <motion.path d="M58 280 H150" {...drift(14, 7)} />
        <motion.path d="M196 292 H306" {...drift(-18, 9)} />
        <motion.path d="M96 304 H214" {...drift(10, 8)} />
      </g>
    </svg>
  );
}
