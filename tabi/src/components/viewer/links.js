/**
 * Outbound links of a brochure — its sources and the official sites on its
 * Visitor information page — cleaned for rendering: http(s) only (safeUrl),
 * each URL once, with the host shown beside the label ("inari.jp"). Pure, so
 * the About section, the trip planner and the Credits page agree.
 */
import { safeUrl } from '../../data/sanitize.js';

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/** "https://www.inari.jp/en/" → "inari.jp" ('' for anything that is not a web URL). */
export function hostOf(url) {
  const safe = safeUrl(url);
  if (!safe) return '';
  try {
    return new URL(safe).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** Comparable form of a URL: host without www, no scheme, hash or trailing slash. */
function urlKey(url) {
  try {
    const u = new URL(url);
    return `${u.host.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url;
  }
}

/** Keep the first link per URL, dropping unsafe or empty ones. → [{ label, url, host }] */
function uniqueLinks(candidates, max) {
  const seen = new Set();
  const out = [];
  for (const { label, url } of candidates) {
    const safe = safeUrl(url);
    if (!safe) continue;
    const key = urlKey(safe);
    if (seen.has(key)) continue;
    seen.add(key);
    const host = hostOf(safe);
    out.push({ label: str(label) || host, url: safe, host });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * The brochure's `sources` (official sites first, as written), safe and
 * de-duplicated: [{ label, url, host }].
 */
export function sourceLinks(brochure, max = Infinity) {
  const sources = Array.isArray(brochure?.sources) ? brochure.sources : [];
  return uniqueLinks(
    sources.filter((s) => s && typeof s === 'object').map((s) => ({ label: s.label, url: s.url })),
    max,
  );
}

/**
 * Where a traveller should check hours and prices before going: the
 * Visitor information page's call to action and linked details, then each
 * place page's official website, then the brochure's sources — first `max`,
 * each URL once. → [{ label, url, host }]
 */
export function officialLinks(brochure, max = 6) {
  const pages = Array.isArray(brochure?.pages) ? brochure.pages.filter((p) => p && typeof p === 'object') : [];
  const candidates = [];
  for (const page of pages.filter((p) => p.type === 'contact')) {
    if (str(page.ctaUrl)) candidates.push({ label: str(page.cta), url: page.ctaUrl });
    for (const detail of Array.isArray(page.details) ? page.details : []) {
      if (!detail || typeof detail !== 'object' || !str(detail.url)) continue;
      // A value that is only an address ("kyoto.travel") says less than its label.
      const value = str(detail.value);
      const bare = !value || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(value);
      candidates.push({ label: bare ? str(detail.label) || value : value, url: detail.url });
    }
  }
  for (const page of pages.filter((p) => p.type === 'place')) {
    if (str(page.website)) candidates.push({ label: str(page.name) ? `${str(page.name)} — official site` : '', url: page.website });
  }
  for (const source of sourceLinks(brochure)) candidates.push(source);
  return uniqueLinks(candidates, max);
}
