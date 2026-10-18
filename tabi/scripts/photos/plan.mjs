/**
 * Planning for the photo download (fetch.mjs, which `npm run dev` and
 * `npm run build` run by themselves): which manifest slots still need a
 * photo, in which order and in which batches photos.generated.json is
 * published, which picture each slot gets (its chosen file, its candidates,
 * else a Commons search for its `query`), what an interrupted run left to
 * resume, and the progress lines. Pure — no I/O; plan.test.mjs covers it
 * with fixtures.
 */
import { evaluateCandidate, matchesOnly, normalizeFileTitle, outputName, rankSearchResults } from './lib.mjs';

const DAY = 24 * 60 * 60 * 1000;
/** A slot that found no usable picture is not searched again by the automatic download for this long. */
export const RETRY_FAILED_AFTER_MS = DAY;
/** Photos downloaded between two publications of photos.generated.json (after the first batch). */
export const PUBLISH_EVERY = 60;
/**
 * Manifests shown first: the Home page (hero, seasons, regions) and its
 * Nostalgic Japan mosaic, whose photographs also head the Library and
 * Credits pages. Brochure covers (`use: "cover"`) join them.
 */
export const PRIORITY_MANIFESTS = ['home', 'nostalgic-japan'];

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** A short, stable hash (FNV-1a, base 36). */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------------ slots */

/**
 * Manifests (io.loadManifests) → slots [{ manifest, brochure, photo }], in
 * manifest order. An id listed twice keeps its first entry, as the app's
 * registry does.
 */
export function slotsOf(manifests) {
  const seen = new Set();
  const slots = [];
  for (const m of Array.isArray(manifests) ? manifests : []) {
    for (const photo of Array.isArray(m?.photos) ? m.photos : []) {
      if (!isRecord(photo) || !str(photo.id) || seen.has(photo.id)) continue;
      seen.add(photo.id);
      slots.push({ manifest: m.name, brochure: m.brochure ?? null, photo });
    }
  }
  return slots;
}

/** The Commons search words of a slot ('' when it has none). */
export function searchQuery(photo) {
  return str(photo?.query).slice(0, 200);
}

/**
 * The researched pictures of a slot, in the order they are tried: its chosen
 * `file` (a curator's pick), then its `candidates` — normalised, once each.
 * The browser tries the same titles in the same order (live.js liveSlots).
 */
export function slotTitles(photo) {
  const raw = [photo?.file, ...(Array.isArray(photo?.candidates) ? photo.candidates : [])];
  return [...new Set(raw.map(normalizeFileTitle).filter(Boolean))];
}

/** The curator's chosen file of a slot ("File:…"), or null. */
function chosenFile(photo) {
  return normalizeFileTitle(photo?.file);
}

/** Changes whenever what a slot may show changes (its use, titles or search words). */
export function slotSignature(photo) {
  return hash(`${str(photo?.use) || 'any'}\n${slotTitles(photo).join('\n')}\n${searchQuery(photo)}`);
}

/**
 * Whether a slot's photo is already on this computer: every width its record
 * lists is on disk (`exists(fileName)` → boolean), and the record is a local
 * import or still fits the slot — its chosen file when a curator set one,
 * else one of its candidates or a picture found by searching Commons with
 * the slot's current words.
 */
export function isCached(slot, record, { exists = () => true, force = false } = {}) {
  if (force || !isRecord(record)) return false;
  const { photo } = slot;
  const widths = Array.isArray(record.widths) ? record.widths : [];
  if (!widths.length || !widths.every((w) => exists(outputName(photo.id, w)))) return false;
  const file = str(record.file);
  if (file.startsWith('local:')) return true;
  const chosen = chosenFile(photo);
  if (chosen) return file === chosen;
  if (slotTitles(photo).includes(file)) return true;
  return record.via === 'search' && Boolean(searchQuery(photo)) && str(record.query) === searchQuery(photo);
}

/** True when a slot ended up with something other than its curator's chosen file (that file was unusable). */
export function missedChosenFile(photo, file) {
  const chosen = chosenFile(photo);
  return Boolean(chosen) && normalizeFileTitle(file) !== chosen;
}

/** First in line: the Home page's photographs (and its mosaic) and every brochure cover. */
export function isPriority(slot) {
  return PRIORITY_MANIFESTS.includes(slot.manifest) || slot.brochure === 'home' || str(slot.photo?.use) === 'cover';
}

/**
 * The slots to download, in batches: the first batch is the priority slots
 * (Home and covers, so the pages people open first turn into photographs
 * soonest), then the rest in near-equal parts of at most `size`. The
 * registry is published after each batch.
 */
export function planBatches(todo, { size = PUBLISH_EVERY } = {}) {
  const first = todo.filter(isPriority);
  const rest = todo.filter((slot) => !isPriority(slot));
  const batches = first.length ? [first] : [];
  const parts = Math.ceil(rest.length / Math.max(1, size));
  for (let i = 0; i < parts; i += 1) batches.push(rest.slice(Math.round((i * rest.length) / parts), Math.round(((i + 1) * rest.length) / parts)));
  return batches;
}

/** True when `failure` ({ at, sig }) is recent and still about this slot as it is now. */
export function recentlyFailed(failure, slot, { now = Date.now(), retryAfterMs = RETRY_FAILED_AFTER_MS } = {}) {
  if (!isRecord(failure) || !Number.isFinite(failure.at)) return false;
  const age = now - failure.at;
  return age >= 0 && age < retryAfterMs && failure.sig === slotSignature(slot.photo);
}

/**
 * What a run has to do.
 *   planFetch(slots, generated, { only, exists, force, failures, honourFailures, now })
 *   → { selected, cached, todo, waiting, batches }
 * `selected`: the slots `only` matches (all by default); `cached`: their ids
 * already on disk; `todo`: the slots to download, in batch order; `waiting`:
 * slots skipped because they recently found no usable picture (only when
 * `honourFailures`, the automatic download — `npm run photos:fetch` always
 * tries them again); `batches`: `todo` split by planBatches().
 */
export function planFetch(slots, generated = {}, { only = [], exists, force = false, failures = {}, honourFailures = false, now = Date.now(), retryAfterMs, batchSize } = {}) {
  const records = isRecord(generated) ? generated : {};
  const selected = slots.filter((s) => matchesOnly(only, { manifest: s.manifest, brochure: s.brochure, id: s.photo.id }));
  const cached = [];
  const waiting = [];
  const pending = [];
  for (const slot of selected) {
    if (isCached(slot, records[slot.photo.id], { exists, force })) cached.push(slot.photo.id);
    else if (honourFailures && !force && recentlyFailed(failures?.[slot.photo.id], slot, { now, retryAfterMs })) waiting.push(slot.photo.id);
    else pending.push(slot);
  }
  const batches = planBatches(pending, { size: batchSize });
  return { selected, cached, waiting, todo: batches.flat(), batches };
}

/* ----------------------------------------------------------------- choice */

/**
 * The researched pictures a slot can use, in its own order (its chosen file,
 * then its candidates): those whose imageinfo (`info`: Map title → parsed
 * result) passes the policy. → { usable: [{ title, result, verdict }], tried: ['title: reason'] }
 */
export function usableCandidates(photo, info, { evaluate = evaluateCandidate } = {}) {
  const usable = [];
  const tried = [];
  for (const title of slotTitles(photo)) {
    const result = info?.get?.(title);
    const verdict = evaluate(result);
    if (verdict.ok) usable.push({ title: verdict.title || title, result, verdict });
    else tried.push(`${title}: ${verdict.reason}`);
  }
  return { usable, tried };
}

/**
 * Who shows which file: Map("File:…" → Set of slot ids), from every slot's
 * researched titles and every record already downloaded. A search never
 * picks a file someone else owns, so no picture appears twice.
 */
export function fileOwners(slots, generated = {}) {
  const owners = new Map();
  const own = (file, id) => {
    const title = normalizeFileTitle(file);
    if (!title || !id) return;
    if (!owners.has(title)) owners.set(title, new Set());
    owners.get(title).add(id);
  };
  for (const slot of slots) for (const title of slotTitles(slot.photo)) own(title, slot.photo.id);
  for (const [id, record] of Object.entries(isRecord(generated) ? generated : {})) if (isRecord(record)) own(record.file, id);
  return owners;
}

/** Record that `id` now shows `file` (a search pick), in place. */
export function claimFile(owners, file, id) {
  const title = normalizeFileTitle(file);
  if (!title) return;
  if (!owners.has(title)) owners.set(title, new Set());
  owners.get(title).add(id);
}

/** The files a search for slot `id` must leave alone: everything another slot owns. */
export function excludedFor(owners, id) {
  const out = new Set();
  for (const [file, ids] of owners) if ([...ids].some((other) => other !== id)) out.add(file);
  return out;
}

/**
 * Search results for a slot, best first (the browser's rule, shared through
 * rankSearchResults: right shape for its `use` — cover/full portrait-ish
 * 0.5–1.1 : 1, wide/spread 1.4–2.4 : 1, any = largest — then size), leaving
 * out files another slot owns. → [{ title, result, verdict }]
 */
export function searchChoices(results, slot, owners, { evaluate = evaluateCandidate } = {}) {
  const use = str(slot.photo?.use) || 'any';
  return rankSearchResults(results, use, { evaluate, exclude: excludedFor(owners, slot.photo.id) }).map(({ file, result, verdict }) => ({ title: file, result, verdict }));
}

/* ----------------------------------------------------------------- resume */

/**
 * Records an interrupted run downloaded but had not published yet (the
 * journal, { [id]: record }), kept when their slot still lists them and their
 * files are on disk. → { records: { [id]: record }, dropped: number }
 */
export function recoverJournal(journal, slots, { exists } = {}) {
  const byId = new Map(slots.map((slot) => [slot.photo.id, slot]));
  const records = {};
  let dropped = 0;
  for (const [id, record] of Object.entries(isRecord(journal) ? journal : {})) {
    const slot = byId.get(id);
    if (slot && isCached(slot, record, { exists })) records[id] = record;
    else dropped += 1;
  }
  return { records, dropped };
}

/* --------------------------------------------------------------- progress */

/**
 * Whether to print a progress line now: at the end, every ~10% (at least
 * every 5 photos), or after `quietMs` without one while photos keep coming.
 */
export function shouldReport({ done, total, lastDone = 0, sinceMs = 0, quietMs = 20_000 }) {
  if (done <= lastDone) return false;
  if (done >= total) return true;
  const step = Math.max(5, Math.round(total / 10));
  return done - lastDone >= step || sinceMs >= quietMs;
}

/** "42/213" with a bar for terminals: "[███░░░░░░░] 42/213". */
export function progressBar(done, total, width = 16) {
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1;
  const full = Math.round(share * width);
  return `[${'█'.repeat(full)}${'░'.repeat(width - full)}] ${done}/${total}`;
}

/** "1 photo" / "3 photos". */
export function photos(n) {
  return `${n} photo${n === 1 ? '' : 's'}`;
}
