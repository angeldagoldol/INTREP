import { cn } from '../../lib/cn.js';
import styles from './Switch.module.css';

/** Accessible on/off switch. <Switch checked={x} onChange={setX} label="Autoplay" /> */
export function Switch({ checked, onChange, label, className, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(styles.switch, className)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
