import { cn } from '../../lib/cn.js';
import styles from './Kbd.module.css';

export function Kbd({ children, className }) {
  return <kbd className={cn(styles.kbd, className)}>{children}</kbd>;
}
