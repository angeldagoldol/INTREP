/**
 * Library search, filtering, faceting and sorting. Pure functions only, so
 * the page, the mobile drawer's "Show N results" button and the tests all
 * agree on exactly which brochures match.
 *
 * Filters: { q, category, seasons[], region, fav, sort, view }
 *   q         free text; every term must match somewhere (AND), in any order
 *   category  one CATEGORIES id ('' = all)
 *   seasons   SEASONS ids; a brochure matches if it suits ANY of them
 *   region    one REGIONS id ('' = all)
 *   fav       only brochures whose id is in ctx.favoriteIds
 *   sort      'featured' | 'newest' | 'az' | 'quickest'
 */
import { CATEGORY_MAP, getCategory } from '../../data/categories.js';
import { REGION_MAP, getRegion } from '../../data/regions.js';
import { SEASONS, SEASON_MAP } from '../../data/seasons.js';
import { brochureKana } from '../../data/kana.js';
import { foldQuery } from '../../components/layout/search.js';

export const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'newest', label: 'Newest' },
  { id: 'az', label: 'A–Z' },
  { id: 'quickest', label: 'Quickest read' },
];

export const SORT_IDS = SORTS.map((s) => s.id);

export const DEFAULT_FILTERS = Object.freeze({
  q: '',
  category: '',
  seasons: Object.freeze([]),
  region: '',
  fav: false,
  sort: 'featured',
  view: 'grid',
});

/**
 * Split a query into folded terms, dropping stray punctuation ("kyoto," → "kyoto").
 * Text is folded exactly like the ⌘K palette (search.js foldQuery): lower-case,
 * no Latin diacritics, full/half width unified, katakana as hiragana, kana
 * keep their dakuten.
 */
export function queryTerms(query) {
  return foldQuery(query)
    .split(' ')
    .map((term) => term.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter(Boolean);
}

/** Searchable fields and how much a hit in each one counts towards relevance. */
const FIELD_WEIGHTS = {
  title: 8,
  titleJp: 8,
  kana: 7, // hiragana readings: title, region, category, seasons (data/kana.js)
  places: 6, // the brochure's location and the sights on its place and photo pages
  tags: 5,
  category: 4,
  region: 4,
  seasons: 3,
  subtitle: 2,
  organization: 2,
  summary: 1,
};

const indexCache = new WeakMap();

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Every place name a brochure carries: its `location` (English, Japanese,
 * prefecture) and each place page's and photo page's name and Japanese
 * name — once each.
 */
export function placeNames(brochure) {
  const names = [];
  const add = (...values) => {
    for (const value of values) {
      const name = text(value);
      if (name && !names.includes(name)) names.push(name);
    }
  };
  const location = brochure?.location;
  if (location && typeof location === 'object') add(location.name, location.nameJp, location.prefecture);
  for (const page of Array.isArray(brochure?.pages) ? brochure.pages : []) {
    if (!page || typeof page !== 'object') continue;
    if (page.type === 'place' || page.type === 'photo') add(page.name, page.nameJp);
  }
  return names;
}

/** Folded, per-field search text for one brochure (cached per object). */
function searchIndex(brochure) {
  const cached = indexCache.get(brochure);
  if (cached) return cached;
  const category = brochure.category ? getCategory(brochure.category) : {};
  const region = brochure.region ? getRegion(brochure.region) : {};
  const seasons = (Array.isArray(brochure.seasons) ? brochure.seasons : [])
    .map((id) => SEASON_MAP[id])
    .filter(Boolean)
    .map((s) => `${s.label} ${s.jp} ${s.romaji}`);
  const index = {
    title: foldQuery(brochure.title),
    titleJp: foldQuery(brochure.titleJp),
    kana: foldQuery(brochureKana(brochure)),
    places: foldQuery(placeNames(brochure).join(' · ')),
    tags: foldQuery(Array.isArray(brochure.tags) ? brochure.tags.join(' · ') : ''),
    category: foldQuery([category.label, category.jp].filter(Boolean).join(' ')),
    region: foldQuery([region.label, region.jp].filter(Boolean).join(' ')),
    seasons: foldQuery(seasons.join(' · ')),
    subtitle: foldQuery(brochure.subtitle),
    organization: foldQuery(brochure.organization),
    summary: foldQuery(brochure.summary),
  };
  indexCache.set(brochure, index);
  return index;
}

/** True when `term` starts a word in `text` (or the text is Japanese, which has no spaces). */
function startsWord(text, at) {
  return at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]);
}

/**
 * Relevance of a brochure for the given terms; 0 means "does not match".
 * Each term scores its best field; a hit at the start of a word scores a
 * little more than one in the middle ("nara" ranks Nara above "Naoshima").
 */
export function scoreBrochure(brochure, terms) {
  if (!terms.length) return 0;
  const index = searchIndex(brochure);
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const text = index[field];
      const at = text.indexOf(term);
      if (at === -1) continue;
      const score = weight + (startsWord(text, at) ? 1 : 0);
      if (score > best) best = score;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/** Fill in defaults so callers can pass partial filter objects. */
function withDefaults(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return { ...f, seasons: Array.isArray(f.seasons) ? f.seasons : [] };
}

/** Brochures passing every filter, unsorted, as `{ brochure, score }`. */
function matchBrochures(brochures, filters, ctx = {}) {
  const f = withDefaults(filters);
  const terms = queryTerms(f.q);
  const favorites = new Set(ctx.favoriteIds ?? []);
  const matches = [];
  for (const brochure of Array.isArray(brochures) ? brochures : []) {
    if (!brochure || typeof brochure !== 'object') continue;
    if (f.category && brochure.category !== f.category) continue;
    if (f.region && brochure.region !== f.region) continue;
    if (f.seasons.length) {
      const seasons = Array.isArray(brochure.seasons) ? brochure.seasons : [];
      if (!seasons.some((s) => f.seasons.includes(s))) continue;
    }
    if (f.fav && !favorites.has(brochure.id)) continue;
    const score = scoreBrochure(brochure, terms);
    if (terms.length && score === 0) continue;
    matches.push({ brochure, score });
  }
  return matches;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const time = (b) => {
  const t = Date.parse(b.updatedAt);
  return Number.isNaN(t) ? 0 : t;
};
const minutes = (b) => (Number.isFinite(b.readMinutes) ? b.readMinutes : Number.POSITIVE_INFINITY);
const byTitle = (a, b) => collator.compare(String(a.title ?? ''), String(b.title ?? ''));
const byNewest = (a, b) => time(b) - time(a);

const COMPARATORS = {
  // Featured first, then the freshest; while searching, best match first.
  featured: (a, b, searching) =>
    (searching ? b.score - a.score : 0) ||
    Number(Boolean(b.brochure.featured)) - Number(Boolean(a.brochure.featured)) ||
    byNewest(a.brochure, b.brochure) ||
    byTitle(a.brochure, b.brochure),
  newest: (a, b) => byNewest(a.brochure, b.brochure) || byTitle(a.brochure, b.brochure),
  az: (a, b) => byTitle(a.brochure, b.brochure),
  quickest: (a, b) => minutes(a.brochure) - minutes(b.brochure) || byTitle(a.brochure, b.brochure),
};

/**
 * Filter and sort brochures for the library.
 *   filterBrochures(brochures, { q: 'tohoku', seasons: ['summer'] }, { favoriteIds })
 * Never mutates its input; tolerates missing/odd fields on user brochures.
 */
export function filterBrochures(brochures, filters, ctx = {}) {
  const f = withDefaults(filters);
  const searching = queryTerms(f.q).length > 0;
  const compare = COMPARATORS[f.sort] ?? COMPARATORS.featured;
  return matchBrochures(brochures, f, ctx)
    .sort((a, b) => compare(a, b, searching))
    .map((m) => m.brochure);
}

function tally(matches, keysOf) {
  const counts = {};
  for (const { brochure } of matches) {
    for (const key of new Set(keysOf(brochure))) counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Facet counts: how many results each option would give, with every *other*
 * filter applied. Drives the numbers on category chips, season toggles and
 * region options.
 * Returns { category: {id: n}, season: {id: n}, region: {id: n}, allCategories: n }.
 */
export function facetCounts(brochures, filters, ctx = {}) {
  const f = withDefaults(filters);
  const anyCategory = matchBrochures(brochures, { ...f, category: '' }, ctx);
  return {
    category: tally(anyCategory, (b) => [b.category]),
    season: tally(matchBrochures(brochures, { ...f, seasons: [] }, ctx), (b) => (Array.isArray(b.seasons) ? b.seasons : [])),
    region: tally(matchBrochures(brochures, { ...f, region: '' }, ctx), (b) => [b.region]),
    allCategories: anyCategory.length,
  };
}

/** True when anything narrows the results (sort and view do not). */
export function hasActiveFilters(filters) {
  const f = withDefaults(filters);
  return Boolean(f.q.trim() || f.category || f.seasons.length || f.region || f.fav);
}

/** Number of active filters, for the mobile "Filters (n)" button. The search box is not counted. */
export function countActiveFilters(filters) {
  const f = withDefaults(filters);
  return (f.category ? 1 : 0) + f.seasons.length + (f.region ? 1 : 0) + (f.fav ? 1 : 0);
}

/**
 * Removable pills for the active-filter summary.
 * Each: { key, label, jp?, color?, patch } — apply `patch` to remove it.
 */
export function describeFilters(filters) {
  const f = withDefaults(filters);
  const pills = [];
  const q = f.q.trim();
  if (q) pills.push({ key: 'q', label: `“${q}”`, kind: 'Search', patch: { q: '' } });
  if (f.category) {
    const c = CATEGORY_MAP[f.category] ?? getCategory(f.category);
    pills.push({ key: 'category', label: c.label, jp: c.jp, color: c.color, kind: 'Category', patch: { category: '' } });
  }
  for (const id of f.seasons) {
    const s = SEASON_MAP[id];
    if (!s) continue;
    pills.push({
      key: `season:${id}`,
      label: s.label,
      jp: s.jp,
      color: s.color,
      kind: 'Season',
      patch: { seasons: f.seasons.filter((x) => x !== id) },
    });
  }
  if (f.region) {
    const r = REGION_MAP[f.region] ?? getRegion(f.region);
    pills.push({ key: 'region', label: r.label, jp: r.jp, kind: 'Region', patch: { region: '' } });
  }
  if (f.fav) pills.push({ key: 'fav', label: 'Saved only', kind: 'Favourites', patch: { fav: false } });
  return pills;
}

/** Seasons in calendar order, de-duplicated and validated. */
export function orderSeasons(ids) {
  const wanted = new Set(ids);
  return SEASONS.filter((s) => wanted.has(s.id)).map((s) => s.id);
}

/** Toggle one season in a selection, keeping calendar order. */
export function toggleSeason(seasons, id) {
  const list = Array.isArray(seasons) ? seasons : [];
  return orderSeasons(list.includes(id) ? list.filter((s) => s !== id) : [...list, id]);
}
