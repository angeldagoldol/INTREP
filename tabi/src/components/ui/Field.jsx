import { cloneElement, isValidElement, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import styles from './Field.module.css';

/**
 * Label + control + hint/error, wired up for assistive tech.
 *   <Field label="Email" hint="We never share it" error={errors.email} required>
 *     <Input type="email" value={email} onChange={...} />
 *   </Field>
 * The child control receives id, aria-invalid and aria-describedby.
 */
export function Field({ label, hint, error, required = false, className, children, id: idProp, labelHidden = false }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  // The error replaces the hint, so only what is rendered is referenced.
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        required: children.props.required ?? required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn(styles.field, { [styles.hasError]: !!error }, className)}>
      <label htmlFor={id} className={cn(styles.label, { 'sr-only': labelHidden })}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hintId && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(styles.control, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(styles.control, styles.textarea, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <div className={styles.selectWrap}>
      <select className={cn(styles.control, styles.select, className)} {...props}>
        {children}
      </select>
      <ChevronDown className={styles.selectIcon} size={16} aria-hidden="true" />
    </div>
  );
}
