import { useEffect } from 'react';

const BASE = 'Tabi';

/** Set the tab title; pass a falsy value to use the default. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${BASE}` : `${BASE} — Japan, folded into pages`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
