import { useReducedMotion } from 'framer-motion';
import { petalField } from './petals.js';
import styles from './Petals.module.css';

/** A notched sakura petal, tip down. */
const PETAL = 'M10 23C3.6 18.6.7 11.6 3.2 5.4 4.6 2.1 7.4 1.5 10 4.7 12.6 1.5 15.4 2.1 16.8 5.4 19.3 11.6 16.4 18.6 10 23Z';
const FIELD = petalField(16, 11);

/**
 * A light drift of sakura petals (16 small SVGs, CSS-animated transforms only).
 * Fills its positioned parent; `paused` freezes them mid-fall (the hero
 * passes it while off-screen and after "Pause motion"). Renders nothing
 * under reduced motion.
 */
export function Petals({ paused = false }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className={styles.petals} data-paused={paused || undefined} aria-hidden="true">
      {FIELD.map((p) => (
        <span
          key={p.id}
          className={styles.petal}
          data-tone={p.tone}
          style={{
            '--x': `${p.x}%`,
            '--size': `${p.size}px`,
            '--dur': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}cqi`,
            '--spin': `${p.spin}deg`,
            '--sway': `${p.sway}s`,
          }}
        >
          <span className={styles.sway}>
            <svg viewBox="0 0 20 24" focusable="false">
              <path d={PETAL} />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}
