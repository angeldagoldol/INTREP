import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, Modal } from '../ui/index.js';
import { BrochurePage } from '../brochure/index.js';
import { useHotkey } from '../../hooks/useHotkey.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { ease } from '../../lib/motion.js';
import { pad } from '../../lib/format.js';
import { Endpaper } from './Endpaper.jsx';
import { BLANK, buildSpreads, isPageFace, spreadOf, spreadPages } from './studioFormat.js';
import styles from './PreviewModal.module.css';

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.5, ease: ease.out } },
  exit: (dir) => ({ opacity: 0, x: dir * -40, transition: { duration: 0.22, ease: ease.in } }),
};

function Reader({ brochure, startIndex }) {
  const single = useMediaQuery('(max-width: 759.98px)');
  const pages = brochure.pages;
  // Spreads are bound exactly as the published flipbook binds them: [left, right] faces.
  const groups = single ? pages.map((_, i) => [i]) : buildSpreads(pages.length);
  const [position, setPosition] = useState(() => ({ page: startIndex, dir: 1 }));
  const current = single ? Math.min(position.page, pages.length - 1) : spreadOf(position.page, pages.length);
  const group = groups[current] ?? [0];
  const shown = spreadPages(group);
  const half = !single && group.some((face) => face === null);

  const go = (delta) => {
    const target = spreadPages(groups[current + delta])[0];
    if (target !== undefined) setPosition({ page: target, dir: delta });
  };
  useHotkey('ArrowLeft', () => go(-1));
  useHotkey('ArrowRight', () => go(1));

  return (
    <div className={styles.reader}>
      <div className={styles.book} data-single={single || undefined}>
        <AnimatePresence initial={false} custom={position.dir} mode="popLayout">
          <motion.div
            key={group.join('-')}
            className={styles.spread}
            data-half={half || undefined}
            custom={position.dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {group.map((face, slot) => {
              const side = single ? 'single' : slot === 0 ? 'left' : 'right';
              if (face === BLANK) {
                return (
                  <div key="endpaper" className={styles.page} data-side={side}>
                    <Endpaper brochure={brochure} />
                  </div>
                );
              }
              if (!isPageFace(face) || !pages[face]) return null;
              return (
                <div key={pages[face].id} className={styles.page} data-side={side}>
                  <BrochurePage brochure={brochure} page={pages[face]} index={face} total={pages.length} active facing={!single} />
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={styles.controls}>
        <IconButton label="Previous" icon={<ChevronLeft />} variant="outline" disabled={current === 0} onClick={() => go(-1)} />
        <p className={styles.counter} aria-live="polite">
          {shown.length > 1 ? `Pages ${pad(shown[0] + 1)}–${pad(shown[1] + 1)}` : `Page ${pad((shown[0] ?? 0) + 1)}`}
          <span> of {pad(pages.length)}</span>
        </p>
        <IconButton label="Next" icon={<ChevronRight />} variant="outline" disabled={current === groups.length - 1} onClick={() => go(1)} />
      </div>
    </div>
  );
}

/**
 * Full-screen proof of the whole brochure, page by page (spreads on wide
 * screens). Arrow keys flip; Escape closes.
 *   <PreviewModal open={open} onClose={close} brochure={doc} startIndex={2} />
 */
export function PreviewModal({ open, onClose, brochure, startIndex = 0 }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={brochure.title || 'Untitled brochure'}
      description="Proof copy — flip with ← →. Publish to open it in the full flipbook reader."
    >
      <Reader brochure={brochure} startIndex={startIndex} />
    </Modal>
  );
}
