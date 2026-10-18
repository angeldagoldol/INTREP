import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { pad } from '../../lib/format.js';
import { ease, stagger } from '../../lib/motion.js';
import { IconButton } from '../ui/index.js';
import { MiniPage } from './MiniPage.jsx';
import { pageMeta } from './pageMeta.js';
import styles from './Overview.module.css';

const tile = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: ease.out } },
};

/** Arrow-key movement between tiles of a wrapping grid. */
function moveFocus(event, grid) {
  const tiles = Array.from(grid.querySelectorAll('button[data-tile]'));
  const index = tiles.indexOf(document.activeElement);
  if (index === -1) return;
  const columns = tiles.filter((t) => t.offsetTop === tiles[0].offsetTop).length || 1;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
  let next = null;
  if (step) next = index + step;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tiles.length - 1;
  if (next === null || next < 0 || next >= tiles.length) return;
  event.preventDefault();
  tiles[next].focus();
}

/**
 * Contact sheet of every page, laid over the reader. Choosing a page jumps
 * there and returns to reading; Esc or the close button just returns.
 * Focus is trapped inside and lands on the page being read.
 * Props: brochure, book, position, onSelect(pageIndex), onClose.
 */
export function Overview({ brochure, book, position, onSelect, onClose }) {
  const ref = useRef(null);
  const gridRef = useRef(null);
  const currentRef = useRef(null);
  const titleId = useId();
  useFocusTrap(ref, true, currentRef);

  const pages = Array.isArray(brochure.pages) ? brochure.pages : [];
  const visible = book.spreads[position]?.pages ?? [];

  return (
    <motion.div
      ref={ref}
      className={styles.overview}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3, ease: ease.out } }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: ease.in } }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.head}>
        <div>
          <p className="eyebrow">Contact sheet</p>
          <h2 id={titleId} className={styles.title}>
            All pages{' '}
            <span lang="ja" className={styles.titleJp}>
              全頁
            </span>
          </h2>
        </div>
        <IconButton label="Close overview" icon={<X />} variant="outline" tooltipSide="left" onClick={onClose} />
      </header>

      <motion.ol
        ref={gridRef}
        className={styles.grid}
        variants={stagger(0.03, 0.06)}
        initial="hidden"
        animate="show"
        onKeyDown={(event) => moveFocus(event, gridRef.current)}
      >
        {pages.map((page, i) => {
          const meta = pageMeta(page);
          const current = visible.includes(i);
          return (
            <motion.li key={page?.id ?? i} variants={tile}>
              <button
                type="button"
                data-tile
                ref={current && i === visible[0] ? currentRef : undefined}
                className={styles.tile}
                aria-current={current || undefined}
                aria-label={`Page ${i + 1}: ${meta.label}${current ? ' (reading now)' : ''}`}
                onClick={() => onSelect(i)}
              >
                <span className={styles.sheet}>
                  <MiniPage brochure={brochure} face={i} className={styles.mini} />
                </span>
                <span className={styles.caption} aria-hidden="true">
                  <span className={styles.num}>{pad(i + 1)}</span>
                  <span className={styles.label}>{meta.label}</span>
                  <span lang="ja" className={styles.jp}>
                    {meta.jp}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ol>
    </motion.div>
  );
}
