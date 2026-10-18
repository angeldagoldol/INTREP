import { cn } from '../../lib/cn.js';
import styles from './Hanko.module.css';

/**
 * Red seal stamp (判子 / 落款), the signature on Japanese prints.
 * Characters are laid out top-to-bottom, right-to-left in a square or circle.
 *   <Hanko text="旅" />   <Hanko text="京都" shape="circle" size={64} />
 */
export function Hanko({ text, shape = 'square', size = 56, className, title }) {
  return (
    <span
      lang="ja"
      className={cn(styles.hanko, styles[shape], className)}
      style={{ '--hanko-size': `${size}px`, '--hanko-chars': Array.from(text).length }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <span className={styles.inner}>{text}</span>
    </span>
  );
}
