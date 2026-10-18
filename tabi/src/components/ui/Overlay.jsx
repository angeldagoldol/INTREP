import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll.js';
import { backdrop, ease, spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { IconButton } from './IconButton.jsx';
import styles from './Overlay.module.css';

const PANEL_MOTION = {
  center: {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
    exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18, ease: ease.in } },
  },
  right: {
    hidden: { x: '100%' },
    show: { x: 0, transition: { duration: 0.6, ease: ease.out } },
    exit: { x: '100%', transition: { duration: 0.3, ease: ease.in } },
  },
  left: {
    hidden: { x: '-100%' },
    show: { x: 0, transition: { duration: 0.6, ease: ease.out } },
    exit: { x: '-100%', transition: { duration: 0.3, ease: ease.in } },
  },
  bottom: {
    hidden: { y: '100%' },
    show: { y: 0, transition: { duration: 0.6, ease: ease.out } },
    exit: { y: '100%', transition: { duration: 0.3, ease: ease.in } },
  },
};

function OverlayPanel({ onClose, title, description, hideHeader, placement, size, className, initialFocusRef, children, footer }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useFocusTrap(panelRef, true, initialFocusRef);
  useLockBodyScroll(true);

  return (
    <div className={styles.root} data-placement={placement} data-print="hide">
      <motion.div
        className={styles.backdrop}
        variants={backdrop}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(styles.panel, styles[placement], styles[size], className)}
        variants={PANEL_MOTION[placement]}
        initial="hidden"
        animate="show"
        exit="exit"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose?.();
          }
        }}
      >
        {/* Divs, not <header>/<footer>: portalled to <body>, those would become
            page-level banner and contentinfo landmarks next to the site's. */}
        {!hideHeader && (
          <div className={styles.header}>
            <div className={styles.heading}>
              {title && (
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close" icon={<X />} onClick={onClose} variant="outline" size="sm" tooltip={false} />
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </motion.div>
    </div>
  );
}

function Overlay({ open, ...props }) {
  return createPortal(<AnimatePresence>{open && <OverlayPanel {...props} />}</AnimatePresence>, document.body);
}

/**
 * Centered dialog with backdrop, focus trap, Esc-to-close and scroll lock.
 *   <Modal open={open} onClose={close} title="Share" description="…" footer={<Button/>}>…</Modal>
 * size: 'sm' | 'md' | 'lg' | 'xl'. Pass hideHeader to render your own header.
 */
export function Modal({ size = 'md', ...props }) {
  return <Overlay placement="center" size={size} {...props} />;
}

/** Slide-in side sheet. side: 'right' | 'left' | 'bottom'. */
export function Drawer({ side = 'right', size = 'md', ...props }) {
  return <Overlay placement={side} size={size} {...props} />;
}
