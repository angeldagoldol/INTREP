import { motion } from 'framer-motion';
import { ease } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import styles from './RevealText.module.css';

const MOTION_TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  p: motion.p,
  span: motion.span,
  div: motion.div,
  blockquote: motion.blockquote,
};

/** Normalise `text` into [{ text, className }] segments. */
function toSegments(text) {
  if (Array.isArray(text)) return text.map((s) => (typeof s === 'string' ? { text: s } : s));
  return [{ text: String(text ?? '') }];
}

/**
 * Words (or characters) rise out of a mask, staggered, when scrolled into view.
 * Screen readers get the plain sentence; the animated pieces are aria-hidden.
 *
 *   <RevealText as="h1" text="Japan, folded into pages" />
 *   <RevealText as="h2" text={['Slow travel, ', { text: 'beautifully', className: 'serif-italic' }, ' printed']} />
 *
 * as: h1 | h2 | h3 | h4 | p | span | div | blockquote
 * by: 'word' | 'char'; immediate: animate on mount instead of on scroll.
 */
export function RevealText({
  text,
  as = 'span',
  by = 'word',
  className,
  delay = 0,
  stagger = 0.055,
  duration = 0.9,
  immediate = false,
  amount = 0.5,
}) {
  const Tag = MOTION_TAGS[as] ?? motion.span;
  const segments = toSegments(text);
  const plain = segments.map((s) => s.text).join('');

  let index = 0;
  const pieces = segments.flatMap((segment, s) => {
    const tokens = by === 'char' ? Array.from(segment.text) : segment.text.split(/(\s+)/);
    return tokens.map((token, t) => {
      if (token === '') return null;
      if (/^\s+$/.test(token)) return <span key={`${s}-${t}`}> </span>;
      const i = index++;
      return (
        <span key={`${s}-${t}`} className={styles.mask} aria-hidden="true">
          <motion.span
            className={cn(styles.piece, segment.className)}
            variants={{
              hidden: { y: '115%', rotate: 4 },
              show: { y: '0%', rotate: 0, transition: { duration, ease: ease.out, delay: delay + i * stagger } },
            }}
          >
            {token}
          </motion.span>
        </span>
      );
    });
  });

  const trigger = immediate
    ? { initial: 'hidden', animate: 'show' }
    : { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount } };

  return (
    <Tag className={cn(styles.reveal, className)} {...trigger}>
      <span className="sr-only">{plain}</span>
      {pieces}
    </Tag>
  );
}
