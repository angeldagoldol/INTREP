/**
 * Pure helpers for the photo pipeline (fetch.mjs, candidates.mjs,
 * import-local.mjs): Commons titles and API responses, licence policy,
 * credits, output planning. No I/O here — everything is unit-tested in
 * lib.test.mjs with realistic Commons API fixtures.
 */

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_WIKI = 'https://commons.wikimedia.org/wiki/';
/** Output widths written to public/photos/<id>-<w>.webp (never upscaled). */
export const OUTPUT_WIDTHS = [480, 960, 1600];
/** A photo must be at least this many pixels on its long edge. */
export const MIN_LONG_EDGE = 1600;
/** Commons titles per API request (the API's limit for normal clients). */
export const BATCH_SIZE = 50;
/** Image types we can turn into photographs (no SVG/GIF diagrams, no video). */
export const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff']);
/**
 * Thumbnail widths upload.wikimedia.org serves to tools ("thumbnail steps",
 * https://www.mediawiki.org/wiki/Common_thumbnail_sizes). Other widths are
 * rendered on demand and may be refused (HTTP 429) for non-browser clients.
 */
export const THUMB_STEPS = [120, 250, 330, 500, 960, 1280, 1920, 3840];
/** The thumbnail we download per photo: the smallest step that covers the largest output (1600). */
export const DOWNLOAD_WIDTH = 1920;
const EXT_FIELDS = [
  'Artist',
  'Attribution',
  'Credit',
  'LicenseShortName',
  'LicenseUrl',
  'License',
  'UsageTerms',
  'AttributionRequired',
  'Copyrighted',
  'Restrictions',
  'NonFree',
  'ObjectName',
];

/** The smallest standard thumbnail step at least `width` wide (the largest step for anything bigger). */
export function thumbStep(width) {
  const w = Number(width) || DOWNLOAD_WIDTH;
  return THUMB_STEPS.find((step) => step >= w) ?? THUMB_STEPS.at(-1);
}

/* ------------------------------------------------------------------ titles */

/**
 * "File:Foo bar.jpg" for anything that names a Commons file: a title with or
 * without the namespace ("Image:" too), underscores, percent-encoding, a
 * commons/wikipedia file-page URL (desktop or mobile, /wiki/ or index.php?title=),
 * or an upload.wikimedia.org original or thumbnail URL. MediaWiki capitalises
 * the first letter. Returns null when nothing usable is left.
 */
export function normalizeFileTitle(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s) || s.startsWith('//')) {
    let url;
    try {
      url = new URL(s.startsWith('//') ? `https:${s}` : s);
    } catch {
      return null;
    }
    if (/(^|\.)upload\.wikimedia\.org$/i.test(url.hostname)) {
      // /wikipedia/commons/a/ab/Name.jpg or /wikipedia/commons/thumb/a/ab/Name.jpg/1280px-Name.jpg
      const parts = url.pathname.split('/').filter(Boolean);
      const thumb = parts.indexOf('thumb');
      const name = thumb >= 0 ? parts[thumb + 3] : parts.at(-1);
      if (!name) return null;
      s = safeDecode(name);
    } else if (/(^|\.)(wikimedia|wikipedia)\.org$/i.test(url.hostname)) {
      const title = url.searchParams.get('title') ?? (url.pathname.startsWith('/wiki/') ? safeDecode(url.pathname.slice('/wiki/'.length)) : null);
      if (!title) return null;
      s = title;
    } else {
      return null;
    }
  } else {
    s = safeDecode(s);
  }

  s = s.split('#')[0].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(file|image|datei|fichier|ファイル)\s*:\s*/i, '');
  if (!s || /[<>[\]{}|]/.test(s) || !/\.[a-z0-9]{2,5}$/i.test(s)) return null;
  return `File:${s[0].toUpperCase()}${s.slice(1)}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** File page on Commons: https://commons.wikimedia.org/wiki/File:Foo_bar.jpg */
export function commonsPageUrl(title) {
  const normal = normalizeFileTitle(title);
  if (!normal) return null;
  return COMMONS_WIKI + encodeURIComponent(normal.replace(/ /g, '_')).replace(/%3A/gi, ':').replace(/%2C/gi, ',').replace(/%28/gi, '(').replace(/%29/gi, ')');
}

/** Titles to try for a manifest photo: its chosen `file`, else its `candidates`, normalised and deduped. */
export function candidateTitles(photo) {
  const raw = photo && typeof photo.file === 'string' && photo.file.trim() ? [photo.file] : Array.isArray(photo?.candidates) ? photo.candidates : [];
  return [...new Set(raw.map(normalizeFileTitle).filter(Boolean))];
}

/** Split a list into batches of `size`. */
export function chunk(list, size = BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * imageinfo query URL for up to 50 titles (the API also returns at most 50
 * scaled thumbnails per request), with a thumbnail `thumbWidth` wide, snapped
 * to a standard step. `cont` is the previous response's `continue` object.
 */
export function imageInfoUrl(titles, { thumbWidth = DOWNLOAD_WIDTH, maxlag = 5, cont } = {}) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(thumbStep(thumbWidth)),
    iiextmetadatafilter: EXT_FIELDS.join('|'),
    iiextmetadatalanguage: 'en',
    redirects: '1',
    maxlag: String(maxlag),
    titles: titles.join('|'),
  });
  if (cont && typeof cont === 'object') for (const [key, value] of Object.entries(cont)) params.set(key, String(value));
  return `${COMMONS_API}?${params}`;
}

/**
 * One response from several continuation rounds of the same query: the API
 * sends every page again in each round, with `imageinfo` only for the files
 * that round covers. Pages are merged by title; normalisation and redirect
 * steps are kept once.
 */
export function mergeQueryResponses(responses) {
  const steps = (key) => {
    const seen = new Map();
    for (const json of responses) for (const step of json?.query?.[key] ?? []) if (step && !seen.has(step.from)) seen.set(step.from, step);
    return [...seen.values()];
  };
  const pages = new Map();
  for (const json of responses) {
    const list = json?.query?.pages;
    for (const page of Array.isArray(list) ? list : Object.values(list ?? {})) {
      if (!page || typeof page.title !== 'string') continue;
      const known = pages.get(page.title);
      if (!known) pages.set(page.title, { ...page });
      else if (Array.isArray(page.imageinfo) && !Array.isArray(known.imageinfo)) known.imageinfo = page.imageinfo;
    }
  }
  return { query: { normalized: steps('normalized'), redirects: steps('redirects'), pages: [...pages.values()] } };
}

/* --------------------------------------------------------- API responses */

/**
 * imageinfo response → Map(requested title → result). Follows `normalized`
 * and `redirects`, accepts formatversion 1 (pages keyed by id) and 2 (array).
 * Result: { title, missing, invalid, reason?, info? } where info is the first
 * imageinfo entry with `extmetadata` flattened to plain values.
 */
export function parseImageInfoResponse(json, requested = []) {
  const query = json?.query ?? {};
  const forward = new Map();
  for (const step of [...(query.normalized ?? []), ...(query.redirects ?? [])]) forward.set(step.from, step.to);
  const resolve = (title) => {
    let t = title;
    for (let i = 0; i < 5 && forward.has(t); i += 1) t = forward.get(t);
    return t;
  };

  const pages = Array.isArray(query.pages) ? query.pages : Object.values(query.pages ?? {});
  const byTitle = new Map();
  for (const page of pages) {
    if (!page || typeof page.title !== 'string') continue;
    const missing = page.missing !== undefined && page.missing !== false;
    const invalid = page.invalid !== undefined && page.invalid !== false;
    const raw = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
    byTitle.set(page.title, {
      title: page.title,
      missing: missing && !raw,
      invalid,
      reason: invalid
        ? page.invalidreason || 'invalid title'
        : missing && !raw
          ? 'no such file on Commons'
          : !raw
            ? 'Commons sent no file information (try again)'
            : raw.filehidden !== undefined
              ? 'file version hidden on Commons'
              : undefined,
      info: raw && raw.filehidden === undefined ? { ...raw, extmetadata: flattenExtmetadata(raw.extmetadata) } : undefined,
    });
  }

  const out = new Map();
  const titles = requested.length ? requested : [...byTitle.keys()];
  for (const title of titles) {
    const result = byTitle.get(resolve(title)) ?? byTitle.get(title);
    out.set(title, result ?? { title, missing: true, invalid: false, reason: 'not in API response' });
  }
  return out;
}

/** { Artist: { value: '…' } } → { Artist: '…' } */
export function flattenExtmetadata(ext) {
  const out = {};
  if (!ext || typeof ext !== 'object') return out;
  for (const [key, entry] of Object.entries(ext)) {
    const value = entry && typeof entry === 'object' ? entry.value : entry;
    if (value !== undefined && value !== null) out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

/** An API-level error (maxlag, ratelimited…) or null. */
export function apiError(json) {
  const error = json?.error;
  if (!error) return null;
  return { code: String(error.code ?? 'error'), info: String(error.info ?? ''), lag: Number(error.lag) || undefined };
}

/**
 * Milliseconds to wait before retry `attempt` (0-based): the server's
 * Retry-After (seconds) when given, else exponential backoff from 2 s, capped.
 */
export function retryDelay(attempt, retryAfter) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 120) * 1000;
  return Math.min(2000 * 2 ** attempt, 60_000);
}

/* ----------------------------------------------------------------- search */

/**
 * What a Commons search for a slot's `query` asks for: the words, restricted
 * to bitmap files (photographs, not diagrams or SVG maps). Shared by the
 * browser (live photos) and the download, so both find the same pictures.
 */
export function searchText(query) {
  return `${String(query ?? '').trim()} filetype:bitmap`;
}

/**
 * generator=search URL for the download: the first `limit` files Commons
 * finds for `query` (namespace 6, File:), with their imageinfo and a
 * thumbnail `thumbWidth` wide (snapped to a standard step).
 */
export function searchImageInfoUrl(query, { limit = 20, thumbWidth = DOWNLOAD_WIDTH, maxlag = 5, cont } = {}) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: searchText(query),
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(thumbStep(thumbWidth)),
    iiextmetadatafilter: EXT_FIELDS.join('|'),
    iiextmetadatalanguage: 'en',
    maxlag: String(maxlag),
  });
  if (cont && typeof cont === 'object') for (const [key, value] of Object.entries(cont)) params.set(key, String(value));
  return `${COMMONS_API}?${params}`;
}

/**
 * Whether a `continue` object still owes imageinfo for this query. Search
 * continuation alone (`gsroffset`: the next page of results) is not followed.
 */
export function owesImageInfo(cont) {
  return Boolean(cont) && typeof cont === 'object' && !Array.isArray(cont) && Object.keys(cont).some((key) => key !== 'continue' && !key.startsWith('gsr'));
}

/** Search results of a merged generator=search response, with their rank (`index`), best first. */
export function searchResults(merged, parsed) {
  const pages = Array.isArray(merged?.query?.pages) ? merged.query.pages : [];
  return pages
    .filter((page) => page && typeof page.title === 'string' && parsed.has(page.title))
    .map((page) => ({ ...parsed.get(page.title), index: Number(page.index) || 0 }))
    .sort((a, b) => a.index - b.index);
}

/**
 * How well a picture's shape suits a slot: 2 = right shape, 1 = acceptable,
 * 0 = wrong. `cover`/`full` pages are portrait (or near-square) frames — a
 * page is 1 : 1.414 — `wide`/`spread` landscape ones (1.4–2.4 : 1; a spread
 * is 1.414 : 1, so a long panorama strip would lose most of its width to the
 * crop, and a sliver-thin portrait most of its height); `any` takes anything.
 */
export function orientationFit(use, width, height) {
  if (!(width > 0 && height > 0)) return 0;
  const ratio = width / height;
  if (use === 'cover' || use === 'full') return ratio >= 0.5 && ratio <= 1.1 ? 2 : ratio >= 0.4 && ratio <= 1.35 ? 1 : 0;
  if (use === 'wide' || use === 'spread') return ratio >= 1.4 && ratio <= 2.4 ? 2 : ratio >= 1.2 && ratio <= 3.2 ? 1 : 0;
  return 2;
}

/**
 * Search results for a slot, best first: only those `evaluate` accepts (the
 * licence and size policy; evaluateCandidate by default, the browser passes
 * its stricter evaluateLive) and whose file is not in `exclude` (a Set of
 * "File:…" titles another slot already shows), ordered by the fit of their
 * shape for the slot's `use`, then size, then the search's own ranking.
 * `results` are parsed imageinfo results with `index` (searchResults()).
 *   → [{ result, verdict, file, fit, area, index }]
 */
export function rankSearchResults(results, use, { evaluate = evaluateCandidate, exclude } = {}) {
  const ranked = [];
  for (const result of Array.isArray(results) ? results : []) {
    const verdict = evaluate(result);
    if (!verdict?.ok) continue;
    const file = normalizeFileTitle(verdict.title) ?? verdict.title;
    if (exclude?.has(file)) continue;
    const width = Number(result.info?.width) || 0;
    const height = Number(result.info?.height) || 0;
    ranked.push({ result, verdict, file, fit: orientationFit(use, width, height), area: width * height, index: Number(result.index) || 0 });
  }
  return ranked.sort((a, b) => b.fit - a.fit || b.area - a.area || a.index - b.index);
}

/* --------------------------------------------------------------- licences */

/**
 * Licence policy: CC0, public domain (PD-*), CC BY and CC BY-SA (any version or
 * port) are accepted; NonCommercial/NoDerivatives, fair use and anything
 * unrecognised are rejected. Returns { ok, kind, label, reason? }.
 */
export function classifyLicense(shortName, ext = {}) {
  const label = htmlToText(shortName ?? ext.LicenseShortName ?? '').trim();
  const code = String(ext.License ?? '')
    .trim()
    .toLowerCase();
  const text = `${label} ${code} ${htmlToText(ext.UsageTerms ?? '')}`.toLowerCase();

  if (String(ext.NonFree ?? '').toLowerCase() === 'true') return { ok: false, kind: 'nonfree', label, reason: 'marked non-free on Commons' };
  if (/fair use|non-?free|all rights reserved/.test(text)) return { ok: false, kind: 'nonfree', label, reason: `not a free licence (${label || code})` };
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv/.test(text) || /-nc|-nd/.test(code)) {
    return { ok: false, kind: 'restricted', label, reason: `NonCommercial/NoDerivatives licence (${label || code})` };
  }
  if (/^cc0\b|cc-zero|^cc0$|publicdomain\/zero/.test(label.toLowerCase()) || code === 'cc0' || code.startsWith('cc-zero')) {
    return { ok: true, kind: 'cc0', label: label || 'CC0', url: licenseUrlFor('cc0') };
  }
  if (/^(public domain|pd\b|pd-)/i.test(label) || code === 'pd' || code.startsWith('pd-')) return { ok: true, kind: 'pd', label: label || 'Public domain' };
  const cc = /^cc[ -]by(?:[ -](sa))?(?:[ -](\d(?:\.\d)?))?(?:[ -]([a-z]{2,3}))?$/i.exec(label) ?? /^cc-by(?:-(sa))?(?:-(\d(?:\.\d)?))?(?:-([a-z]{2,3}))?$/i.exec(code);
  if (cc) {
    const kind = cc[1] ? 'cc-by-sa' : 'cc-by';
    const version = cc[2] ? (cc[2].includes('.') ? cc[2] : `${cc[2]}.0`) : '';
    return { ok: true, kind, label: label || code.toUpperCase(), version, port: (cc[3] ?? '').toLowerCase(), url: licenseUrlFor(kind, version, cc[3]) };
  }
  return { ok: false, kind: 'unknown', label, reason: label || code ? `unrecognised licence "${label || code}"` : 'no licence information' };
}

/**
 * The Creative Commons deed for a licence kind and version (with its port,
 * e.g. "jp", "igo"): https://creativecommons.org/licenses/by-sa/4.0/.
 * '' when there is none (public domain) or the version is unknown.
 */
export function licenseUrlFor(kind, version = '', port = '') {
  if (kind === 'cc0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if ((kind !== 'cc-by' && kind !== 'cc-by-sa') || !/^\d\.\d$/.test(version)) return '';
  const jurisdiction = /^[a-z]{2,3}$/i.test(port ?? '') ? `${port.toLowerCase()}/` : '';
  return `https://creativecommons.org/licenses/${kind === 'cc-by' ? 'by' : 'by-sa'}/${version}/${jurisdiction}`;
}

/** CC BY and BY-SA always need a credit; CC0/PD only when Commons says so. */
export function attributionRequired(kind, ext = {}) {
  if (kind === 'cc-by' || kind === 'cc-by-sa') return true;
  return String(ext.AttributionRequired ?? '').toLowerCase() === 'true';
}

/* ---------------------------------------------------------------- credits */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©' };

/** Plain text from Commons' HTML credit fields: tags stripped, entities decoded, whitespace collapsed. */
export function htmlToText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/?(div|p|li|ul|ol|td|th|tr|table|dd|dt)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    // eslint-disable-next-line no-control-regex -- control characters never belong in a credit line
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first http(s) link in an HTML fragment, absolute (Commons uses //host/… and /wiki/…); talk pages and red links are skipped. */
export function firstLink(html) {
  if (typeof html !== 'string') return null;
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const href = htmlToText(match[2]);
    let url;
    try {
      url = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://commons.wikimedia.org/');
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    if (/[?&](action=edit|redlink=1)/.test(url.search) || /\/wiki\/User[_ ]talk:/i.test(safeDecode(url.pathname))) continue;
    if (url.protocol === 'http:' && /wiki(media|pedia)\.org$/.test(url.hostname)) url.protocol = 'https:';
    return url.href;
  }
  return null;
}

/** "Credit" on Commons is the *source* ("Own work", "Transferred from flickr"), not a name. */
const SOURCE_ONLY = /^(own work|self[- ]?made|self[- ]?photographed|自作|transferred from|imported from|from |flickr|https?:)/i;

/**
 * Author credit as plain text, cleaned and kept short: the attribution the
 * author asked for (Commons' `Attribution`, from the licence template's
 * attribution= parameter) when there is one, else the Artist field, else a
 * Credit that names someone (not "Own work").
 */
export function authorCredit(ext = {}) {
  const credit = htmlToText(ext.Credit ?? '');
  let text = htmlToText(ext.Attribution ?? '') || htmlToText(ext.Artist ?? '') || (SOURCE_ONLY.test(credit) ? '' : credit);
  text = text
    .replace(/\s*\((talk|トーク|discussion)\)\s*$/i, '')
    .replace(/^(photo(graph)?|by|author|attribution)\s*[:：]\s*/i, '')
    .replace(/^photo(graph)?\s+by\s+/i, '')
    .trim();
  if (!text || /^unknown( author)?$/i.test(text)) return 'Unknown author';
  const chars = Array.from(text);
  return chars.length > 120 ? `${chars.slice(0, 117).join('').trimEnd()}…` : text;
}

/** The work's title for the credit: Commons' ObjectName, else the file name without its extension. */
export function workTitle(ext = {}, title = '') {
  const name = htmlToText(ext.ObjectName ?? '') || String(title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]{2,5}$/i, '');
  const chars = Array.from(name.trim());
  return chars.length > 160 ? `${chars.slice(0, 157).join('').trimEnd()}…` : chars.join('');
}

/** An absolute http(s) URL, or '' — the only kind of link a credit may carry. */
export function httpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim().startsWith('//') ? `https:${value.trim()}` : value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/** https for Creative Commons licence links; nothing for other schemes. */
export function cleanLicenseUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const u = new URL(url.trim().startsWith('//') ? `https:${url.trim()}` : url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (/creativecommons\.org$/.test(u.hostname)) u.protocol = 'https:';
    return u.href;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------- evaluation */

/**
 * Can this Commons file be used? Checks it exists, is a photo type, is large
 * enough (long edge ≥ minLongEdge) and has an accepted licence.
 * Returns { ok, reason?, title, license, credit } — credit holds the record fields.
 */
export function evaluateCandidate(result, { minLongEdge = MIN_LONG_EDGE } = {}) {
  const title = result?.title ?? '';
  if (!result || result.invalid) return { ok: false, title, reason: result?.reason ?? 'invalid title' };
  if (result.missing || !result.info) return { ok: false, title, reason: result.reason ?? 'no such file on Commons' };
  const { info } = result;
  const ext = info.extmetadata ?? {};
  if (!PHOTO_MIMES.has(info.mime)) return { ok: false, title, reason: `not a photo (${info.mime ?? 'unknown type'})` };
  const longEdge = Math.max(Number(info.width) || 0, Number(info.height) || 0);
  if (longEdge < minLongEdge) return { ok: false, title, reason: `too small (${info.width}×${info.height}, need ${minLongEdge}px on the long edge)` };
  const license = classifyLicense(ext.LicenseShortName, ext);
  if (!license.ok) return { ok: false, title, reason: license.reason, license };
  // CC BY / BY-SA credits must link the licence: Commons' LicenseUrl, else the deed for its version.
  const licenseUrl = cleanLicenseUrl(ext.LicenseUrl) || license.url || '';
  if ((license.kind === 'cc-by' || license.kind === 'cc-by-sa') && !licenseUrl) {
    return { ok: false, title, reason: `no licence link for "${license.label}" (version unknown)`, license };
  }
  return {
    ok: true,
    title,
    license,
    credit: {
      title: workTitle(ext, title),
      author: authorCredit(ext),
      authorUrl: firstLink(ext.Artist ?? '') ?? '',
      license: license.label,
      licenseUrl,
      sourceUrl: httpUrl(info.descriptionurl) || commonsPageUrl(title) || '',
      attributionRequired: attributionRequired(license.kind, ext),
      restrictions: htmlToText(ext.Restrictions ?? ''),
    },
  };
}

/* ---------------------------------------------------------------- outputs */

/** Output widths for a source this wide: the targets that fit, plus the source width when it falls short of the largest. */
export function planWidths(sourceWidth, targets = OUTPUT_WIDTHS) {
  const width = Math.floor(Number(sourceWidth) || 0);
  if (width <= 0) return [];
  const fit = targets.filter((t) => t <= width);
  if (fit.length < targets.length && width > (fit.at(-1) ?? 0) * 1.1) fit.push(width);
  return fit.length ? fit : [width];
}

/** public/photos/<id>-<w>.webp */
export function outputName(id, width) {
  return `${id}-${width}.webp`;
}

/** True for file names this id owns ("kyoto-gate-960.webp"), not a longer id's ("kyoto-gate-2-960.webp"). */
export function ownsOutput(id, fileName) {
  const match = /^(.*)-(\d+)\.webp$/.exec(fileName);
  return Boolean(match) && match[1] === id;
}

/** Height of a `width`-wide resize that keeps the aspect ratio. */
export function scaledHeight(width, sourceWidth, sourceHeight) {
  return Math.round((width * sourceHeight) / sourceWidth);
}

/** '#rrggbb' from { r, g, b } (sharp's stats().dominant). */
export function toHex({ r, g, b } = {}) {
  const part = (v) =>
    Math.max(0, Math.min(255, Math.round(Number(v) || 0)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * The record written to photos.generated.json for one photo. A photo found by
 * searching Commons (not one of the slot's researched candidates) also keeps
 * `via: 'search'` and the `query` that found it.
 */
export function buildRecord({ id, file, width, height, widths, lqip, color, credit, fetchedAt, via, query }) {
  return {
    id,
    file: file ?? null,
    width,
    height,
    widths,
    lqip,
    color,
    title: credit.title ?? '',
    author: credit.author,
    authorUrl: credit.authorUrl ?? '',
    license: credit.license,
    licenseUrl: credit.licenseUrl ?? '',
    sourceUrl: credit.sourceUrl ?? '',
    attributionRequired: Boolean(credit.attributionRequired),
    ...(via === 'search' ? { via: 'search', query: String(query ?? '') } : {}),
    fetchedAt,
  };
}

/** Records sorted by id, so the generated JSON diffs cleanly. */
export function sortRecords(records) {
  return Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
}

/* -------------------------------------------------------------- manifests */

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Photos of one manifest, checked: [{ id, file, candidates, … }] plus
 * problems ["kyoto.json: photo 2 has no id", …]. Bad entries are skipped.
 */
export function readManifest(json, name = 'manifest') {
  const problems = [];
  const photos = [];
  if (!json || typeof json !== 'object' || !Array.isArray(json.photos)) return { brochure: null, photos, problems: [`${name}: no "photos" array`] };
  json.photos.forEach((photo, i) => {
    if (!photo || typeof photo !== 'object') return problems.push(`${name}: photo ${i + 1} is not an object`);
    if (typeof photo.id !== 'string' || !ID.test(photo.id)) return problems.push(`${name}: photo ${i + 1} needs a kebab-case "id"`);
    if (candidateTitles(photo).length === 0 && !(typeof photo.query === 'string' && photo.query.trim())) {
      problems.push(`${name}: ${photo.id} has no usable "file", "candidates" or "query"`);
    }
    photos.push(photo);
  });
  return { brochure: typeof json.brochure === 'string' ? json.brochure : null, photos, problems };
}

/** --only matches a manifest (file name or brochure slug) or a photo id. */
export function matchesOnly(only, { manifest, brochure, id }) {
  if (!only || only.length === 0) return true;
  return only.some((o) => o === id || o === manifest || o === `${manifest}.json` || (brochure && o === brochure));
}

/** Minimal flag parser: --flag, --key value, --key=value; the rest are positionals. */
export function parseArgs(argv, { boolean = [], string = [] } = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    const name = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (boolean.includes(key)) out[name] = true;
    else if (string.includes(key)) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`--${key} needs a value`);
      out[name] = out[name] === undefined ? value : [].concat(out[name], value);
    } else throw new Error(`Unknown option --${key}`);
  }
  return out;
}

/** Grid for a contact sheet of n tiles: { cols, rows, width, height, cells: [{ x, y }] }. */
export function contactSheetLayout(n, { tile = 360, label = 64, gap = 16, maxCols = 3 } = {}) {
  const count = Math.max(0, Math.floor(n));
  const cols = Math.max(1, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellH = tile + label;
  const cells = Array.from({ length: count }, (_, i) => ({ x: gap + (i % cols) * (tile + gap), y: gap + Math.floor(i / cols) * (cellH + gap) }));
  return { cols, rows, width: gap + cols * (tile + gap), height: gap + rows * (cellH + gap), cells };
}

/** Escape text for an SVG/XML text node or attribute. */
export function xmlEscape(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}
