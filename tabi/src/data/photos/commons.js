/**
 * Wikimedia Commons, read from the visitor's browser (live photos, live.js):
 * the API URLs (anonymous CORS, `origin=*`), the photo policy and the image
 * URLs a live photo may use. Pure — no fetch, no storage; tested with Commons
 * API fixtures in fixtures/.
 *
 * The policy is the bundling pipeline's (scripts/photos/lib.mjs, shared, so
 * `npm run photos:fetch` and the browser accept the same files): the file
 * exists, is a free licence (CC0, public domain, CC BY, CC BY-SA — never NC/ND
 * or no licence) and is at least 1600 px on its long edge. Live photos must
 * also be a web image (JPEG, PNG or WebP), and only ever point at
 * upload.wikimedia.org thumbnails on Wikimedia's standard steps.
 */
import { MIN_LONG_EDGE, evaluateCandidate, normalizeFileTitle, rankSearchResults, searchText } from '../../../scripts/photos/lib.mjs';

export {
  BATCH_SIZE,
  apiError,
  chunk,
  mergeQueryResponses,
  normalizeFileTitle,
  orientationFit,
  owesImageInfo,
  parseImageInfoResponse,
  searchResults,
} from '../../../scripts/photos/lib.mjs';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/** iiurlwidth: the thumbnail the API describes (its URL is the template for the other steps). */
export const API_THUMB_WIDTH = 1280;
/** Thumbnail widths a live photo uses: Wikimedia's standard steps (other widths are rendered on demand, or refused). */
export const LIVE_STEPS = [500, 960, 1280, 1920];
/** What a browser can draw. TIFF (thumbnailed as JPEG under another name) and SVG/GIF are left out. */
export const LIVE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Search results considered for a slot without a usable candidate. */
export const SEARCH_LIMIT = 10;

// Only the metadata a credit needs (keeps a 50-file response small).
const EXT_FIELDS = ['Artist', 'Attribution', 'Credit', 'LicenseShortName', 'LicenseUrl', 'License', 'UsageTerms', 'AttributionRequired', 'NonFree', 'ObjectName'];
const UPLOAD = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/[^?#\s"'\\<>]+$/;
const THUMB_NAME = /\/(\d+)px-([^/]+)$/;
// Wikimedia shortens thumbnail names of files whose name is longer than this (bytes) to "thumbnail.<ext>".
const LONG_NAME_BYTES = 160;

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positiveInt = (value) => (Number.isFinite(value) && value > 0 ? Math.round(value) : 0);

/* ------------------------------------------------------------------ URLs */

function baseParams() {
  return {
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(API_THUMB_WIDTH),
    iiextmetadatafilter: EXT_FIELDS.join('|'),
    iiextmetadatalanguage: 'en',
  };
}

function withContinue(params, cont) {
  if (isRecord(cont)) for (const [key, value] of Object.entries(cont)) params.set(key, String(value));
  return `${COMMONS_API}?${params}`;
}

/** imageinfo for up to 50 file titles ("File:A.jpg"), following `cont` (a previous response's `continue`). */
export function imageInfoUrl(titles, cont) {
  return withContinue(new URLSearchParams({ ...baseParams(), redirects: '1', titles: titles.join('|') }), cont);
}

/** The first `limit` bitmap files Commons' search finds for `query`, with their imageinfo. */
export function searchUrl(query, { limit = SEARCH_LIMIT, cont } = {}) {
  return withContinue(
    new URLSearchParams({ ...baseParams(), generator: 'search', gsrnamespace: '6', gsrsearch: searchText(query), gsrlimit: String(limit) }),
    cont,
  );
}

/* --------------------------------------------------------------- policy */

/** A Commons upload URL (https, upload.wikimedia.org/wikipedia/commons/…), or ''. */
export function uploadUrl(value) {
  const url = str(value).replace(/^\/\//, 'https://').replace(/^http:\/\//i, 'https://');
  return UPLOAD.test(url) ? url : '';
}

/**
 * One parsed imageinfo result (parseImageInfoResponse) checked for live use:
 * { ok: true, record } or { ok: false, title, reason }. `record` is what the
 * cache stores: { file, width, height, mime, url, thumb, thumbWidth, credit,
 * attributionRequired, via }; credits are plain text (HTML stripped), links http(s).
 */
export function evaluateLive(result, via = 'candidate') {
  const verdict = evaluateCandidate(result, { minLongEdge: MIN_LONG_EDGE });
  if (!verdict.ok) return verdict;
  const info = result.info;
  const title = normalizeFileTitle(verdict.title) ?? verdict.title;
  if (!LIVE_MIMES.has(info.mime)) return { ok: false, title, reason: `not a web image (${info.mime})` };
  const url = uploadUrl(info.url);
  if (!url) return { ok: false, title, reason: 'no upload.wikimedia.org URL' };
  const { title: workTitle, author, authorUrl, license, licenseUrl, sourceUrl, attributionRequired } = verdict.credit;
  return {
    ok: true,
    title,
    record: {
      file: title,
      width: positiveInt(Number(info.width)),
      height: positiveInt(Number(info.height)),
      mime: info.mime,
      url,
      thumb: uploadUrl(info.thumburl),
      thumbWidth: positiveInt(Number(info.thumbwidth)),
      credit: { title: workTitle, author, authorUrl, license, licenseUrl, sourceUrl },
      attributionRequired,
      via: via === 'search' ? 'search' : 'candidate',
    },
  };
}

/**
 * A record read back from the cache (localStorage), re-checked field by field:
 * the same shape evaluateLive() writes, or null. Storage is not trusted with
 * URLs: images must be Commons uploads, credit links http(s).
 */
export function sanitizeLiveRecord(value) {
  if (!isRecord(value)) return null;
  const file = normalizeFileTitle(value.file);
  const width = positiveInt(value.width);
  const height = positiveInt(value.height);
  const url = uploadUrl(value.url);
  if (!file || !width || !height || !url || !LIVE_MIMES.has(value.mime)) return null;
  const credit = isRecord(value.credit) ? value.credit : {};
  const link = (href) => (/^https?:\/\/[^\s"'<>]+$/i.test(str(href)) ? str(href) : '');
  return {
    file,
    width,
    height,
    mime: value.mime,
    url,
    thumb: uploadUrl(value.thumb),
    thumbWidth: positiveInt(value.thumbWidth),
    credit: {
      title: str(credit.title).slice(0, 200),
      author: str(credit.author).slice(0, 200) || 'Unknown author',
      authorUrl: link(credit.authorUrl),
      license: str(credit.license).slice(0, 60),
      licenseUrl: link(credit.licenseUrl),
      sourceUrl: link(credit.sourceUrl),
    },
    attributionRequired: value.attributionRequired !== false,
    via: value.via === 'search' ? 'search' : 'candidate',
  };
}

/* -------------------------------------------------------------- images */

function utf8Length(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * The thumbnail URL for a step: from the API's thumbnail (its "/<n>px-" segment
 * swapped), or — when the original is no wider than iiurlwidth, so the API
 * answered with the original itself — built the way Wikimedia names
 * thumbnails (JPEG and PNG only). Null when there is no safe template.
 */
function thumbTemplate(record) {
  const thumb = uploadUrl(record.thumb);
  if (thumb.includes('/commons/thumb/') && THUMB_NAME.test(thumb)) return (w) => thumb.replace(THUMB_NAME, `/${w}px-$2`);
  if (record.mime !== 'image/jpeg' && record.mime !== 'image/png') return null;
  const match = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/.exec(uploadUrl(record.url));
  if (!match) return null;
  const [, a, ab, encoded] = match;
  let name = encoded;
  try {
    // MediaWiki lower-cases the extension of the shortened name (FileRepo::nameForThumb).
    if (utf8Length(decodeURIComponent(encoded)) > LONG_NAME_BYTES) name = `thumbnail.${encoded.split('.').pop().toLowerCase()}`;
  } catch {
    return null;
  }
  return (w) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${encoded}/${w}px-${name}`;
}

/**
 * The sources a live photo is drawn from: Wikimedia's standard thumbnail
 * steps (500, 960, 1280, 1920) below the original's width — never an upscaled
 * thumbnail — topped by the original itself when it is 1920 px wide or less.
 *   → { widths, urls: { [w]: url }, srcSet: 'url 500w, …', src(w) }
 */
export function liveImageSet(record) {
  const width = positiveInt(record?.width);
  const url = uploadUrl(record?.url);
  const urls = {};
  if (width && url) {
    const template = thumbTemplate(record);
    const top = LIVE_STEPS.at(-1);
    for (const step of LIVE_STEPS) {
      if (!template) break;
      // Steps close to a small original are skipped: the original is the next entry.
      if (width > top ? step <= width : step * 1.1 <= width) urls[step] = template(step);
    }
    if (width <= top) urls[width] = url;
  }
  const widths = Object.keys(urls)
    .map(Number)
    .sort((x, y) => x - y);
  return {
    widths,
    urls,
    srcSet: widths.map((w) => `${urls[w]} ${w}w`).join(', '),
    src: (w) => {
      if (!widths.length) return null;
      const target = Number(w) || widths.at(-1);
      return urls[widths.find((step) => step >= target) ?? widths.at(-1)];
    },
  };
}

/* -------------------------------------------------------------- search */

/**
 * The best search result for a slot: of the results that pass the live
 * policy (and are not already shown by another slot — `exclude`, a Set of
 * file titles), the best fit for the slot's `use`, then the largest; ties go to
 * the search's own ranking (rankSearchResults in scripts/photos/lib.mjs, which
 * `npm run photos:fetch` uses too). `results` are parsed imageinfo results with
 * `index` (the search rank). Returns a record (evaluateLive) or null.
 */
export function pickSearchResult(results, use, { exclude } = {}) {
  return rankSearchResults(results, use, { evaluate: (result) => evaluateLive(result, 'search'), exclude })[0]?.verdict.record ?? null;
}
