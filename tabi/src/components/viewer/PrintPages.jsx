import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BrochurePage } from '../brochure/index.js';
import { PrintPhotosContext } from '../photo/photoContext.js';
import { PRINT_REQUEST, PRINT_WAIT_MS, imagesSettled } from './printBrochure.js';
import styles from './PrintPages.module.css';

/** Two frames: React has committed the photos' loaded state and the browser has painted it. */
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/**
 * Print edition of a brochure: every page, full width, one per sheet.
 * It only exists while printing, so the reader never pays for it; everything
 * else on the page carries data-print="hide". Its photos load eagerly, each
 * from one fixed file (PrintPhotosContext).
 *
 * - The reader's Print button (requestPrint(), printBrochure.js) and ⌘/Ctrl+P
 *   draw it first, wait for its photographs (≤ PRINT_WAIT_MS), then open the
 *   print dialog, so the sheets carry the pictures rather than stand-in art.
 * - A print started some other way (the browser's menu) draws it on
 *   `beforeprint`, with whatever has loaded by then.
 * Props: brochure.
 */
export function PrintPages({ brochure }) {
  const [printing, setPrinting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    // Commit synchronously: the browser lays out for print right after this event.
    const before = () => flushSync(() => setPrinting(true));
    const after = () => {
      setPrinting(false);
      setPreparing(false);
    };
    const request = () => {
      setPrinting(true);
      setPreparing(true);
    };
    const onKey = (event) => {
      if (event.key?.toLowerCase() !== 'p' || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.defaultPrevented) return;
      event.preventDefault();
      request();
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    window.addEventListener(PRINT_REQUEST, request);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      window.removeEventListener(PRINT_REQUEST, request);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // A requested print: wait for the photographs, then open the dialog (afterprint tidies up).
  useEffect(() => {
    if (!preparing) return undefined;
    let cancelled = false;
    imagesSettled(rootRef.current, PRINT_WAIT_MS)
      .then(nextPaint)
      .then(() => {
        if (cancelled) return;
        setPreparing(false);
        window.print();
      });
    return () => {
      cancelled = true;
    };
  }, [preparing]);

  if (!printing) return null;
  const pages = Array.isArray(brochure.pages) ? brochure.pages : [];

  return (
    <div ref={rootRef} className={styles.print} data-preparing={preparing || undefined}>
      <PrintPhotosContext.Provider value={true}>
        {pages.map((page, i) => (
          <div key={page?.id ?? i} className={styles.sheet}>
            <BrochurePage brochure={brochure} page={page} index={i} total={pages.length} isStatic />
          </div>
        ))}
      </PrintPhotosContext.Provider>
    </div>
  );
}
