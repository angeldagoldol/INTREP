#!/usr/bin/env node
/**
 * Downloads the real photographs listed in src/data/photos/manifest/*.json
 * from Wikimedia Commons, checks their licence and size, and writes
 *   public/photos/<id>-<480|960|1600>.webp   (resized from Commons' 1920px thumbnail, never upscaled)
 *   src/data/photos/photos.generated.json    (size, LQIP, colour, credit, licence)
 *
 *   npm run photos:fetch                        # every photo not on this computer yet
 *   npm run photos:fetch -- --only kyoto-thousand-gates --only tokyo-shibuya-crossing
 *   npm run photos:fetch -- --force             # download again even when present
 *   npm run photos:fetch -- --dry-run           # check what would be chosen, write nothing
 *   npm run photos:fetch -- --list-candidates   # print the Commons links for curation (offline)
 *   npm run photos:fetch -- --no-search         # researched candidates only, no Commons search
 *   npm run photos:fetch -- --prune             # also drop photos no manifest lists any more
 *   node scripts/photos/fetch.mjs --auto        # what `npm run dev` (in the background) and
 *                                               # `npm run build` (first) run: friendly progress,
 *                                               # never fails — offline it warns and exits 0
 *
 * Per slot: its "file" if set, else each of its "candidates" in order; the first
 * that is a free licence (CC0, public domain, CC BY, CC BY-SA) and at least
 * 1600 px on the long edge wins. When none does, Commons is searched for the
 * slot's "query" with the browser's rule (the right shape for its use, then the
 * largest; never a picture another slot shows). photos.generated.json is
 * published in batches — the Home page and covers first — so a running dev
 * server swaps art for photos a few times rather than 213; photos downloaded in
 * between wait in .cache/photo-fetch/journal.json, so an interrupted run
 * resumes where it stopped. Plans and choices: plan.mjs (pure, tested).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildRecord, commonsPageUrl, DOWNLOAD_WIDTH, matchesOnly, parseArgs } from './lib.mjs';
import {
  FAILURES_FILE,
  GENERATED_FILE,
  JOURNAL_FILE,
  PUBLIC_DIR,
  ROOT,
  STATUS_FILE,
  acquireLock,
  errorCode,
  isOfflineError,
  loadGenerated,
  loadManifests,
  networkHint,
  politeFetch,
  pool,
  publishRecords,
  queryImageInfo,
  readJson,
  redactProxy,
  proxyFromEnv,
  releaseLock,
  saveGenerated,
  searchImageInfo,
  testRoutes,
  transport,
  writeJsonAtomic,
} from './io.mjs';
import {
  claimFile,
  fileOwners,
  isPriority,
  missedChosenFile,
  photos,
  planFetch,
  progressBar,
  recoverJournal,
  searchChoices,
  searchQuery,
  shouldReport,
  slotSignature,
  slotTitles,
  slotsOf,
  usableCandidates,
} from './plan.mjs';
import { processImage, removeOutputs } from './process.mjs';

/** Images downloaded and resized at once (Wikimedia asks for a small number; API requests go one at a time). */
const DOWNLOADS_AT_ONCE = 3;
/** Search pages looked at per slot (20 results each) before it is given up. */
const SEARCH_PAGES = 2;

let opts;
try {
  opts = parseArgs(process.argv.slice(2), {
    boolean: ['force', 'dry-run', 'list-candidates', 'prune', 'help', 'auto', 'dev', 'no-search'],
    string: ['only'],
  });
} catch (error) {
  console.error(`${error.message} (try --help)`);
  process.exit(1);
}
if (opts.help) {
  console.log(
    'Usage: npm run photos:fetch -- [--only <manifest|brochure|photo-id>]… [--force] [--dry-run] [--list-candidates] [--no-search] [--prune]\n' +
      '  --prune      also delete generated records and files of ids no manifest lists any more\n' +
      '  --no-search  only the researched candidates: never search Commons for a slot\n' +
      '  --auto       friendly output for `npm run dev` / `npm run build`; never fails (exit 0)',
  );
  process.exit(0);
}
const auto = Boolean(opts.auto);
const only = opts.only ? [].concat(opts.only) : [];

/* --------------------------------------------------------------- output */

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const tag = auto ? `${paint('36', '[photos]')} ` : '';
const say = (line = '') => console.log(line ? `${tag}${line}` : '');
const note = (line) => say(paint('2', line));
const warn = (line) => console.warn(`${tag}${paint('33', line)}`);
const done = (line) => say(paint('32', line));
/** In --auto mode nothing is a failure: the site still works with art where a photo is missing. */
const exit = (code) => process.exit(auto ? 0 : code);

if (auto && process.env.TABI_SKIP_PHOTOS === '1') exit(0);

const routes = testRoutes();
if (routes) warn(`TEST MODE: Commons requests go to ${[routes.api, routes.upload].filter(Boolean).join(' and ')} (TABI_COMMONS_API / TABI_COMMONS_UPLOAD).`);

/* -------------------------------------------------------------- the plan */

const manifests = await loadManifests();
if (!auto) for (const m of manifests) for (const problem of m.problems) console.warn(`! ${problem}`);
const slots = slotsOf(manifests);
const listedTwice = manifests.flatMap((m) => m.photos.map((p) => p.id)).filter((id, i, all) => all.indexOf(id) !== i);
if (listedTwice.length && !auto) console.warn(`! Duplicate photo ids across manifests (the first listing wins): ${[...new Set(listedTwice)].join(', ')}`);

if (slots.length === 0) {
  if (!auto) console.log(`No photos listed yet: add manifests to ${path.relative(ROOT, path.dirname(GENERATED_FILE))}/manifest/ (see docs/REAL_CONTENT.md).`);
  exit(0);
}
const slotById = new Map(slots.map((slot) => [slot.photo.id, slot]));

if (opts.listCandidates) {
  for (const s of slots.filter((slot) => matchesOnly(only, { manifest: slot.manifest, brochure: slot.brochure, id: slot.photo.id }))) {
    const titles = slotTitles(s.photo);
    console.log(`\n${s.photo.id}  (${s.manifest}${s.photo.use ? ` · ${s.photo.use}` : ''})${s.photo.file ? '  chosen' : ''}`);
    if (s.photo.place) console.log(`  ${s.photo.place}`);
    titles.forEach((t, i) => console.log(`  ${i + 1}. ${commonsPageUrl(t)}`));
    if (searchQuery(s.photo)) console.log(`  search: ${searchQuery(s.photo)}`);
  }
  process.exit(0);
}

let generated;
try {
  generated = await loadGenerated();
} catch (error) {
  if (auto) warn(`Skipping the photo download: ${error.message}`);
  else console.error(error.message);
  exit(1);
}

if (!opts.dryRun && !(await acquireLock())) {
  if (auto) note('Another photo download is already running; leaving it to finish.');
  else console.error('Another photo download is already running (see .cache/photo-fetch/lock.json). Wait for it, or delete that file if it is not.');
  exit(1);
}

const exists = (name) => existsSync(path.join(PUBLIC_DIR, name));

// Photos an interrupted run downloaded but had not published yet: publish them now.
if (!opts.dryRun) {
  const { records } = recoverJournal(await readJson(JOURNAL_FILE, {}), slots, { exists });
  if (Object.keys(records).length) {
    generated = await publishRecords(records);
    note(`Picked up ${photos(Object.keys(records).length)} downloaded by an earlier run.`);
  }
  await writeJsonAtomic(JOURNAL_FILE, {});
}

const failures = await readJson(FAILURES_FILE, {});
const plan = planFetch(slots, generated, { only, exists, force: opts.force, failures, honourFailures: auto });
if (only.length && plan.selected.length === 0) {
  console.error(`Nothing matches --only ${only.join(', ')}`);
  await finishLock();
  exit(1);
}
const total = plan.todo.length;

if (total === 0) {
  if (auto) {
    const have = plan.cached.length;
    if (plan.waiting.length === 0) done(`✓ All ${have} real photos are on this computer (public/photos).`);
    else note(`✓ ${have} of ${plan.selected.length} real photos are on this computer; ${photos(plan.waiting.length)} could not be downloaded last time (\`npm run photos:fetch\` tries again).`);
  } else {
    console.log(`${plan.selected.length} photo slot(s) selected · all ${plan.cached.length} already downloaded${opts.force ? '' : ' (--force downloads them again)'}`);
  }
  await writeStatus({ state: 'done', done: 0, total: 0, have: plan.cached.length, missing: plan.waiting.length });
  await finishLock();
  exit(0);
}

/* ---------------------------------------------------------------- the run */

const { proxy } = await transport();
const controller = new AbortController();
const { signal } = controller;
let stopping = false;
let stoppedAt = 0;
for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(name, () => {
    // The first signal stops the run (what is downloaded is saved); one a few seconds later forces the exit.
    // A terminal's Ctrl+C and the dev launcher can both send one at the same moment: that counts once.
    if (stopping) {
      if (Date.now() - stoppedAt > 3000) process.exit(auto ? 0 : 130);
      return;
    }
    stopping = true;
    stoppedAt = Date.now();
    controller.abort(new Error('stopped'));
  });
}

const firstRun = Object.keys(generated).length === 0;
if (auto) {
  say(`${paint('1', `Downloading real photos of Japan from Wikimedia Commons${firstRun ? ' (first run only)' : ''}…`)} ${total} to get.`);
  note(opts.dev ? 'The site is already running: the photos replace the placeholder art as they arrive, no reload needed.' : 'They are saved in public/photos and ship with the site.');
} else {
  console.log(`${plan.selected.length} photo slot(s) selected · ${plan.cached.length} already downloaded · ${total} to fetch${opts.dryRun ? ' (dry run)' : ''}`);
}
if (proxy === 'undici' || proxy === 'node') note(`HTTPS_PROXY is set: going through ${redactProxy(proxyFromEnv())} (NO_PROXY respected).`);
if (proxy === 'unused') warn('HTTPS_PROXY is set, but this Node cannot use it by itself: if the download fails, run it with NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).');

const owners = fileOwners(slots, generated);
const report = { ok: [], failed: [], searched: 0 };
const journal = {};
let journalWrites = Promise.resolve();
let finished = 0;
let lastReported = 0;
let lastReportAt = Date.now();
let offlineError = null;
let published = 0;
let statusAt = 0;

/** The downloaded-but-unpublished records, saved after every photo so an interruption keeps them. */
function journalAdd(record) {
  journal[record.id] = record;
  journalWrites = journalWrites.then(() => writeJsonAtomic(JOURNAL_FILE, journal)).catch(() => {});
  return journalWrites;
}

function writeStatus(status) {
  if (opts.dryRun) return Promise.resolve();
  return writeJsonAtomic(STATUS_FILE, { ...status, pid: process.pid, updatedAt: Date.now() }).catch(() => {});
}

/**
 * After each photo: a progress line now and then (not for a batch's last photo — its "saved" line
 * follows), and the status file for the dev server's notice at most every 1.5 s (or now, with `force`).
 */
function progress({ batchEnd = total, force = false } = {}) {
  const now = Date.now();
  if (auto && finished < batchEnd && shouldReport({ done: finished, total, lastDone: lastReported, sinceMs: now - lastReportAt })) {
    lastReported = finished;
    lastReportAt = now;
    say(`${progressBar(finished, total)} downloaded…`);
  }
  if (force || now - statusAt > 1500) {
    statusAt = now;
    writeStatus({ state: 'running', done: finished, total, published });
  }
}

/** The 1920px thumbnail (a standard step; the original when that is smaller), else the original if it is not huge. */
async function download(info) {
  const urls = [info.thumburl, Number(info.size) < 40e6 ? info.url : null].filter(Boolean);
  let lastError;
  for (const url of [...new Set(urls)]) {
    try {
      const response = await politeFetch(url, { accept: 'image/*', timeout: 90_000, signal });
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (signal.aborted || isOfflineError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error('no download URL');
}

/** Download, resize and journal one choice for a slot. → true when the slot has its photo. */
async function take(slot, choice, via, tried, trouble) {
  const { photo } = slot;
  if (opts.dryRun) {
    report.ok.push({ id: photo.id, title: choice.title, via, note: `${choice.verdict.credit.license} · ${choice.verdict.credit.author}` });
    return true;
  }
  try {
    const image = await download(choice.result.info);
    const out = await processImage(image, photo.id, { outDir: PUBLIC_DIR });
    const record = buildRecord({
      id: photo.id,
      file: choice.title,
      ...out,
      credit: choice.verdict.credit,
      fetchedAt: new Date().toISOString(),
      via,
      query: via === 'search' ? searchQuery(photo) : undefined,
    });
    await journalAdd(record);
    const kb = out.files.reduce((n, f) => n + f.bytes, 0) / 1024;
    report.ok.push({ id: photo.id, title: choice.title, via, note: `${out.widths.join('/')}w · ${kb.toFixed(0)} KB · ${record.license} · ${record.author}` });
    if (choice.verdict.credit.restrictions && !auto) console.warn(`! ${photo.id}: Commons lists restrictions: ${choice.verdict.credit.restrictions}`);
    return true;
  } catch (error) {
    if (signal.aborted || isOfflineError(error)) throw error;
    trouble.network ||= error.status === 429 || error.status >= 500 || error.name === 'TimeoutError';
    tried.push(`${choice.title}: download/processing failed (${error.status ?? errorCode(error) ?? error.message})`);
    return false;
  }
}

/** One slot: its researched pictures, else a Commons search. */
async function fetchSlot(slot, info) {
  const { photo } = slot;
  const { usable, tried } = usableCandidates(photo, info);
  const trouble = { network: false };
  let via = null;
  let file = null;
  for (const choice of usable) {
    if (await take(slot, choice, 'candidate', tried, trouble)) {
      via = 'candidate';
      file = choice.title;
      break;
    }
  }
  const query = searchQuery(photo);
  if (!via && query && !opts.noSearch) {
    let offset;
    let considered = 0;
    for (let page = 0; page < SEARCH_PAGES && !via; page += 1) {
      const { results, nextOffset } = await searchImageInfo(query, { offset, signal });
      const choices = searchChoices(results, slot, owners);
      considered += choices.length;
      for (const choice of choices) {
        const others = [...(owners.get(choice.title) ?? [])].filter((id) => id !== photo.id);
        if (others.length) continue; // taken by a slot searched meanwhile
        claimFile(owners, choice.title, photo.id);
        if (await take(slot, choice, 'search', tried, trouble)) {
          via = 'search';
          file = choice.title;
          break;
        }
      }
      if (choices.length || !nextOffset) break;
      offset = nextOffset;
    }
    if (!via && considered === 0) tried.push(`Commons search "${query}": nothing usable (free licence, ≥ 1600 px, not shown by another slot)`);
  } else if (!via && !query && !usable.length && !tried.length) {
    tried.push('no candidates and no search query');
  }
  if (via) {
    if (via === 'search') report.searched += 1;
    delete failures[photo.id];
    // Its chosen file was unusable: the stand-in is kept, and the automatic download tries the file again tomorrow, not on every start.
    if (missedChosenFile(photo, file) && !opts.dryRun) failures[photo.id] = { at: Date.now(), sig: slotSignature(photo), reason: `chosen file unusable: ${tried[0] ?? ''}` };
  } else {
    report.failed.push({ id: photo.id, manifest: slot.manifest, tried });
    // Remembered so the automatic download does not search again on every start (unless the network was to blame).
    if (!trouble.network && !opts.dryRun) failures[photo.id] = { at: Date.now(), sig: slotSignature(photo), reason: tried.at(-1) ?? 'nothing usable' };
  }
}

/** Publish what this run has downloaded so far into photos.generated.json (and empty the journal). */
async function publish() {
  await journalWrites;
  const ids = Object.keys(journal);
  if (!ids.length || opts.dryRun) return 0;
  generated = await publishRecords(journal);
  for (const id of ids) delete journal[id];
  await writeJsonAtomic(JOURNAL_FILE, {});
  published += ids.length;
  return ids.length;
}

try {
  let batchEnd = 0;
  for (const [index, batch] of plan.batches.entries()) {
    if (stopping) break;
    batchEnd += batch.length;
    const info = await queryImageInfo(
      batch.flatMap((s) => slotTitles(s.photo)),
      { thumbWidth: DOWNLOAD_WIDTH, signal },
    );
    await pool(batch, DOWNLOADS_AT_ONCE, async (slot) => {
      if (stopping || offlineError) return;
      try {
        await fetchSlot(slot, info);
      } catch (error) {
        if (signal.aborted) return;
        if (isOfflineError(error)) {
          offlineError ??= error;
          return;
        }
        report.failed.push({ id: slot.photo.id, manifest: slot.manifest, tried: [`${error.message}`] });
      }
      finished += 1;
      progress({ batchEnd });
    });
    if (offlineError) throw offlineError;
    const count = await publish();
    if (auto && count && !stopping) {
      const first = index === 0 && batch.some(isPriority);
      say(`${progressBar(finished, total)} ${paint('32', '✓ saved')}${first ? ' — the Home page and brochure covers first' : ''}${opts.dev ? ' (the open page updates itself)' : ''}`);
      lastReported = finished;
      lastReportAt = Date.now();
    }
    progress({ batchEnd, force: true });
  }
} catch (error) {
  if (!signal.aborted) offlineError = error;
}

/* ------------------------------------------------------------- the end */

await publish().catch((error) => warn(`Could not save photos.generated.json: ${error.message}`));
if (!opts.dryRun) await writeJsonAtomic(FAILURES_FILE, failures).catch(() => {});

if (opts.prune && !opts.dryRun && only.length === 0 && !offlineError && !stopping) {
  for (const id of Object.keys(generated)) {
    if (slotById.has(id)) continue;
    delete generated[id];
    await removeOutputs(PUBLIC_DIR, id);
    console.log(`- pruned ${id}`);
  }
  await saveGenerated(generated);
}

const have = plan.cached.length + published;
if (stopping) {
  say(`Stopped. ${photos(published)} saved; the rest download next time (\`npm run dev\` or \`npm run photos:fetch\`).`);
  await writeStatus({ state: 'stopped', done: finished, total, published });
} else if (offlineError) {
  const offline = isOfflineError(offlineError);
  const lines = offline ? networkHint(offlineError, { proxy }).split('\n') : [`Commons did not answer properly (${offlineError.message}).`, 'Try again later with `npm run photos:fetch`; the app shows art where a photo is missing until then.'];
  if (published) lines.unshift(`${photos(published)} saved before the connection dropped.`);
  for (const line of lines) warn(line);
  await writeStatus({ state: 'offline', done: finished, total, published, message: offline ? 'offline' : offlineError.message });
} else {
  await writeStatus({ state: 'done', done: finished, total, published, have, missing: report.failed.length });
}

if (!auto) {
  console.log('');
  report.ok.sort((a, b) => a.id.localeCompare(b.id));
  report.failed.sort((a, b) => a.id.localeCompare(b.id));
  for (const r of report.ok) console.log(`✓ ${r.id}  ← ${r.title}${r.via === 'search' ? '  (found by search)' : ''}\n    ${r.note}`);
  for (const r of report.failed) {
    console.log(`✗ ${r.id}  (${r.manifest})`);
    for (const t of r.tried) console.log(`    ${t}`);
    if (r.tried.length === 0) console.log('    no candidates');
  }
  console.log(`\n${report.ok.length} ${opts.dryRun ? 'usable' : 'fetched'}${report.searched ? ` (${report.searched} found by search)` : ''} · ${plan.cached.length} cached · ${report.failed.length} failed`);
  if (report.failed.length && !offlineError) {
    console.log('Failed photos keep showing the brochure art. Add better candidates or a "query" (or set "file"), then run again;');
    console.log('`npm run photos:candidates -- <manifest>` builds contact sheets to choose from.');
  }
  if (report.searched) console.log('Photos found by search use their Commons title as alt text: check them on #/credits before you publish.');
} else if (!stopping && !offlineError) {
  const searched = report.searched ? ` (${report.searched} found by searching Commons)` : '';
  if (report.failed.length === 0) {
    done(`✓ Done: all ${have} real photos are saved in public/photos${searched}.`);
  } else {
    done(`✓ Done: ${have} of ${plan.selected.length} real photos are saved in public/photos${searched}.`);
    warn(`${photos(report.failed.length)} found no usable picture on Commons and keep the art: ${report.failed.map((r) => r.id).join(', ')}.`);
  }
  note('Credits are in src/data/photos/photos.generated.json; the photos now load from this computer, even offline.');
}

await finishLock();
exit(offlineError ? 2 : report.failed.length ? 1 : 0);

async function finishLock() {
  if (!opts.dryRun) await releaseLock();
}

