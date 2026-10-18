/**
 * The Studio's own photos ("Upload your own photo"): checking a file,
 * downscaling it in a canvas to a JPEG small enough for localStorage, the
 * per-brochure budget, and the rules every stored or imported upload passes.
 *
 * A brochure keeps its uploads in `brochure.userPhotos` (ARCHITECTURE.md):
 *   { [key]: { src: 'data:image/jpeg;base64,…', alt, caption?, focus?, width, height,
 *              credit: { author, license, licenseUrl?, sourceUrl? } } }
 * and photo fields point at them as "user:<key>". Everything here is pure
 * except downscaleImage/decodeImage (canvas) and estimateStorageUse
 * (localStorage), which take their browser APIs as injectable options.
 */
import { safeUrl } from '../../data/sanitize.js';

/** Longest edge of a stored upload, in pixels (the largest width the photo pipeline makes). */
export const MAX_EDGE = 1600;
/** JPEG quality of the first encode; lower steps are tried when a photo is still too heavy. */
export const JPEG_QUALITY = 0.82;
const QUALITY_STEPS = [JPEG_QUALITY, 0.74, 0.66];
/** Edges tried in turn when even the lowest quality is over MAX_PHOTO_CHARS. */
const EDGE_STEPS = [MAX_EDGE, 1280, 1024];
/**
 * All of one brochure's uploads, in characters of data: URL (≈ bytes in
 * localStorage, which also keeps the draft and the published copy).
 * Browsers give a site about 5 MB in all.
 */
export const USER_PHOTO_BUDGET = 3_000_000;
/** One upload, after downscaling. */
export const MAX_PHOTO_CHARS = 1_200_000;
/** Most uploads one brochure keeps. */
export const MAX_USER_PHOTOS = 24;
/** Files larger than this are refused before decoding (a phone's RAW or a panorama). */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** Rough localStorage allowance per site (Chrome, Firefox, Safari: about 5 million characters). */
export const STORAGE_QUOTA_ESTIMATE = 5_000_000;
/** What an upload is credited as unless the person says otherwise. */
export const DEFAULT_CREDIT = 'Your photo';

/** Image types the file picker offers; all are re-encoded as JPEG. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
/** The only `src` a stored or imported upload may have: inline JPEG, PNG or WebP. */
const STORED_SRC = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** Keys are short and plain ("p7k2x9"), so "user:<key>" ids stay readable and safe. */
const KEY = /^[A-Za-z0-9_-]{1,40}$/;

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/* --- Sizes ----------------------------------------------------------------- */

/** Scale (width × height) to fit within `maxEdge` on its long side, never enlarging. */
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}

/**
 * Intermediate sizes for a sharp downscale: halve while more than twice the
 * target, then the target itself (one big jump in drawImage aliases fine detail).
 *   downscaleSteps({ width: 6000, height: 4000 }, { width: 1600, height: 1067 })
 *   → [{ 3000×2000 }, { 1600×1067 }]
 */
export function downscaleSteps(from, to) {
  const steps = [];
  let { width, height } = from;
  while (width / 2 > to.width && height / 2 > to.height && steps.length < 8) {
    width = Math.round(width / 2);
    height = Math.round(height / 2);
    steps.push({ width, height });
  }
  steps.push({ width: to.width, height: to.height });
  return steps;
}

/** Characters a data: URL takes in storage (its length). */
export function storedSize(src) {
  return typeof src === 'string' ? src.length : 0;
}

/** Bytes of the image inside a base64 data: URL (what a file of it would weigh). */
export function dataUrlBytes(src) {
  if (typeof src !== 'string') return 0;
  const comma = src.indexOf(',');
  if (comma === -1) return 0;
  const body = src.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

/** Storage taken by all of a brochure's uploads (characters of their data: URLs). */
export function userPhotosSize(userPhotos) {
  if (!isRecord(userPhotos)) return 0;
  return Object.values(userPhotos).reduce((sum, entry) => sum + (isRecord(entry) ? storedSize(entry.src) : 0), 0);
}

/** "820 B", "412 KB", "1.2 MB" (decimal units, as people read file sizes). */
export function formatBytes(n) {
  const bytes = Math.max(0, Number(n) || 0);
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} MB`;
}

/**
 * Can `adding` more characters of photos join `used` within `budget`?
 *   { ok, used, after, budget, remaining, share, message }
 * `share` is the fraction of the budget in use afterwards (for a meter).
 */
export function budgetCheck({ used = 0, adding = 0, budget = USER_PHOTO_BUDGET, count = 0, maxCount = MAX_USER_PHOTOS } = {}) {
  const after = used + adding;
  const remaining = Math.max(0, budget - used);
  const base = { used, after, budget, remaining, share: Math.min(1, after / budget) };
  if (count >= maxCount) {
    return { ...base, ok: false, message: `A brochure can keep ${maxCount} of your photos. Remove one you no longer use to add another.` };
  }
  if (after > budget) {
    return {
      ...base,
      ok: false,
      message: `This photo (${formatBytes(adding)}) would take this brochure’s photos to ${formatBytes(after)}, over the ${formatBytes(budget)} that fits in your browser’s storage. Remove a photo you no longer use, or choose a smaller one.`,
    };
  }
  return { ...base, ok: true, message: '' };
}

/* --- Files ------------------------------------------------------------------ */

/**
 * Is this a file the Studio can turn into a photo? { ok: true } or
 * { ok: false, error } with a sentence for people. HEIC (iPhone) and RAW
 * files are refused by name, since browsers can't draw them.
 */
export function checkImageFile(file) {
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file was chosen.' };
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  if (/heic|heif/.test(type) || /\.(heic|heif)$/i.test(name)) {
    return { ok: false, error: 'HEIC photos can’t be read in the browser. Export it as JPEG first (on iPhone: Settings › Camera › Formats › Most Compatible).' };
  }
  const known = type ? ACCEPTED_TYPES.includes(type) : ACCEPTED_EXTENSIONS.test(name);
  if (!known) {
    return { ok: false, error: `${name || 'That file'} isn’t a photo the Studio can use. Choose a JPEG, PNG, WebP, GIF or AVIF image.` };
  }
  if (Number(file.size) > MAX_SOURCE_BYTES) {
    return { ok: false, error: `That file is ${formatBytes(file.size)} — choose a photo under ${formatBytes(MAX_SOURCE_BYTES)}.` };
  }
  if (Number(file.size) === 0) return { ok: false, error: 'That file is empty.' };
  return { ok: true };
}

/**
 * A starting alt text from a descriptive file name ("kiyomizu-dera_sunset.jpg"
 * → "Kiyomizu dera sunset"); '' for camera names (IMG_2034, DSC0001, PXL_…)
 * and anything without real words. People are always asked to check it.
 */
export function altFromFileName(name) {
  const base = String(name ?? '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .trim();
  if (!base || /^(img|dsc|dscn|dscf|pxl|mvimg|photo|image|screenshot|scan|p\d|gopr|dji)[\s_-]*\d/i.test(base)) return '';
  const words = base
    .replace(/[_\-.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => !/^\d+$/.test(word));
  if (words.filter((word) => /\p{L}{2,}/u.test(word)).length < 2) return '';
  const text = words.join(' ').slice(0, 120);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* --- Canvas ------------------------------------------------------------------ */

/**
 * Decode a file into something drawImage accepts, upright (EXIF orientation
 * applied). Uses createImageBitmap where available, else an <img>.
 */
export async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img>, which some browsers decode more formats with */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function defaultCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const sizeOf = (image) => ({ width: image.naturalWidth || image.width || 0, height: image.naturalHeight || image.height || 0 });

/**
 * Downscale an image file to a JPEG data: URL no longer than `maxEdge` on its
 * long side: stepped halving for sharpness, a white ground under transparent
 * pixels (JPEG has no alpha), then quality 0.82 — lower steps, and smaller
 * edges, only while the result is still over `maxChars`.
 * Resolves { src, width, height, size, quality } or rejects with an Error
 * whose message is for people.
 * Options (for tests): decode(file) → image, createCanvas(w, h) → canvas.
 */
export async function downscaleImage(file, { maxEdge = MAX_EDGE, maxChars = MAX_PHOTO_CHARS, decode = decodeImage, createCanvas = defaultCanvas } = {}) {
  let image;
  try {
    image = await decode(file);
  } catch {
    throw new Error('That image couldn’t be opened. It may be damaged, or in a format this browser can’t read — try a JPEG.');
  }
  const source = sizeOf(image);
  if (!source.width || !source.height) throw new Error('That image has no pixels to show.');

  try {
    let best = null;
    const tried = new Set();
    for (const edge of [maxEdge, ...EDGE_STEPS.filter((e) => e < maxEdge)]) {
      const target = fitWithin(source.width, source.height, edge);
      if (tried.has(target.width)) continue;
      tried.add(target.width);
      const canvas = drawScaled(image, source, target, createCanvas);
      for (const quality of QUALITY_STEPS) {
        const src = canvas.toDataURL('image/jpeg', quality);
        if (!/^data:image\/jpeg;base64,/.test(src)) throw new Error('This browser couldn’t make a JPEG of that image.');
        best = { src, width: target.width, height: target.height, size: storedSize(src), quality };
        if (best.size <= maxChars) return best;
      }
    }
    throw new Error(`Even made smaller, that photo is ${formatBytes(best?.size)} — too large to keep in the browser. Try a simpler or smaller image.`);
  } finally {
    image.close?.();
  }
}

function drawScaled(image, source, target, createCanvas) {
  let current = image;
  let size = source;
  let canvas = null;
  for (const step of downscaleSteps(source, target)) {
    canvas = createCanvas(step.width, step.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser couldn’t prepare the photo (no canvas).');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, step.width, step.height);
    ctx.drawImage(current, 0, 0, size.width, size.height, 0, 0, step.width, step.height);
    current = canvas;
    size = step;
  }
  return canvas;
}

/* --- Records ----------------------------------------------------------------- */

/** A key not yet used in `userPhotos`, from `makeId` ("p7k2x9…" style ids). */
export function newUserPhotoKey(userPhotos, makeId) {
  const taken = isRecord(userPhotos) ? userPhotos : {};
  for (let i = 0; i < 20; i += 1) {
    const key = String(makeId('ph')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    if (KEY.test(key) && !Object.hasOwn(taken, key)) return key;
  }
  let n = Object.keys(taken).length + 1;
  while (Object.hasOwn(taken, `ph${n}`)) n += 1;
  return `ph${n}`;
}

/**
 * A stored upload record from what the upload form collected:
 *   buildUserPhoto({ src, width, height }, { alt, caption, author, license, sourceUrl })
 * The credit defaults to "Your photo"; links are http(s) only.
 */
export function buildUserPhoto(image, details = {}) {
  const credit = { author: str(details.author, 120) || DEFAULT_CREDIT, license: str(details.license, 60) };
  const sourceUrl = safeUrl(details.sourceUrl);
  const licenseUrl = safeUrl(details.licenseUrl);
  if (sourceUrl) credit.sourceUrl = sourceUrl;
  if (licenseUrl) credit.licenseUrl = licenseUrl;
  const photo = { src: image.src, alt: str(details.alt, 300), width: Math.round(image.width), height: Math.round(image.height), credit };
  const caption = str(details.caption, 160);
  if (caption) photo.caption = caption;
  return photo;
}

function cleanCredit(credit) {
  const source = isRecord(credit) ? credit : {};
  const out = { author: str(source.author, 120), license: str(source.license, 60) };
  const sourceUrl = safeUrl(source.sourceUrl);
  const licenseUrl = safeUrl(source.licenseUrl);
  if (sourceUrl) out.sourceUrl = sourceUrl.slice(0, 500);
  if (licenseUrl) out.licenseUrl = licenseUrl.slice(0, 500);
  return out;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** One upload made safe, or null when it can't be kept (no inline JPEG/PNG/WebP, or too large). */
export function sanitizeUserPhoto(entry, { maxChars = MAX_PHOTO_CHARS } = {}) {
  if (!isRecord(entry) || typeof entry.src !== 'string') return null;
  const src = entry.src.trim();
  if (src.length > maxChars || !STORED_SRC.test(src)) return null;
  const width = Number.isFinite(entry.width) && entry.width > 0 ? Math.round(entry.width) : null;
  const height = Number.isFinite(entry.height) && entry.height > 0 ? Math.round(entry.height) : null;
  const out = { src, alt: str(entry.alt, 300) };
  if (width && height && width <= 20000 && height <= 20000) {
    out.width = width;
    out.height = height;
  }
  out.credit = cleanCredit(entry.credit);
  const caption = str(entry.caption, 160);
  if (caption) out.caption = caption;
  const focus = str(entry.focus, 40);
  if (focus && /^[a-z0-9%.\s-]+$/i.test(focus)) out.focus = focus;
  // A valid entry comes back as itself, so stored drafts keep their identity.
  return sameJson(out, entry) ? entry : out;
}

/**
 * brochure.userPhotos made safe for storage, import and export:
 *   { photos, dropped }  (photos is the same object when nothing changed)
 * Keeps entries with a plain key and an inline JPEG/PNG/WebP src (no http,
 * no blob:, no SVG), at most `maxCount`, each within `maxChars`, and — when
 * `budget` is given — stops before the total passes it. `null` when there is
 * nothing to keep.
 */
export function sanitizeUserPhotos(value, { budget = Infinity, maxChars = MAX_PHOTO_CHARS, maxCount = MAX_USER_PHOTOS } = {}) {
  if (!isRecord(value)) return { photos: null, dropped: 0 };
  const out = {};
  let changed = false;
  let dropped = 0;
  let total = 0;
  let count = 0;
  for (const [key, entry] of Object.entries(value)) {
    const clean = KEY.test(key) && key !== '__proto__' ? sanitizeUserPhoto(entry, { maxChars }) : null;
    const size = clean ? storedSize(clean.src) : 0;
    if (!clean || count >= maxCount || total + size > budget) {
      changed = true;
      dropped += 1;
      continue;
    }
    if (clean !== entry) changed = true;
    out[key] = clean;
    total += size;
    count += 1;
  }
  if (count === 0) return { photos: null, dropped };
  return { photos: changed ? out : value, dropped };
}

/* --- Use ----------------------------------------------------------------------- */

/** Where a "user:<key>" photo is used in a brochure: ['cover', 'page:<id>', …], once per page. */
export function userPhotoUses(doc, key) {
  const id = `user:${key}`;
  const uses = [];
  if (doc?.cover?.photo === id) uses.push('cover');
  for (const page of Array.isArray(doc?.pages) ? doc.pages : []) {
    const items = Array.isArray(page?.items) ? page.items : [];
    if (page?.photo === id || items.some((item) => item?.photo === id)) uses.push(`page:${page.id}`);
  }
  return uses;
}

/**
 * Characters used in localStorage by this site (keys and values), or null
 * when storage can't be read. The browser's real quota is unknown; compare
 * with STORAGE_QUOTA_ESTIMATE.
 */
export function estimateStorageUse(storage) {
  try {
    const store = storage ?? window.localStorage;
    let total = 0;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      total += (key?.length ?? 0) + (store.getItem(key)?.length ?? 0);
    }
    return total;
  } catch {
    return null;
  }
}
