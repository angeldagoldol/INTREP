/**
 * "More like this": brochures that share the current one's category or
 * region (season overlap breaks ties), topped up with featured brochures.
 */

function seasonOverlap(a, b) {
  const set = new Set(Array.isArray(a) ? a : []);
  return (Array.isArray(b) ? b : []).filter((s) => set.has(s)).length;
}

function time(value) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/** Up to `limit` brochures related to `current`, best match first. */
export function relatedBrochures(current, all, limit = 3) {
  if (!current || !Array.isArray(all)) return [];
  const others = all.filter((b) => b && b.id !== current.id);

  const scored = others
    .map((b) => {
      const category = b.category && b.category === current.category ? 3 : 0;
      const region = b.region && b.region === current.region ? 2 : 0;
      return { b, match: category + region, score: category + region + seasonOverlap(current.seasons, b.seasons) * 0.25 };
    })
    .filter((x) => x.match > 0)
    .sort((x, y) => y.score - x.score || time(y.b.updatedAt) - time(x.b.updatedAt))
    .map((x) => x.b);

  const picked = scored.slice(0, limit);
  if (picked.length < limit) {
    const fillers = others
      .filter((b) => !picked.includes(b))
      .sort((x, y) => Number(Boolean(y.featured)) - Number(Boolean(x.featured)) || time(y.updatedAt) - time(x.updatedAt));
    picked.push(...fillers.slice(0, limit - picked.length));
  }
  return picked;
}
