import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { MiniPage } from './MiniPage.jsx';
import { spreadCaption } from './pageMeta.js';
import { spreadAnnouncement, spreadLabel } from './spreads.js';
import styles from './Scrubber.module.css';

const BUBBLE_HALF = 84; // keeps the preview bubble inside the track

/**
 * Progress track with a tick per spread and a draggable handle. Dragging
 * (or clicking) riffles the book to that spread; hovering previews it.
 * Keyboard: it is a slider — ←/→ ↑/↓ step, Home/End jump.
 * Props: brochure, book (spreads.js), position, onChange(position);
 * bubble (default true) shows the hovered spread in a bubble above the
 * track; onPreview(position | null) reports the hovered or dragged spread,
 * for hosts that show the preview elsewhere (the reader's filmstrip).
 */
export function Scrubber({ brochure, book, position, onChange, bubble = true, onPreview }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const last = book.spreads.length - 1;
  const ratio = last > 0 ? position / last : 0;

  const measure = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const at = Math.round(t * last);
    const x = Math.min(Math.max((at / Math.max(last, 1)) * rect.width, BUBBLE_HALF), rect.width - BUBBLE_HALF);
    return { at, x };
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || last === 0) return;
    trackRef.current.setPointerCapture?.(event.pointerId);
    drag.current = event.pointerId;
    setDragging(true);
    const hit = measure(event.clientX);
    setPreview(hit);
    if (hit.at !== position) onChange(hit.at);
  };

  const onPointerMove = (event) => {
    if (last === 0) return;
    const dragging = drag.current === event.pointerId;
    if (!dragging && event.pointerType !== 'mouse') return;
    const hit = measure(event.clientX);
    setPreview((prev) => (prev && prev.at === hit.at && prev.x === hit.x ? prev : hit));
    if (dragging && hit.at !== position) onChange(hit.at);
  };

  const endDrag = (event) => {
    if (drag.current !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.pointerType !== 'mouse') setPreview(null);
  };

  const onKeyDown = (event) => {
    const steps = { ArrowRight: 1, ArrowUp: 1, PageDown: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: -1 };
    let next = null;
    if (event.key in steps) next = position + steps[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    next = Math.min(Math.max(next, 0), last);
    if (next !== position) onChange(next);
  };

  const previewAt = preview ? preview.at : null;
  useEffect(() => {
    onPreview?.(previewAt);
  }, [previewAt, onPreview]);

  const shown = bubble && preview ? book.spreads[preview.at] : null;

  return (
    <div className={styles.scrubber}>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={0}
        aria-label="Page"
        aria-valuemin={1}
        aria-valuemax={last + 1}
        aria-valuenow={position + 1}
        aria-valuetext={spreadAnnouncement(book.spreads[position], book.count)}
        data-dragging={dragging || undefined}
        style={{ '--ratio': ratio }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !dragging && setPreview(null)}
        onKeyDown={onKeyDown}
      >
        <span className={styles.rail} aria-hidden="true" />
        <span className={styles.fill} aria-hidden="true" />
        {book.spreads.map((spread, i) => (
          <span
            key={spread.index}
            className={styles.tick}
            data-passed={i <= position || undefined}
            style={{ left: `${last > 0 ? (i / last) * 100 : 0}%` }}
            aria-hidden="true"
          />
        ))}
        <span className={styles.handleTrack} aria-hidden="true">
          <span className={styles.handle} />
        </span>
      </div>

      <AnimatePresence>
        {shown && (
          <motion.div
            className={styles.bubble}
            style={{ left: preview.x }}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring.snappy}
            aria-hidden="true"
          >
            <span className={styles.bubblePages}>
              <MiniPage brochure={brochure} face={shown.left} facing={book.mode === 'double'} />
              <MiniPage brochure={brochure} face={shown.right} facing={book.mode === 'double'} />
            </span>
            <span className={styles.bubbleText}>
              <span className={styles.bubbleLabel}>{spreadLabel(shown)}</span>
              <span className={styles.bubbleCaption}>{spreadCaption(shown, brochure.pages)}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
