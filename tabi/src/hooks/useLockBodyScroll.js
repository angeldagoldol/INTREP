import { useLayoutEffect } from 'react';

let locks = 0;
let previous = { overflow: '', paddingRight: '' };

/** Lock page scroll while `locked` is true. Reference-counted for stacked overlays. */
export function useLockBodyScroll(locked) {
  useLayoutEffect(() => {
    if (!locked) return undefined;
    const { body, documentElement } = document;
    if (locks === 0) {
      const scrollbar = window.innerWidth - documentElement.clientWidth;
      previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [locked]);
}
