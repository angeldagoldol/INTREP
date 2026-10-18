import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hitZone } from './flipMath.js';
import { bookOffset } from './layout.js';
import { PageFace } from './PageFace.jsx';
import { paperVars } from './pageMeta.js';
import styles from './Flipbook.module.css';

const SWIPE = 48;
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';

/**
 * Flat flipbook for reduced motion: no 3D, no peel — spreads simply
 * crossfade. Taps on a page's outer half and horizontal swipes still turn.
 * Same props as <Flipbook>.
 */
export function CrossfadeBook({ brochure, book, position, onNavigate, layout, onCta, interactive = true, label }) {
  const { mode, pageWidth: width, pageHeight: height } = layout;
  const double = mode === 'double';
  const spread = book.spreads[position] ?? book.spreads[0];
  const lastPosition = book.spreads.length - 1;
  const press = useRef(null);
  const ref = useRef(null);

  const onPointerDown = (event) => {
    if (!interactive || event.button !== 0 || event.target.closest?.(INTERACTIVE)) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    // A swipe may end outside the book (past its edge): keep receiving it. Released on pointerup.
    ref.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event) => {
    const start = press.current;
    press.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    let dir = 0;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) dir = dx < 0 ? 1 : -1;
    else if (Math.hypot(dx, dy) < 8) {
      const rect = ref.current.getBoundingClientRect();
      const scale = rect.width / (double ? width * 2 : width) || 1;
      const hit = hitZone({ x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale, pageWidth: width, pageHeight: height, mode });
      if (hit.outer) dir = hit.side === 'left' ? -1 : 1;
    }
    const next = position + dir;
    if (dir && next >= 0 && next <= lastPosition) onNavigate(next);
  };

  const faces = double ? [spread.left, spread.right] : [spread.right];
  const offset = bookOffset({ mode, position, leafCount: book.leaves.length, pageWidth: width });
  const isInner = (face) => face !== null && face !== 0 && face !== book.count - 1;

  return (
    <div
      ref={ref}
      className={styles.book}
      data-mode={mode}
      style={{ ...paperVars(brochure.theme), width: double ? width * 2 : width, height, transform: `translateX(${offset}px)` }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        press.current = null;
      }}
      role="group"
      aria-roledescription="flipbook"
      aria-label={label}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={position}
          className={styles.flatSpread}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.28 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {faces.map((face, i) => (
            <div key={i} className={styles.flatPage} data-empty={face === null || undefined} style={{ width, height }}>
              {face !== null && <PageFace brochure={brochure} face={face} mounted live onCta={onCta} facing={double} />}
              {double && isInner(face) && <span className={styles.gutter} data-side={i === 0 ? 'back' : 'front'} aria-hidden="true" />}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      {double && <span className={styles.spine} data-open={(position > 0 && position < lastPosition) || undefined} aria-hidden="true" />}
    </div>
  );
}
