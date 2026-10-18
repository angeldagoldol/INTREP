import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy through a hidden textarea and execCommand: for browsers without the
 * async Clipboard API, and for embeds and permission policies that refuse
 * it. The textarea goes into the fullscreen element while one is active
 * (everything else is inert then), and focus is put back afterwards.
 * Returns whether the browser says it copied.
 */
function legacyCopy(text) {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const active = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  (document.fullscreenElement ?? document.body).appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy') === true;
  } catch {
    ok = false;
  }
  area.remove();
  if (active instanceof HTMLElement && active !== document.body && active.isConnected) active.focus({ preventScroll: true });
  return ok;
}

/** Copy text to the clipboard; `copied` flips true for `resetMs`. `copy` resolves to whether it worked. */
export function useClipboard(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text) => {
      let ok = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          ok = legacyCopy(text);
        }
      } else {
        ok = legacyCopy(text);
      }
      if (!ok) return false;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copy, copied };
}
