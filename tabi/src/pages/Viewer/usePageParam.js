import { useCallback, useEffect, useState } from 'react';
import { useIsPresent } from 'framer-motion';
import { useLocation, useSearchParams } from 'react-router-dom';
import { clampPage } from '../../components/viewer/spreads.js';
import { pageParamFromHash, writePageToHash } from './hashParams.js';

/**
 * The reader's page index, mirrored to `?p=` for deep links and sharing.
 *
 * Turning a page writes the URL "shallowly" (history.replaceState, keeping
 * the router's own history state) instead of navigating: a navigation
 * re-renders the whole app shell on every turn, which costs frames while
 * the page is in flight. Navigations the router does see (links,
 * back/forward, a new ?p= from elsewhere) still win: each new location
 * re-reads the page from the URL. So does a hash typed or pasted into the
 * address bar, even one the router thinks it already has.
 *
 * The URL always names the page on screen: an out-of-range or malformed
 * ?p= is rewritten to the clamped page, and page 0 drops the parameter.
 * Returns [page, setPage].
 */
export function usePageParam(count) {
  const location = useLocation();
  const [params] = useSearchParams();
  // While the route animates out, the router already holds the next page's URL: leave it alone.
  const present = useIsPresent();
  const fromUrl = clampPage(params.get('p') ?? 0, count);
  // Entries the router did not create (typed URLs) all share the key "default", so the search counts too.
  const marker = `${location.key}|${location.search}`;
  const [state, setState] = useState({ marker, page: fromUrl });

  // A real navigation happened: adopt its page (React's "adjust state while rendering").
  if (present && state.marker !== marker) setState({ marker, page: fromUrl });
  const page = clampPage(state.marker === marker || !present ? state.page : fromUrl, count);

  // Canonical ?p= for the page actually shown (after a deep link, a clamp, a turn or a new URL).
  useEffect(() => {
    if (present) writePageToHash(page);
  }, [page, present, marker]);

  // Typing or pasting this route's URL again fires hashchange, but the router
  // may hand back a location identical to the one it had (key "default", same
  // search), which the marker cannot tell apart: read ?p= straight from the hash.
  const { pathname } = location;
  useEffect(() => {
    if (!present) return undefined;
    const onHashChange = () => {
      const fromHash = pageParamFromHash(window.location.hash, pathname);
      if (fromHash === undefined) return;
      const next = clampPage(fromHash ?? 0, count);
      setState((prev) => (prev.page === next ? prev : { ...prev, page: next }));
      writePageToHash(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [count, present, pathname]);

  const setPage = useCallback(
    (next) => {
      const value = clampPage(next, count);
      setState((prev) => (prev.page === value ? prev : { ...prev, page: value }));
      writePageToHash(value);
    },
    [count],
  );

  return [page, setPage];
}
