import { cn } from '../../lib/cn.js';
import styles from './Marquee.module.css';

/**
 * Seamless infinite ticker (pure CSS animation).
 *   <Marquee speed={40} reverse paused={motionPaused}>{items}</Marquee>
 * speed = seconds per full loop. `paused` holds it still (wire it to a
 * visible pause control: WCAG 2.2.2); `pauseOnHover` also holds it while
 * hovered or while keyboard focus is inside. Under reduced motion it is a
 * static, horizontally scrollable strip. The duplicate copy is hidden from AT.
 */
export function Marquee({ children, speed = 40, reverse = false, paused = false, pauseOnHover = true, gap = '3rem', fade = true, className }) {
  return (
    <div
      className={cn(styles.marquee, { [styles.pausable]: pauseOnHover, [styles.fade]: fade }, className)}
      style={{ '--duration': `${speed}s`, '--gap': gap }}
      data-reverse={reverse || undefined}
      data-paused={paused || undefined}
    >
      <div className={styles.track}>
        <div className={styles.group}>{children}</div>
        <div className={styles.group} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
