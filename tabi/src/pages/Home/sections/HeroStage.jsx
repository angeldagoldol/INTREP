import { useEffect, useId } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ease } from '../../../lib/motion.js';
import { TriFold } from './TriFold.jsx';
import styles from './HeroStage.module.css';

const DRIFT = { stiffness: 60, damping: 20, mass: 1 };

/** A ring of tick marks with a line of text running around it, like a compass rose. */
function CompassRing() {
  const pathId = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <path id={pathId} d="M100 100 m-86 0 a86 86 0 1 1 172 0 a86 86 0 1 1 -172 0" />
      </defs>
      <circle cx="100" cy="100" r="96" className={styles.ringLine} />
      <g className={styles.ticks}>
        {ticks.map((i) => (
          <line key={i} x1="100" y1="4" x2="100" y2={i % 6 === 0 ? 11 : 7.5} transform={`rotate(${i * 5} 100 100)`} />
        ))}
      </g>
      <text className={styles.ringText}>
        <textPath href={`#${pathId}`}>
          NIPPON · 日本 · TOKYO 35°41′N 139°41′E · 47 PREFECTURES · 四季 · TABI 旅 ·
        </textPath>
      </text>
    </svg>
  );
}

/**
 * The hero's right-hand composition: a rising-sun disc with slow parallax,
 * a turning compass ring, print crop marks and the tri-fold brochure. Motion values come from the hero section.
 */
export function HeroStage({ pointerX, pointerY, progress }) {
  const reduce = useReducedMotion();
  const motionAllowed = useMotionValue(reduce ? 0 : 1);
  useEffect(() => {
    motionAllowed.set(reduce ? 0 : 1);
  }, [reduce, motionAllowed]);

  // The sun sinks slower than the page and drifts against the pointer.
  const sunY = useTransform([progress, motionAllowed], ([p, m]) => `${p * m * 34}%`);
  const sunX = useSpring(useTransform(pointerX, (v) => v * -16), DRIFT);
  const sunTilt = useSpring(useTransform(pointerY, (v) => v * -10), DRIFT);
  const fold = useTransform(progress, [0.04, 0.62], [0, 1]);

  return (
    <div className={styles.stage}>
      <motion.div className={styles.sunWrap} style={{ y: sunY }} aria-hidden="true">
        <motion.div className={styles.sunDrift} style={{ x: sunX, y: sunTilt }}>
          <motion.div
            className={styles.sun}
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: ease.out }}
          />
          <CompassRing />
        </motion.div>
      </motion.div>

      <span className={styles.crop} data-corner="tl" aria-hidden="true" />
      <span className={styles.crop} data-corner="tr" aria-hidden="true" />
      <span className={styles.crop} data-corner="bl" aria-hidden="true" />
      <span className={styles.crop} data-corner="br" aria-hidden="true" />

      <div className={styles.object}>
        <TriFold pointerX={pointerX} pointerY={pointerY} fold={fold} />
      </div>
    </div>
  );
}
