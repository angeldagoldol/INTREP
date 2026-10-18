import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { cn } from '../../../lib/cn.js';
import { setMotionPaused, useMotionPaused } from '../homeMotion.js';
import styles from './MotionToggle.module.css';

/**
 * "Pause motion · 一時停止" — stops the Home page's ambient loops (marquee,
 * petals, compass ring, sketches, postcard autoplay) for visitors who have
 * not set reduced motion in their OS (WCAG 2.2.2). The label says what a
 * press will do, like a media player; the choice is remembered. Hidden when
 * the OS already asks for reduced motion, since nothing loops then.
 */
export function MotionToggle({ className }) {
  const reduce = useReducedMotion();
  const paused = useMotionPaused();
  if (reduce) return null;

  return (
    <button type="button" className={cn(styles.toggle, className)} data-paused={paused || undefined} onClick={() => setMotionPaused(!paused)}>
      <span className={styles.icon} aria-hidden="true">
        {paused ? <Play /> : <Pause />}
      </span>
      <span>{paused ? 'Play motion' : 'Pause motion'}</span>
      <span lang="ja" className={styles.jp} aria-hidden="true">
        {paused ? '再生' : '一時停止'}
      </span>
    </button>
  );
}
