import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import styles from './Button.module.css';

/** Label that rolls up to a duplicate of itself on hover. */
function RollText({ text }) {
  return (
    <span className={styles.roll} data-text={text}>
      <span>{text}</span>
    </span>
  );
}

/**
 * Polymorphic button.
 *   <Button>Save</Button>                              -> <button>
 *   <Button to="/studio">Open studio</Button>          -> router <Link>
 *   <Button href="mailto:x@y.z">Email</Button>         -> <a>
 * variant: 'primary' | 'accent' | 'secondary' | 'ghost'
 * size: 'sm' | 'md' | 'lg'
 */
export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  iconLeft,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = cn(
    styles.button,
    styles[variant],
    styles[size],
    { [styles.block]: block, [styles.loading]: loading, [styles.iconOnlyRight]: !children },
    className,
  );

  const content = (
    <>
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      {children != null && (
        <span className={styles.label}>{typeof children === 'string' ? <RollText text={children} /> : children}</span>
      )}
      {iconRight && <span className={cn(styles.icon, styles.iconRight)}>{iconRight}</span>}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
