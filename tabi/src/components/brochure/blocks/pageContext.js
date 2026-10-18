import { createContext, useContext } from 'react';

/**
 * Render mode shared by every block of one page:
 *   isStatic — thumbnails / flip back faces: no motion, nothing focusable
 *   active   — the page the reader is looking at (plays entrances, counters)
 *   onCta    — contact-page call-to-action handler
 *   recto    — a right-hand page (odd page number): its outer edge is on the right
 *   facing   — drawn beside its facing page (a spread view), so a double-page photo spread can
 *              draw its halves; otherwise every page is drawn complete on its own
 */
export const PageContext = createContext({ isStatic: false, active: false, onCta: undefined, recto: true, facing: false });

export function usePage() {
  return useContext(PageContext);
}
