import { useLayoutEffect } from 'react';
import { fitRegions } from './blocks/fit.js';

/**
 * Keeps a page's [data-fit] regions fitted (blocks/fit.js): after every
 * render that changes the page, once web fonts arrive (their metrics differ
 * from the fallback's), and when the page is laid out at a new width (px
 * minimums such as hairlines do not scale). Batched to one pass per frame.
 * `page` and `brochure` are what the page draws: a new one refits, and so
 * does a new `extra` (anything else that changes the copy, such as the live
 * photos whose credits the page prints).
 */
export function useFit(ref, page, brochure, extra) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let frame = 0;
    let alive = true;
    const run = () => {
      frame = 0;
      if (alive) fitRegions(root);
    };
    const schedule = () => {
      if (!frame && alive) frame = requestAnimationFrame(run);
    };
    run();

    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    fonts?.addEventListener?.('loadingdone', schedule);
    fonts?.ready?.then?.(schedule);

    let width = root.clientWidth;
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (Math.abs(root.clientWidth - width) < 1) return;
            width = root.clientWidth;
            schedule();
          })
        : null;
    observer?.observe(root);

    return () => {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      fonts?.removeEventListener?.('loadingdone', schedule);
      observer?.disconnect();
    };
  }, [ref, page, brochure, extra]);
}
