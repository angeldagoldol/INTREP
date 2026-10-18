import { Field, Select } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import styles from './SelectControl.module.css';

/**
 * Compact select for the toolbar: a leading icon, the label kept for
 * assistive tech (or shown above it with `showLabel`, as in the drawer).
 * `options`: [{ value, label, ariaLabel? }] — `ariaLabel` names an option for
 * assistive tech when its visible label mixes in Japanese.
 */
export function SelectControl({ label, icon, value, options, onChange, showLabel = false, className }) {
  return (
    <Field label={label} labelHidden={!showLabel} className={cn(styles.field, className)}>
      <SelectWithIcon icon={icon} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} aria-label={option.ariaLabel}>
            {option.label}
          </option>
        ))}
      </SelectWithIcon>
    </Field>
  );
}

/** Receives id/aria props from <Field> and hands them to the real <select>. */
function SelectWithIcon({ icon, children, ...props }) {
  return (
    <div className={styles.wrap}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <Select className={cn(styles.select, icon && styles.withIcon)} {...props}>
        {children}
      </Select>
    </div>
  );
}
