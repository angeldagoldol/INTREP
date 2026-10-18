import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Hanko } from '../ui/index.js';
import { ease } from '../../lib/motion.js';
import styles from './PublishStamp.module.css';

const FLECKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.2;
  const reach = 120 + (i % 4) * 26;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, size: 4 + (i % 3) * 3 };
});

const KINDS = {
  publish: { seal: '完成', label: 'Published', jp: '出版しました' },
  save: { seal: '保存', label: 'Saved', jp: '保存しました' },
};

/**
 * The finishing flourish: a vermilion hanko slams onto the page with an ink
 * splash, then "Published · 出版しました". Calls `onDone` when it has played
 * (sooner under reduced motion). Clicking anywhere or Escape skips it.
 * Hidden from assistive tech: pair it with a toast that says what happened.
 *   <PublishStamp kind="publish" title="Tokyo in 48 Hours" onDone={…} />
 */
export function PublishStamp({ kind = 'publish', title, onDone }) {
  const reduce = useReducedMotion();
  const meta = KINDS[kind] ?? KINDS.publish;
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => done.current?.(), reduce ? 900 : kind === 'save' ? 1500 : 1900);
    const onKey = (event) => event.key === 'Escape' && done.current?.();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [reduce, kind]);

  return createPortal(
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25 } }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      onClick={() => done.current?.()}
      // Decorative: the "Published" toast raised with it is the announcement.
      aria-hidden="true"
      data-print="hide"
    >
      <motion.div
        className={styles.sheet}
        initial={{ y: 0 }}
        animate={reduce ? undefined : { y: [0, 7, -3, 0], transition: { delay: 0.32, duration: 0.35, ease: 'easeOut' } }}
      >
        <div className={styles.impact} aria-hidden="true">
          {!reduce && (
            <>
              <motion.span
                className={styles.ring}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.9], opacity: [0.5, 0], transition: { delay: 0.3, duration: 0.9, ease: ease.out } }}
              />
              {FLECKS.map((f, i) => (
                <motion.span
                  key={i}
                  className={styles.fleck}
                  style={{ width: f.size, height: f.size }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: f.x, y: f.y, opacity: [0, 1, 0], scale: 1, transition: { delay: 0.3, duration: 0.8, ease: ease.out } }}
                />
              ))}
            </>
          )}
          <motion.div
            className={styles.seal}
            initial={reduce ? { opacity: 0 } : { scale: 2.8, rotate: -24, opacity: 0, y: -40 }}
            animate={
              reduce
                ? { opacity: 1, transition: { duration: 0.3 } }
                : { scale: 1, rotate: -7, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 560, damping: 24, mass: 1.2, delay: 0.1 } }
            }
          >
            <Hanko text={meta.seal} size={150} />
          </motion.div>
        </div>
        <motion.p
          className={styles.caption}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0.1 : 0.55, duration: 0.6, ease: ease.out } }}
        >
          <span className={styles.label}>{meta.label}</span>
          <span lang="ja" className={styles.jp}>
            {meta.jp}
          </span>
        </motion.p>
        {title && (
          <motion.p
            className={styles.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0.15 : 0.68, duration: 0.6, ease: ease.out } }}
          >
            “{title}”
          </motion.p>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
