import { cn } from '../../lib/cn.js';
import styles from './Badge.module.css';

/** Small label. variant: 'outline' | 'solid' | 'soft'. `color` tints the dot. */
export function Badge({ children, variant = 'outline', color, icon, className }) {
  return (
    <span className={cn(styles.badge, styles[variant], className)} style={color ? { '--badge-color': color } : undefined}>
      {icon ? <span className={styles.icon}>{icon}</span> : color && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
