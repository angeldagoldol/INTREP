import { cn } from '../../lib/cn.js';
import styles from './VerticalText.module.css';

/**
 * Japanese vertical writing (縦書き, tategaki): top-to-bottom, right-to-left.
 *   <VerticalText lang="ja">京都</VerticalText>
 * Defaults to lang="ja" so the correct CJK glyphs and line-breaking apply.
 */
export function VerticalText({ children, as: Tag = 'span', lang = 'ja', className, ...rest }) {
  return (
    <Tag lang={lang} className={cn(styles.vertical, className)} {...rest}>
      {children}
    </Tag>
  );
}
