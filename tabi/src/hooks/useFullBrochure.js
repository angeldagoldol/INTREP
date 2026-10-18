import { use, useEffect, useState } from 'react';
import { isOutline, loadBrochure, peekBrochure } from '../data/catalog.js';

/**
 * The brochure with all its pages. A built-in from the catalog is only an
 * outline until its chunk loads, so this suspends (the nearest <Suspense>
 * shows its fallback; a router navigation keeps the old page meanwhile) and
 * a failed load throws to the nearest error boundary. Anything else — user
 * brochures, templates, null — comes straight back.
 *
 *   const full = useFullBrochure(brochure);
 */
export function useFullBrochure(brochure) {
  if (!isOutline(brochure)) return brochure;
  return use(loadBrochure(brochure));
}

/**
 * The same without suspending, for decoration: the full brochure once it is
 * loaded, null until then (and if the load fails).
 */
export function useLoadedBrochure(brochure) {
  const [loaded, setLoaded] = useState(null);
  const now = peekBrochure(brochure);
  useEffect(() => {
    if (!brochure || peekBrochure(brochure)) return undefined;
    let live = true;
    loadBrochure(brochure).then(
      (full) => live && setLoaded({ from: brochure, full }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [brochure]);
  return now ?? (loaded?.from === brochure ? loaded.full : null);
}
