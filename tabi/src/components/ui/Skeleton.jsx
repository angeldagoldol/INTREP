import { cn } from '../../lib/cn.js';
import styles from './Skeleton.module.css';

/** Shimmering placeholder block. Size it with className or style. */
export function Skeleton({ className, style, radius }) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
