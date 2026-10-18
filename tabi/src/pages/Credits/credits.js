/**
 * The Credits page's data: every photograph the app shows, grouped by where
 * it appears (Home, each built-in brochure, the visitor's own brochures),
 * with its credit when downloaded, plus totals and a licence summary. Pure:
 * the photo functions are passed in (data/photos in the app, stubs in tests).
 */
import { sourceLinks } from '../../components/viewer/links.js';

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/** A credit entry like creditsFor() returns, from a resolved photo record. */
function creditOf(photo) {
  return {
    id: photo.id,
    caption: photo.caption,
    place: photo.place,
    ...photo.credit,
    attributionRequired: photo.attributionRequired,
    user: Boolean(photo.user),
  };
}

/** Photo ids once each, in order. */
function unique(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(str).filter(Boolean))];
}

/**
 * Credit groups, in page order:
 *   [{ id, kind: 'home'|'builtin'|'user', title, titleJp, slug, brochure, credits, pending,
 *      factsChecked, sources }]
 * - Home: the photographs `homeIds` names (resolved with `getPhoto`).
 * - Built-ins: `creditsFor(brochure)` and its listed photos not downloaded yet.
 * - The visitor's brochures: only those with something to credit (their uploads).
 * `pending` are photo records still waiting for download (registry photos only).
 */
export function creditGroups({ homeIds = [], builtins = [], userBrochures = [], getPhoto, resolvePhoto, creditsFor, photoIdsIn }) {
  const homePhotos = unique(homeIds).map((id) => getPhoto(id)).filter(Boolean);
  const groups = [
    {
      id: 'home',
      kind: 'home',
      title: 'Home page',
      titleJp: '表紙',
      slug: '',
      brochure: null,
      credits: homePhotos.filter((p) => p.available && (p.credit.author || p.credit.license)).map(creditOf),
      pending: homePhotos.filter((p) => !p.available),
      factsChecked: '',
      sources: [],
    },
  ];
  const brochureGroup = (brochure, kind) => {
    const photos = photoIdsIn(brochure)
      .map((id) => resolvePhoto(id, brochure))
      .filter(Boolean);
    return {
      id: str(brochure.id) || str(brochure.slug),
      kind,
      title: str(brochure.title) || 'Untitled brochure',
      titleJp: str(brochure.titleJp),
      slug: str(brochure.slug),
      brochure,
      credits: creditsFor(brochure),
      pending: photos.filter((p) => !p.available && !p.user),
      factsChecked: kind === 'builtin' ? str(brochure.factsChecked) : '',
      sources: kind === 'builtin' ? sourceLinks(brochure) : [],
    };
  };
  for (const b of builtins) if (b && typeof b === 'object') groups.push(brochureGroup(b, 'builtin'));
  for (const b of userBrochures) {
    if (!b || typeof b !== 'object') continue;
    const group = brochureGroup(b, 'user');
    if (group.credits.length) groups.push({ ...group, pending: [] });
  }
  return groups;
}

/** A photo's identity across groups: a registry id, or an upload within its own brochure. */
const photoKey = (group, photo) => (photo.user ? `${group.id}|${photo.id}` : photo.id);

/**
 * { credited, pending, listed, sources, brochures } across all groups. A
 * photograph listed in two groups (the Home page shows some of the Nostalgic
 * Japan brochure's) counts once.
 */
export function creditTotals(groups) {
  const credited = new Set();
  const pending = new Set();
  let sources = 0;
  let brochures = 0;
  for (const g of groups) {
    for (const c of g.credits) credited.add(photoKey(g, c));
    for (const p of g.pending) pending.add(photoKey(g, p));
    sources += g.sources.length;
    if (g.kind === 'builtin') brochures += 1;
  }
  for (const key of credited) pending.delete(key);
  return { credited: credited.size, pending: pending.size, listed: credited.size + pending.size, sources, brochures };
}

/**
 * The licences in use, most used first: [{ license, url, count }]. One entry
 * per licence name; its deed link is the first one found. Credits without a
 * licence name are left out.
 */
export function licenceSummary(groups) {
  const byName = new Map();
  const seen = new Set();
  for (const g of groups) {
    for (const c of g.credits) {
      if (seen.has(photoKey(g, c))) continue;
      seen.add(photoKey(g, c));
      const name = str(c.license);
      if (!name) continue;
      const entry = byName.get(name) ?? { license: name, url: '', count: 0 };
      entry.count += 1;
      if (!entry.url && str(c.licenseUrl)) entry.url = str(c.licenseUrl);
      byName.set(name, entry);
    }
  }
  return [...byName.values()].sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}
