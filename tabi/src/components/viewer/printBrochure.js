/**
 * Printing a brochure with its photographs. The print edition (PrintPages)
 * only exists while printing, so its pictures start loading when it appears;
 * the browser's own print shortcut lays the sheets out at once and would
 * print the stand-in art. The reader's Print button (and ⌘/Ctrl+P in the
 * reader) asks for a print instead: PrintPages draws every page, waits until
 * its photographs have arrived (or a few seconds have passed), then opens the
 * print dialog.
 *
 *   requestPrint();                       // the Print button
 *   await imagesSettled(root, 6000);      // PrintPages, before window.print()
 */

/** The event PrintPages listens for. */
export const PRINT_REQUEST = 'tabi:print';

/** How long a print waits for photographs before opening the dialog anyway. */
export const PRINT_WAIT_MS = 6000;

/** Ask the reader's print edition to get ready and open the print dialog. */
export function requestPrint() {
  window.dispatchEvent(new Event(PRINT_REQUEST));
}

/**
 * Resolves once every <img> under `root` has loaded or failed — including
 * images that appear meanwhile (a live photo arriving) — or after `timeout` ms.
 */
export function imagesSettled(root, timeout = PRINT_WAIT_MS, { interval = 120 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const images = root ? [...root.querySelectorAll('img')] : [];
      const waiting = images.some((img) => !img.complete);
      if (!waiting || Date.now() - started >= timeout) resolve();
      else setTimeout(check, interval);
    };
    check();
  });
}
