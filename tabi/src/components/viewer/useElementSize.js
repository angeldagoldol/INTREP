import { useLayoutEffect, useState } from 'react';

/**
 * Content-box size of `ref.current`, kept current with a ResizeObserver.
 * Returns { width: 0, height: 0 } until measured.
 */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = (width, height) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    const rect = el.getBoundingClientRect();
    update(Math.round(rect.width), Math.round(rect.height));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      update(Math.round(box.width), Math.round(box.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
