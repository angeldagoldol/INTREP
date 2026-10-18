/**
 * What the command palette can find: brochures, the real places inside them
 * (each place page, opening the brochure at that page), pages (plus
 * filtered library shortcuts and the Credits page) and actions — and how
 * results are grouped. Pure data
 * shaping on top of search.js so it can be unit-tested without React.
 */
import { CATEGORIES, getCategory } from '../../data/categories.js';
import { REGIONS, getRegion } from '../../data/regions.js';
import { SEASONS, SEASON_MAP } from '../../data/seasons.js';
import { brochureKana } from '../../data/kana.js';
import { createSearchIndex, search } from './search.js';

export const PALETTE_GROUPS = {
  recent: { label: 'Recently viewed', jp: '最近見た' },
  suggested: { label: 'Suggested', jp: 'おすすめ' },
  brochures: { label: 'Brochures', jp: 'パンフレット' },
  places: { label: 'Places', jp: '名所' },
  pages: { label: 'Pages', jp: 'ページ' },
  actions: { label: 'Actions', jp: '操作' },
};

const LIMITS = { recent: 4, suggested: 5, brochures: 8, places: 6, pages: 7, actions: 3 };
const SEASON_ICONS = { spring: 'Flower', summer: 'Sun', autumn: 'Leaf', winter: 'Snowflake' };

/** Palette row for a brochure. Missing fields (user drafts) are tolerated. */
export function brochureItem(brochure, group = 'brochures') {
  const region = getRegion(brochure.region);
  const category = getCategory(brochure.category);
  const mine = brochure.source === 'user';
  return {
    id: `${group}:${brochure.id}`,
    kind: 'brochure',
    group,
    title: brochure.title || 'Untitled brochure',
    titleJp: brochure.titleJp || '',
    meta: [mine ? 'Your brochure' : region.label, category.label].filter(Boolean).join(' · '),
    brochure,
    to: `/brochures/${brochure.slug}`,
  };
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Palette rows for the real places in a brochure: one per place page with a
 * name (opening the brochure at that page, ?p=<index>), carrying the page's
 * photo for the thumbnail. Missing or odd fields are skipped.
 */
export function placeItems(brochure) {
  const pages = Array.isArray(brochure?.pages) ? brochure.pages : [];
  const short = text(brochure?.title).split(':')[0] || 'Untitled brochure';
  const items = [];
  pages.forEach((page, index) => {
    if (!page || typeof page !== 'object' || page.type !== 'place' || !text(page.name)) return;
    items.push({
      id: `place:${brochure.id}:${text(page.id) || index}`,
      kind: 'place',
      group: 'places',
      title: text(page.name),
      titleJp: text(page.nameJp),
      meta: `${short} · page ${index + 1}`,
      kicker: text(page.kicker),
      photo: text(page.photo),
      brochure,
      to: `/brochures/${brochure.slug}${index > 0 ? `?p=${index}` : ''}`,
    });
  });
  return items;
}

function placeFields(item) {
  const b = item.brochure;
  return [
    { key: 'title', text: item.title },
    { key: 'titleJp', text: item.titleJp },
    { key: 'kicker', text: item.kicker, weight: 0.5, fuzzy: false },
    { key: 'brochure', text: `${b.title ?? ''} ${b.titleJp ?? ''}`, weight: 0.4, fuzzy: false },
  ];
}

function brochureFields(item) {
  const b = item.brochure;
  const region = getRegion(b.region);
  const category = getCategory(b.category);
  const seasons = (Array.isArray(b.seasons) ? b.seasons : [])
    .map((id) => SEASON_MAP[id])
    .filter(Boolean)
    .map((s) => `${s.label} ${s.jp} ${s.romaji}`);
  return [
    { key: 'title', text: item.title },
    { key: 'titleJp', text: item.titleJp },
    // Hidden field: hiragana readings (きょうと finds 京都); never highlighted.
    { key: 'kana', text: brochureKana(b), weight: 0.9, fuzzy: false },
    { key: 'tags', text: (Array.isArray(b.tags) ? b.tags : []).join(' · '), weight: 0.75 },
    { key: 'region', text: `${region.label} ${region.jp}`, weight: 0.75 },
    // The main place (often a sight's own name) and its prefecture.
    { key: 'location', text: [b.location?.name, b.location?.nameJp, b.location?.prefecture].filter((t) => typeof t === 'string').join(' '), weight: 0.7, fuzzy: false },
    { key: 'category', text: `${category.label} ${category.jp}`, weight: 0.65 },
    { key: 'seasons', text: seasons.join(' '), weight: 0.55, fuzzy: false },
    { key: 'subtitle', text: b.subtitle, weight: 0.45, fuzzy: false },
    { key: 'organization', text: b.organization, weight: 0.4, fuzzy: false },
    { key: 'summary', text: b.summary, weight: 0.35, fuzzy: false },
  ];
}

/** Static destinations: main pages, then filtered library shortcuts. */
export function pageItems() {
  const page = (id, fields) => ({ id: `page:${id}`, kind: 'page', group: 'pages', ...fields });
  return [
    page('home', { title: 'Home', titleJp: 'ホーム', meta: 'Start here', icon: 'House', to: '/', keywords: 'start front landing', pinned: true }),
    page('library', {
      title: 'Brochure library',
      titleJp: 'パンフレット一覧',
      meta: 'Every brochure, filterable',
      icon: 'LayoutGrid',
      to: '/brochures',
      keywords: 'brochures browse all catalogue collection',
      pinned: true,
    }),
    page('studio', {
      title: 'Studio',
      titleJp: 'スタジオ',
      meta: 'Design your own brochure',
      icon: 'PenLine',
      to: '/studio',
      keywords: 'editor create design make build',
      pinned: true,
    }),
    page('credits', {
      title: 'Credits & sources',
      titleJp: '奥付',
      meta: 'Photo credits, fact checks and fonts',
      icon: 'Camera',
      to: '/credits',
      keywords: 'credits photographs photos photographers licence license attribution wikimedia commons sources facts fact check research fonts typefaces colophon okuzuke about',
    }),
    page('favorites', {
      title: 'Your favourites',
      titleJp: 'お気に入り',
      meta: 'Library · Saved brochures',
      icon: 'Heart',
      to: '/brochures?fav=1',
      keywords: 'favorites saved liked hearts bookmarks',
    }),
    ...CATEGORIES.map((c) =>
      page(`category-${c.id}`, {
        title: c.label,
        titleJp: c.jp,
        meta: 'Library · Category',
        icon: c.icon,
        to: `/brochures?category=${c.id}`,
        keywords: `category ${c.kana ?? ''}`,
      }),
    ),
    ...SEASONS.map((s) =>
      page(`season-${s.id}`, {
        title: `${s.label} brochures`,
        titleJp: s.jp,
        meta: `Library · Season · ${s.months}`,
        icon: SEASON_ICONS[s.id] ?? 'Sparkles',
        to: `/brochures?season=${s.id}`,
        keywords: `${s.romaji} ${s.kana ?? ''} ${s.motif} season`,
      }),
    ),
    ...REGIONS.map((r) =>
      page(`region-${r.id}`, {
        title: r.label,
        titleJp: r.jp,
        meta: 'Library · Region',
        icon: 'MapPin',
        to: `/brochures?region=${r.id}`,
        keywords: `region ${r.kana ?? ''} ${r.blurb}`,
      }),
    ),
  ];
}

/**
 * Commands. The theme row describes what it will switch TO; once the visitor
 * has picked light or dark, a second row offers going back to the system
 * setting (`preference` 'system' hides it).
 */
export function actionItems(theme = 'light', preference = 'system') {
  const dark = theme === 'dark';
  const action = (id, fields) => ({ id: `action:${id}`, kind: 'action', group: 'actions', ...fields });
  return [
    action('theme', {
      title: dark ? 'Switch to light mode' : 'Switch to dark mode',
      titleJp: dark ? 'ライトモード' : 'ダークモード',
      meta: dark ? 'Washi paper' : 'Sumi ink',
      icon: dark ? 'Sun' : 'Moon',
      action: 'toggle-theme',
      keywords: 'theme toggle switch change dark light mode appearance colour color paper ink night day',
    }),
    preference !== 'system' &&
      action('theme-system', {
        title: 'Match system appearance',
        titleJp: '自動',
        meta: 'Follow your device’s light or dark setting',
        icon: 'Smartphone',
        action: 'theme-system',
        keywords: 'theme system auto automatic os device default appearance reset follow dark light mode',
      }),
    action('create', {
      title: 'Create a new brochure',
      titleJp: '新しいパンフレット',
      meta: 'Opens the Studio',
      icon: 'Plus',
      to: '/studio',
      keywords: 'new make design studio add build',
    }),
    action('random', {
      title: 'Browse a random brochure',
      titleJp: 'おまかせ',
      meta: 'Omakase — leave it to us',
      icon: 'Compass',
      action: 'random-brochure',
      keywords: 'random surprise shuffle lucky omakase',
    }),
  ].filter(Boolean);
}

function staticFields(item) {
  return [
    { key: 'title', text: item.title },
    { key: 'titleJp', text: item.titleJp },
    { key: 'keywords', text: item.keywords, weight: 0.6, fuzzy: false },
    { key: 'meta', text: item.meta, weight: 0.3, fuzzy: false },
  ];
}

/** Build the searchable universe once per brochure list / theme. */
export function createPaletteIndex({ brochures = [], theme = 'light', preference = 'system' } = {}) {
  const listed = brochures.filter((b) => b && b.slug);
  const brochureRows = listed.map((b) => brochureItem(b));
  const items = [...brochureRows, ...listed.flatMap(placeItems), ...pageItems(), ...actionItems(theme, preference)];
  const fieldsOf = (item) => (item.kind === 'brochure' ? brochureFields(item) : item.kind === 'place' ? placeFields(item) : staticFields(item));
  const index = createSearchIndex(items, fieldsOf);
  const byId = new Map(brochureRows.map((row) => [row.brochure.id, row.brochure]));
  return { index, byId };
}

function grouped(buckets) {
  const groups = [];
  let flatIndex = 0;
  for (const [id, items] of buckets) {
    if (!items.length) continue;
    groups.push({ id, ...PALETTE_GROUPS[id], items: items.map((item) => ({ ...item, index: flatIndex++ })) });
  }
  return { groups, flat: groups.flatMap((g) => g.items) };
}

/**
 * Results for `query`, grouped. Empty query: recently viewed, suggested
 * (featured first), main pages and actions. Otherwise ranked matches per
 * group, groups ordered by their best match. Returns { groups: [{ id, label, jp, items }], flat } where every
 * item carries `matches` (highlight ranges) and a running `index`.
 */
export function queryPalette({ index, byId }, query = '', recentIds = []) {
  if (!query.trim()) {
    const recent = recentIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, LIMITS.recent)
      .map((b) => ({ ...brochureItem(b, 'recent'), matches: {} }));
    const seen = new Set(recent.map((r) => r.brochure.id));
    const all = index.map((entry) => ({ ...entry.item, matches: {} }));
    const suggested = all
      .filter((item) => item.kind === 'brochure' && !seen.has(item.brochure.id))
      .sort((a, b) => Number(!!b.brochure.featured) - Number(!!a.brochure.featured))
      .slice(0, LIMITS.suggested)
      .map((item) => ({ ...item, id: `suggested:${item.brochure.id}`, group: 'suggested' }));
    return grouped([
      ['recent', recent],
      ['suggested', suggested],
      ['pages', all.filter((item) => item.pinned)],
      ['actions', all.filter((item) => item.kind === 'action')],
    ]);
  }

  // Results arrive best-first, so groups are created in order of their best
  // match: an exact page hit outranks a brochure that merely mentions it.
  const buckets = new Map();
  for (const { item, matches } of search(index, query)) {
    if (!buckets.has(item.group)) buckets.set(item.group, []);
    const bucket = buckets.get(item.group);
    if (bucket.length < LIMITS[item.group]) bucket.push({ ...item, matches });
  }
  return grouped([...buckets]);
}
