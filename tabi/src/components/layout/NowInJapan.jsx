import { cn } from '../../lib/cn.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { japanNow } from './japanTime.js';
import styles from './NowInJapan.module.css';

/**
 * "Now in Japan: 秋 Autumn — maple season · 21:04 JST" — a live strip with
 * the current Japanese season and Tokyo time. Props: className.
 */
export function NowInJapan({ className }) {
  const date = useMinuteClock();
  const now = japanNow(date);
  return (
    <p className={cn(styles.now, className)}>
      <span className={styles.label}>
        <span className={styles.pulse} aria-hidden="true" />
        Now in Japan
      </span>
      <span className={styles.season}>
        <span lang="ja" className={styles.seasonJp}>
          {now.season.jp}
        </span>{' '}
        {now.season.label} <span className={styles.dash}>—</span> {now.note}
      </span>
      <span className={styles.clock}>
        <time dateTime={now.time}>{now.time}</time> JST · Tokyo
      </span>
    </p>
  );
}
