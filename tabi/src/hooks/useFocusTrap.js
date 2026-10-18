import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Keep Tab focus inside `ref` while active, focus the first field on open
 * (or `initialFocusRef`), and restore focus to the opener on close.
 */
export function useFocusTrap(ref, active, initialFocusRef) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const container = ref.current;
    const opener = document.activeElement;

    const focusables = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const first = initialFocusRef?.current ?? focusables()[0] ?? container;
    requestAnimationFrame(() => first?.focus?.({ preventScroll: true }));

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, [ref, active, initialFocusRef]);
}
