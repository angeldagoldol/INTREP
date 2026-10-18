import { formatJapanTime } from '../../../components/layout/japanTime.js';
import { useMinuteClock } from '../../../hooks/useMinuteClock.js';
import { cn } from '../../../lib/cn.js';
import styles from './TokyoClock.module.css';

/**
 * Live Tokyo time ("Tokyo 21:04 JST"), whatever the visitor's own time zone.
 * Ticks on the minute; the colon blinks unless reduced motion is on.
 */
export function TokyoClock({ className }) {
  const now = useMinuteClock();
  const time = formatJapanTime(now);
  const [hours, minutes] = time.split(':');

  return (
    <p className={cn(styles.clock, className)}>
      <span className={styles.live} aria-hidden="true" />
      <span>Tokyo</span>
      <time dateTime={now.toISOString()} className={styles.time}>
        <span className="sr-only">{time}</span>
        <span aria-hidden="true">
          {hours}
          <span className={styles.colon}>:</span>
          {minutes}
        </span>
      </time>
      <abbr title="Japan Standard Time" className={styles.zone}>
        JST
      </abbr>
    </p>
  );
}
