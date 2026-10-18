import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import styles from './IconButton.module.css';

/**
 * Square/round icon-only button. `label` is required: it becomes the
 * accessible name and (unless `tooltip={false}`) a hover/focus tooltip.
 * variant: 'ghost' | 'outline' | 'solid' | 'accent'; size: 'sm' | 'md' | 'lg'
 * tooltipSide: 'top' | 'bottom' | 'left' | 'right'
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip = true,
  tooltipSide = 'bottom',
  active = false,
  to,
  href,
  className,
  type = 'button',
  ...rest
}) {
  const classes = cn(styles.iconButton, styles[variant], styles[size], { [styles.active]: active }, className);
  const shared = {
    className: classes,
    'aria-label': label,
    'data-tooltip': tooltip ? label : undefined,
    'data-side': tooltip ? tooltipSide : undefined,
    ...rest,
  };
  if (to) return <Link to={to} {...shared}>{icon}</Link>;
  if (href) return <a href={href} {...shared}>{icon}</a>;
  return (
    <button type={type} {...shared}>
      {icon}
    </button>
  );
}
