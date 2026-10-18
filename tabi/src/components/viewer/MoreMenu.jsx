import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { ease, spring } from '../../lib/motion.js';
import { IconButton } from '../ui/index.js';
import styles from './MoreMenu.module.css';

/** Focus the enabled item at `index` (wrapping around). */
function focusItem(menu, index) {
  const list = Array.from(menu?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? []);
  if (list.length === 0) return;
  list[(index + list.length) % list.length].focus();
}

/**
 * Compact overflow menu for toolbar actions that do not fit.
 *   <MoreMenu items={[{ id, label, icon, onSelect, disabled, hint }]} />
 * Keyboard: ↑/↓/Home/End move, Enter/Space choose, Esc or Tab closes and
 * focus returns to the trigger. Clicking outside closes it.
 */
export function MoreMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => focusItem(menuRef.current, 0));
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    const list = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)'));
    const index = list.indexOf(document.activeElement);
    const keys = {
      ArrowDown: () => focusItem(menuRef.current, index + 1),
      ArrowUp: () => focusItem(menuRef.current, index - 1),
      Home: () => focusItem(menuRef.current, 0),
      End: () => focusItem(menuRef.current, list.length - 1),
      Escape: () => close(),
      Tab: () => close(false),
    };
    const action = keys[event.key];
    if (!action) {
      // Keys a page behind the menu listens for (the reader turns on them) stay in the menu.
      if (['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key !== 'Tab') event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <div className={styles.more}>
      <IconButton
        ref={triggerRef}
        label={label}
        icon={<MoreHorizontal />}
        variant={open ? 'solid' : 'ghost'}
        tooltip={!open}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className={styles.menu}
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14, ease: ease.in } }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                disabled={item.disabled}
                data-tone={item.tone}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.label}>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
