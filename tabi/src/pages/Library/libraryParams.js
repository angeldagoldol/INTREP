/**
 * Library filters <-> URL search params, so every view is shareable and the
 * back button walks through filter changes.
 *   #/brochures?q=onsen&category=onsen&season=autumn,winter&region=kanto&fav=1&sort=newest&view=list
 * Unknown or malformed values are dropped instead of producing a mystery
 * empty state from a stale link.
 */
import { CATEGORY_MAP } from '../../data/categories.js';
import { REGION_MAP } from '../../data/regions.js';
import { DEFAULT_FILTERS, SORT_IDS, orderSeasons } from './filterBrochures.js';

const MAX_QUERY = 120;

/** URLSearchParams (or anything with .get) → a complete, valid filters object. */
export function parseFilters(params) {
  const get = (key) => params?.get?.(key) ?? '';
  const category = get('category');
  const region = get('region');
  const sort = get('sort');
  return {
    q: get('q').slice(0, MAX_QUERY),
    category: CATEGORY_MAP[category] ? category : '',
    seasons: orderSeasons(get('season').split(',')),
    region: REGION_MAP[region] ? region : '',
    fav: get('fav') === '1',
    sort: SORT_IDS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    view: get('view') === 'list' ? 'list' : 'grid',
  };
}

/** Filters → URLSearchParams with defaults omitted, keys in a stable order. */
export function toSearchParams(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const params = new URLSearchParams();
  const q = String(f.q ?? '').slice(0, MAX_QUERY);
  if (q.trim()) params.set('q', q);
  if (f.category) params.set('category', f.category);
  const seasons = orderSeasons(Array.isArray(f.seasons) ? f.seasons : []);
  if (seasons.length) params.set('season', seasons.join(','));
  if (f.region) params.set('region', f.region);
  if (f.fav) params.set('fav', '1');
  if (f.sort && f.sort !== DEFAULT_FILTERS.sort) params.set('sort', f.sort);
  if (f.view === 'list') params.set('view', 'list');
  return params;
}
