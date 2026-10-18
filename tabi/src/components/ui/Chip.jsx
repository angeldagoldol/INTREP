import { cn } from '../../lib/cn.js';
import styles from './Chip.module.css';

/**
 * Toggle chip for filters. `selected` maps to aria-pressed.
 *   <Chip selected={cat === 'food'} onClick={...} icon={<Icon name="Utensils" />} count={4}>Food</Chip>
 * `color` tints the dot (any CSS colour / token).
 */
export function Chip({ selected = false, icon, count, color, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(styles.chip, { [styles.selected]: selected }, className)}
      style={color ? { '--chip-color': color } : undefined}
      {...rest}
    >
      {color && !icon && <span className={styles.dot} aria-hidden="true" />}
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
      {count != null && <span className={styles.count}>{count}</span>}
    </button>
  );
}
