/**
 * The brochure a viewer URL names: the exact slug first, then one whose slug
 * differs only in letter case or Unicode composition — hand-typed or
 * re-cased links (`#/brochures/KYOTO-THOUSAND-GATES`). Slugs are
 * lower-cased by `slugify`, so the loose match is unambiguous for them.
 * Returns null when nothing matches.
 */
export function findBySlug(brochures, slug) {
  if (!Array.isArray(brochures)) return null;
  const want = String(slug ?? '');
  if (!want) return null;
  const exact = brochures.find((b) => b?.slug === want);
  if (exact) return exact;
  const fold = (value) => value.normalize('NFC').toLowerCase();
  const key = fold(want);
  return brochures.find((b) => typeof b?.slug === 'string' && b.slug && fold(b.slug) === key) ?? null;
}
