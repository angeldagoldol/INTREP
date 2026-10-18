import { CircleAlert, Info } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import styles from './Note.module.css';

const ICONS = { info: Info, warning: CircleAlert };

/**
 * Inline callout for hints and warnings inside Studio panels.
 *   <Note tone="warning" action={<Button size="sm">Fix</Button>}>Low contrast…</Note>
 */
export function Note({ tone = 'info', children, action, className, live = false }) {
  const Icon = ICONS[tone] ?? Info;
  return (
    <div className={cn(styles.note, className)} data-tone={tone} role={live ? 'status' : undefined}>
      <Icon className={styles.icon} size={16} aria-hidden="true" />
      <div className={styles.body}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
