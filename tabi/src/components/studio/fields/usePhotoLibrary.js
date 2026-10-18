import { useEffect, useMemo, useState } from 'react';
import { listPhotos } from '../../../data/photos/index.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { buildLibrary } from '../photoLibrary.js';

const cache = new WeakMap();

/**
 * The built-in photo library as picker entries (photoLibrary.buildLibrary):
 * every registry photo, grouped by the built-in brochure that uses it. Built
 * once per set of built-ins and shared by every photo field.
 */
export function usePhotoLibrary() {
  const { builtins } = useBrochures();
  return useMemo(() => {
    if (!cache.has(builtins)) cache.set(builtins, buildLibrary(listPhotos(), builtins));
    return cache.get(builtins);
  }, [builtins]);
}

/**
 * True once `ref`'s element has come within `margin` of the viewport (and
 * stays true): tiles mount their artwork only when they are about to be seen.
 * Without IntersectionObserver (tests, old browsers) it is true at once.
 */
export function useNearViewport(ref, margin = '240px') {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (near || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin, near]);
  return near;
}
