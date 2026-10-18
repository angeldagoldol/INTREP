import { useCallback, useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. SSR/jsdom-safe (returns `false` without matchMedia). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True on devices with a fine pointer that can hover (mouse / trackpad). */
export function useFinePointer() {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
