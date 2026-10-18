/**
 * Pure helpers that turn the brochure library into what the Home page shows:
 * per-season / per-region counts, the featured shelf and compact labels.
 */

/**
 * Count brochures per value of `field`. Array fields (e.g. `seasons`) count
 * each distinct value once per brochure; missing values are skipped.
 *   countBy(list, 'region')  -> { kansai: 2, kanto: 1 }
 *   countBy(list, 'seasons') -> { spring: 3, autumn: 2 }
 */
export function countBy(brochures, field) {
  const counts = {};
  for (const brochure of brochures ?? []) {
    const value = brochure?.[field];
    const ids = Array.isArray(value) ? new Set(value) : value != null && value !== '' ? [value] : [];
    for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Built-ins before user brochures, then newest first. */
function byShelfOrder(a, b) {
  const source = (a.source === 'user' ? 1 : 0) - (b.source === 'user' ? 1 : 0);
  if (source !== 0) return source;
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
}

/**
 * The featured shelf: brochures flagged `featured` first (in library order),
 * topped up with the newest others so the shelf never looks empty.
 */
export function pickFeatured(brochures, limit = 8) {
  const list = (brochures ?? []).filter((b) => b && typeof b === 'object' && b.slug);
  const featured = list.filter((b) => b.featured);
  const rest = list.filter((b) => !b.featured).sort(byShelfOrder);
  return [...featured, ...rest].slice(0, Math.max(0, limit));
}

/** The id in `ids` with the highest count (first one wins a tie). */
export function busiestId(counts, ids) {
  let best = ids[0] ?? null;
  for (const id of ids) if ((counts[id] ?? 0) > (counts[best] ?? 0)) best = id;
  return best;
}

/** Up to `limit` brochures whose `field` matches `id` (array fields included). */
export function brochuresWith(brochures, field, id, limit = 3) {
  return (brochures ?? [])
    .filter((b) => {
      const value = b?.[field];
      return Array.isArray(value) ? value.includes(id) : value === id;
    })
    .slice(0, limit);
}

/**
 * A month range set tight for narrow columns, so it never breaks after the
 * dash: 'Mar – May' → 'Mar–May' (a closed-up en dash, as in print).
 */
export function tightRange(range) {
  return String(range ?? '').replace(/\s*[–—]\s*|\s+-\s+/g, '–');
}
