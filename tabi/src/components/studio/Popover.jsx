import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ease } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { nextTabbable, tabbablesIn } from './a11y.js';
import styles from './Popover.module.css';

const MARGIN = 8;
const FOCUSABLE = 'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function PopoverPanel({ anchorRef, onClose, placement, offset, label, role, className, children, initialFocusRef }) {
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  // Position against the anchor (flip above when there is no room below).
  // Written straight to the DOM so scrolling never re-renders the content.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor || !wrap) return;
      const { offsetWidth: w, offsetHeight: h } = wrap;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const preferred = placement.endsWith('end') ? anchor.right - w : anchor.left;
      const left = Math.min(Math.max(MARGIN, preferred), Math.max(MARGIN, vw - w - MARGIN));
      const below = anchor.bottom + offset;
      const above = anchor.top - offset - h;
      const flip = below + h > vh - MARGIN && above > MARGIN;
      wrap.style.left = `${Math.round(left)}px`;
      wrap.style.top = `${Math.round(flip ? above : Math.max(MARGIN, Math.min(below, vh - h - MARGIN)))}px`;
      wrap.dataset.side = flip ? 'top' : 'bottom';
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(wrap);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, placement, offset]);

  // Focus inside on open; give focus back to the anchor on close.
  useEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    const target = initialFocusRef?.current ?? panel?.querySelector(FOCUSABLE) ?? panel;
    const frame = requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost || panel?.contains(document.activeElement)) anchor?.focus({ preventScroll: true });
    };
  }, [anchorRef, initialFocusRef]);

  // Close on outside press and on Escape. Tab past either end of the panel
  // closes it too and carries on from the trigger, as if the panel sat right
  // after it in the page (it is portalled to the end of <body>, so the
  // browser alone would send focus out of the document).
  useEffect(() => {
    const onPointerDown = (event) => {
      if (wrapRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    const onTab = (event) => {
      const panel = panelRef.current;
      const active = document.activeElement;
      if (!panel || !wrapRef.current?.contains(active)) return;
      const stops = tabbablesIn(panel);
      const leaving = event.shiftKey ? active === panel || active === stops[0] : stops.length === 0 || active === stops[stops.length - 1];
      if (!leaving) return;
      event.preventDefault();
      const anchor = anchorRef.current;
      // Move focus before closing, so the close doesn't hand it back to the trigger.
      (event.shiftKey ? anchor : (nextTabbable(anchor, wrapRef.current) ?? anchor))?.focus();
      onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        onTab(event);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchorRef, onClose]);

  return (
    <div ref={wrapRef} className={styles.wrap} data-print="hide">
      <motion.div
        ref={panelRef}
        role={role}
        aria-label={label}
        tabIndex={-1}
        className={cn(styles.panel, className)}
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: ease.out } }}
        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14, ease: ease.in } }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next && !wrapRef.current?.contains(next) && !anchorRef.current?.contains(next)) onClose();
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Floating panel anchored to a trigger: portalled, positioned with fixed
 * coordinates (never clipped by scrolling columns), flips above when needed,
 * closes on outside press, Escape or when focus leaves, and returns focus
 * to the trigger.
 *   <Popover open={open} onClose={close} anchorRef={buttonRef} label="Add a page" role="menu">…</Popover>
 * placement: 'bottom-start' | 'bottom-end'.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  placement = 'bottom-start',
  offset = 8,
  label,
  role = 'dialog',
  className,
  initialFocusRef,
  children,
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <PopoverPanel
          anchorRef={anchorRef}
          onClose={onClose}
          placement={placement}
          offset={offset}
          label={label}
          role={role}
          className={className}
          initialFocusRef={initialFocusRef}
        >
          {children}
        </PopoverPanel>
      )}
    </AnimatePresence>,
    document.body,
  );
}
