/**
 * Checks for the Studio's real-place fields: coordinates (in range, inside
 * Japan, pasted in any common form) and web links (https only). Pure — the
 * editors turn the results into hints, warnings and one-click fixes.
 */
import { safeUrl } from '../../data/sanitize.js';

/**
 * Where Japan is, as a few lat/lng boxes [west, south, east, north] — tight
 * enough to tell Japan from Korea or Taiwan, loose enough for every island:
 * Hokkaidō to Kyūshū with their islands; the Nansei (Ryūkyū) islands from
 * Yonaguni to Amami and Daitō; and the Pacific islands (Ogasawara,
 * Minamitorishima, Okinotorishima).
 */
export const JAPAN_AREAS = [
  { id: 'main', bounds: [128, 29.9, 146.2, 45.7] },
  { id: 'nansei', bounds: [122.8, 23.9, 131.5, 29.9] },
  { id: 'pacific', bounds: [135.9, 20.3, 154.1, 29.9] },
];

/** Decimal places for stored coordinates (about 11 m): docs/REAL_CONTENT.md. */
export const COORD_DECIMALS = 4;

/** A number from a field value (numbers or numeric strings), else null. */
export function readNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/** Round to COORD_DECIMALS places (−0 becomes 0). */
export function roundCoord(n) {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(n * factor) / factor || 0;
}

/** True when the point lies in one of JAPAN_AREAS. */
export function inJapan(lat, lng) {
  return JAPAN_AREAS.some(({ bounds: [west, south, east, north] }) => lat >= south && lat <= north && lng >= west && lng <= east);
}

/**
 * What to say about a lat/lng pair:
 *   { state: 'empty' | 'partial' | 'invalid' | 'swapped' | 'outside' | 'ok', tone, message, fix? }
 * `tone` is 'info' | 'warning' | 'error' | 'ok'; `fix` (for swapped values) is the
 * corrected { lat, lng }. Coordinates are optional: empty is fine.
 */
export function coordinateCheck(latValue, lngValue) {
  const lat = readNumber(latValue);
  const lng = readNumber(lngValue);
  if (lat === null && lng === null) {
    return { state: 'empty', tone: 'info', message: 'Optional: the coordinates are printed in small type beside the place.' };
  }
  if (lat === null || lng === null) {
    return { state: 'partial', tone: 'warning', message: `Add the ${lat === null ? 'latitude' : 'longitude'} too — coordinates need both.` };
  }
  if (inJapan(lat, lng)) return { state: 'ok', tone: 'ok', message: '' };
  // The usual slip: 135.77 typed as the latitude. Read the other way round, the pair lands in Japan.
  if (inJapan(lng, lat)) {
    return {
      state: 'swapped',
      tone: 'warning',
      message: 'These look swapped: latitude (north–south, about 20–46 in Japan) comes first.',
      fix: { lat: lng, lng: lat },
    };
  }
  if (Math.abs(lat) > 90) return { state: 'invalid', tone: 'error', message: 'Latitude runs from −90 to 90. In Japan it is about 20 to 46.' };
  if (Math.abs(lng) > 180) return { state: 'invalid', tone: 'error', message: 'Longitude runs from −180 to 180. In Japan it is about 122 to 154.' };
  return {
    state: 'outside',
    tone: 'warning',
    message: 'This point is outside Japan, which lies at about 20–46° N, 122–154° E. Check the numbers.',
  };
}

const DECIMAL = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;

/** "35°00'37.2\"N" / "35° 0.62′ N" / "35.0103 N" → signed decimal degrees, or null. */
function readDegrees(part) {
  const text = part.replace(/[−–]/g, '-').trim();
  const hemi = /([NSEW])\s*$/i.exec(text)?.[1]?.toUpperCase() ?? /^\s*([NSEW])/i.exec(text)?.[1]?.toUpperCase();
  const nums = text.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!nums.length || nums.length > 3) return null;
  const [d, m = 0, s = 0] = nums;
  if (m >= 60 || s >= 60) return null;
  let value = d + m / 60 + s / 3600;
  if (/^\s*-/.test(text) || hemi === 'S' || hemi === 'W') value = -value;
  return { value, hemi };
}

/**
 * Coordinates pasted in any common form, as { lat, lng } rounded to
 * COORD_DECIMALS — or null when the text is not a pair:
 *   "34.9671, 135.7727" · "34.9671 135.7727" · "34.9671° N, 135.7727° E"
 *   "34°58'01.6\"N 135°46'21.7\"E" · a map link with "@34.9671,135.7727,17z" or "?q=34.9671,135.7727"
 * A pair given east-first ("135.77 E, 34.97 N") is put the right way round.
 */
export function parseCoordinatePair(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim().slice(0, 300);
  if (!text) return null;

  // Map links: …/@lat,lng,zoom… or ?q=lat,lng / ?ll=lat,lng
  const link = /[@=](-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text);
  if (/^https?:\/\//i.test(text)) {
    if (!link) return null;
    return finish(Number(link[1]), Number(link[2]));
  }

  // Two plain decimals: "34.9671, 135.7727" or "34.9671 135.7727".
  const plain = new RegExp(`^(${DECIMAL})\\s*(?:[,;/]|\\s)\\s*(${DECIMAL})$`).exec(text.replace(/[−–]/g, '-'));
  if (plain) return finish(Number(plain[1]), Number(plain[2]));

  // Degrees with hemispheres, minutes and seconds: split where the first hemisphere letter ends.
  const split = /^(.*?[NS])\s*[,;]?\s*(.*[EW].*)$/i.exec(text) ?? /^(.*?[EW])\s*[,;]?\s*(.*[NS].*)$/i.exec(text);
  if (split) {
    const first = readDegrees(split[1]);
    const second = readDegrees(split[2]);
    if (!first || !second) return null;
    const latFirst = first.hemi === 'N' || first.hemi === 'S';
    return finish(latFirst ? first.value : second.value, latFirst ? second.value : first.value);
  }
  return null;
}

/** Rounded { lat, lng }, turned the right way round when only one order is possible; null when out of range. */
function finish(a, b) {
  const [lat, lng] = Math.abs(a) > 90 && Math.abs(b) <= 90 ? [b, a] : [a, b];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

/** "34.9671° N, 135.7727° E" for screen readers and captions; '' without a pair. */
export function describeCoords(latValue, lngValue) {
  const lat = readNumber(latValue);
  const lng = readNumber(lngValue);
  if (lat === null || lng === null) return '';
  return `${Math.abs(lat).toFixed(COORD_DECIMALS)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lng).toFixed(COORD_DECIMALS)}° ${lng < 0 ? 'W' : 'E'}`;
}

/**
 * What to say about a link typed into a brochure (place website, call to
 * action, visitor-information links, sources). Links are optional; when given
 * they must be web addresses, and https is expected:
 *   { state: 'empty' | 'ok' | 'http' | 'bare' | 'invalid', tone, message, fix?, host? }
 * `fix` is the corrected URL for 'http' (→ https) and 'bare' (www.x.jp → https://www.x.jp).
 */
export function urlCheck(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { state: 'empty', tone: 'info', message: '' };
  const safe = safeUrl(text);
  if (safe) {
    const host = new URL(safe).hostname.replace(/^www\./, '');
    if (/^http:/i.test(safe)) {
      return { state: 'http', tone: 'warning', message: 'Use a secure https:// link — almost every official site has one.', fix: `https://${safe.slice(7)}`, host };
    }
    if (!host.includes('.') && host !== 'localhost') return { state: 'invalid', tone: 'error', message: 'That address has no domain (like .jp or .com).' };
    return { state: 'ok', tone: 'ok', message: '', host };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/i.test(text)) {
    return { state: 'invalid', tone: 'error', message: 'Only web links can go here — an address that starts with https://.' };
  }
  if (/^(\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/i.test(text) && !/\s/.test(text)) {
    const fix = `https://${text.replace(/^\/\//, '')}`;
    if (safeUrl(fix)) return { state: 'bare', tone: 'warning', message: 'Add https:// so the link opens.', fix };
  }
  return { state: 'invalid', tone: 'error', message: 'That doesn’t look like a web address. Paste the full link, starting with https://.' };
}

/** "October 2026" — the month a fact check happened, as brochures print it. */
export function monthYear(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
}
