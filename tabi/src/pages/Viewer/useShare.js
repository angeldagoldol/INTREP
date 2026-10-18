import { useCallback } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useClipboard } from '../../hooks/useClipboard.js';

/**
 * Share the current page of a brochure: the native share sheet where there
 * is one, otherwise copy the link (deep-linked to the page) and say so.
 */
export function useShare(brochure) {
  const toast = useToast();
  const { copy } = useClipboard();

  return useCallback(async () => {
    const url = window.location.href;
    const data = { title: `${brochure.title} — Tabi`, text: brochure.summary || brochure.subtitle || brochure.title, url };
    if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    const ok = await copy(url);
    toast(
      ok
        ? { title: 'Link copied', description: 'It opens this brochure at the page you are on.', tone: 'success' }
        : { title: 'Could not copy the link', description: url, tone: 'error' },
    );
  }, [brochure.title, brochure.summary, brochure.subtitle, copy, toast]);
}
