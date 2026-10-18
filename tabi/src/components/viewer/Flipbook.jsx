import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { CrossfadeBook } from './CrossfadeBook.jsx';
import {
  FLAT_LEFT,
  FLAT_RIGHT,
  TURN_FEEL,
  angularVelocity,
  dragAngle,
  hitZone,
  perspectiveFor,
  releaseVelocity,
  shouldCommit,
  turnProgress,
} from './flipMath.js';
import { bookOffset } from './layout.js';
import { Leaf } from './Leaf.jsx';
import { paperVars } from './pageMeta.js';
import { contentWindow, stackDepth } from './spreads.js';
import { useLeafMotion } from './useLeafMotion.js';
import styles from './Flipbook.module.css';

/** Pointer travel (px) before a press becomes a drag. */
const DRAG_SLOP = 8;
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]';

function isInteractive(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE));
}

/**
 * Where a pointer event lands on the book, in unscaled book pixels
 * (the stage may be zoomed), plus what is under it.
 */
function locate(event, el, layout, position, leafCount) {
  const rect = el.getBoundingClientRect();
  const double = layout.mode === 'double';
  const bookWidth = double ? layout.pageWidth * 2 : layout.pageWidth;
  const scale = rect.width / bookWidth || 1;
  const x = (event.clientX - rect.left) / scale;
  const y = (event.clientY - rect.top) / scale;
  const zone = hitZone({ x, y, pageWidth: layout.pageWidth, pageHeight: layout.pageHeight, mode: layout.mode });
  const onPage = !double || (zone.side === 'left' ? position > 0 : position < leafCount);
  return { ...zone, y, onPage };
}

/** Dog-ear hints: a corner of the page lifts when the pointer comes near it. */
function Ears({ double }) {
  const corners = double ? ['rb', 'rt', 'lb', 'lt'] : ['rb', 'rt'];
  return corners.map((corner) => (
    <span key={corner} className={styles.ear} data-corner={corner} aria-hidden="true">
      <span className={styles.earUnder} />
      <span className={styles.earFlap} />
    </span>
  ));
}

/**
 * The 3D book: every leaf is a real two-faced sheet turning on the spine.
 * Turns follow keys, buttons, clicks on a page's outer half and drags (the
 * page follows the pointer; release past halfway or with a flick to finish).
 */
function LeafBook({ brochure, book, position, onNavigate, layout, onCta, interactive, label }) {
  const { mode, pageWidth: width, pageHeight: height } = layout;
  const double = mode === 'double';
  const leafCount = book.leaves.length;
  const lastPosition = book.spreads.length - 1;
  const feel = TURN_FEEL[mode];
  const { angles, moving, grab, drag, release } = useLeafMotion(leafCount, position);
  const ref = useRef(null);
  const gesture = useRef(null);

  const canPrev = position > 0;
  const canNext = position < lastPosition;
  const span = contentWindow(book, position);
  const depth = stackDepth(book, position);
  const offset = bookOffset({ mode, position, leafCount, pageWidth: width });
  const totalLeaves = Math.max(1, double ? leafCount : leafCount - 1);
  const perspective = perspectiveFor(width);

  const setHint = (zone = '', corner = '') => {
    const el = ref.current;
    if (!el) return;
    el.dataset.zone = zone;
    el.dataset.corner = corner;
  };

  /** Which way a tap or hover on this spot would turn, if any. */
  const turnFor = (hit) => {
    if (!hit.onPage) return 0;
    if (!double) return hit.outer ? (hit.side === 'left' ? -1 : 1) : 0;
    // A closed book opens (or closes) from anywhere on its cover.
    if (hit.side === 'right') return canNext && (hit.outer || position === 0) ? 1 : 0;
    return canPrev && (hit.outer || position === lastPosition) ? -1 : 0;
  };

  const onPointerDown = (event) => {
    if (!interactive || event.button !== 0 || isInteractive(event.target)) return;
    const hit = locate(event, ref.current, layout, position, leafCount);
    if (!hit.onPage) return;
    gesture.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, hit, leaf: null, dir: 0, ignore: false, samples: [{ x: event.clientX, t: event.timeStamp }] };
  };

  const onPointerMove = (event) => {
    const g = gesture.current;
    if (!g) {
      if (event.pointerType !== 'mouse' || !interactive || isInteractive(event.target)) {
        setHint();
        return;
      }
      const hit = locate(event, ref.current, layout, position, leafCount);
      const dir = turnFor(hit);
      setHint(dir > 0 ? 'next' : dir < 0 ? 'prev' : '', dir && hit.corner ? (hit.y < height / 2 ? 'top' : 'bottom') : '');
      return;
    }
    if (event.pointerId !== g.id || g.ignore) return;
    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    g.samples.push({ x: event.clientX, t: event.timeStamp });
    if (g.samples.length > 10) g.samples.shift();

    if (g.leaf === null) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      // Mostly vertical: the reader is scrolling the page, not turning it.
      if (Math.abs(dy) > Math.abs(dx)) {
        g.ignore = true;
        return;
      }
      const dir = double ? (g.hit.side === 'right' ? 1 : -1) : dx < 0 ? 1 : -1;
      const towardsSpine = double ? Math.sign(dx) === -dir : true;
      const leaf = dir > 0 ? position : position - 1;
      const turnable = dir > 0 ? canNext : canPrev;
      if (!towardsSpine || !turnable || !grab(leaf)) {
        g.ignore = true;
        return;
      }
      g.leaf = leaf;
      g.dir = dir;
      ref.current.setPointerCapture?.(g.id);
      ref.current.dataset.dragging = 'true';
      setHint();
    }
    drag(g.leaf, dragAngle({ dx, width, dir: g.dir, gain: feel.gain }));
  };

  const finish = (event, cancelled) => {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    gesture.current = null;
    if (ref.current) delete ref.current.dataset.dragging;

    if (g.leaf !== null) {
      const velocity = releaseVelocity(g.samples);
      const progress = turnProgress(angles[g.leaf].get(), g.dir);
      const commit = !cancelled && shouldCommit({ progress, velocity, dir: g.dir, threshold: feel.threshold });
      const turned = g.dir > 0 ? FLAT_LEFT : FLAT_RIGHT;
      const rest = g.dir > 0 ? FLAT_RIGHT : FLAT_LEFT;
      release(g.leaf, commit ? turned : rest, angularVelocity(velocity, width, feel.gain));
      if (commit) onNavigate(position + g.dir);
      return;
    }
    if (cancelled || g.ignore || isInteractive(event.target)) return;
    if (Math.hypot(event.clientX - g.x0, event.clientY - g.y0) > DRAG_SLOP) return;
    const dir = turnFor(g.hit);
    if (dir) onNavigate(position + dir);
  };

  return (
    <motion.div
      ref={ref}
      className={styles.book}
      data-mode={mode}
      style={{
        ...paperVars(brochure.theme),
        width: double ? width * 2 : width,
        height,
        perspective,
        '--page-w': `${width}px`,
        '--stack-max': `${Math.min(10, Math.max(3, Math.round(width * 0.022)))}px`,
      }}
      initial={false}
      animate={{ x: offset }}
      transition={spring.gentle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onPointerLeave={() => setHint()}
      role="group"
      aria-roledescription="flipbook"
      aria-label={label}
    >
      {double && <span className={styles.slot} data-half="left" data-filled={depth.left > 0 || undefined} aria-hidden="true" />}
      <span className={styles.slot} data-half="right" data-filled={depth.right > 0 || !double || undefined} aria-hidden="true" />
      {double && (
        <span className={styles.stack} data-half="left" style={{ '--depth': depth.left / totalLeaves }} aria-hidden="true" />
      )}
      <span className={styles.stack} data-half="right" style={{ '--depth': depth.right / totalLeaves }} aria-hidden="true" />

      {book.leaves.map((leaf, i) => {
        const near = i >= span.from && i <= span.to;
        const mounted = near || moving.has(i);
        return (
          <Leaf
            key={i}
            angle={angles[i]}
            index={i}
            count={leafCount}
            double={double}
            width={width}
            height={height}
            perspective={perspective}
            moving={moving.has(i)}
            brochure={brochure}
            onCta={onCta}
            front={leaf.front}
            back={leaf.back}
            mounted={mounted}
            rich={near}
            frontLive={i === position}
            backLive={i === position - 1}
            frontGutter={double && leaf.front !== 0}
            backGutter={double && leaf.back !== book.count - 1}
          />
        );
      })}

      {double && <span className={styles.spine} data-open={(position > 0 && position < lastPosition) || undefined} aria-hidden="true" />}
      {interactive && <Ears double={double} />}
    </motion.div>
  );
}

/**
 * Interactive brochure flipbook.
 *
 *   <Flipbook brochure={b} book={buildBook(n, layout.mode)} position={s} onNavigate={setS} layout={layout} onCta={openPlanner} />
 *
 * - `book`       leaves and spreads from spreads.js (`buildBook`) for `layout.mode`.
 * - `position`   spread index (leaves turned); `onNavigate(next)` asks to move.
 * - `layout`     { mode: 'double'|'single', pageWidth, pageHeight } from layout.js.
 * - `interactive` false while the stage is zoomed (dragging pans instead).
 * - `onCta`      passed to the contact page's call to action.
 * - `label`      accessible name of the book.
 * Under reduced motion it becomes a flat crossfade with the same controls.
 */
export function Flipbook(props) {
  const reduce = useReducedMotion();
  if (reduce) return <CrossfadeBook {...props} />;
  return <LeafBook key={`${props.layout.mode}:${props.book.leaves.length}`} {...props} />;
}
