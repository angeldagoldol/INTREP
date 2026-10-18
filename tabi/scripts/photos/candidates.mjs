#!/usr/bin/env node
/**
 * Curation helper: downloads every candidate of the given manifests (or
 * photo ids) as a small preview and builds one contact sheet per photo slot,
 * annotated with title, size, licence and whether it passes the policy.
 *
 *   npm run photos:candidates -- kyoto-thousand-gates         # one manifest
 *   npm run photos:candidates -- kyoto-senbon-torii --width 800
 *   npm run photos:candidates                                 # every manifest
 *
 * Output (gitignored): .cache/photo-candidates/<manifest>/<photo-id>.jpg (the sheet),
 * <photo-id>/<n>.jpg (previews) and <photo-id>.json (what the API said).
 * Look at the sheets, then set "file" in the manifest to the best candidate.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { candidateTitles, commonsPageUrl, contactSheetLayout, evaluateCandidate, matchesOnly, parseArgs, thumbStep, xmlEscape } from './lib.mjs';
import { CANDIDATE_DIR, ROOT, loadManifests, networkHint, politeFetch, pool, queryImageInfo } from './io.mjs';

let opts;
try {
  opts = parseArgs(process.argv.slice(2), { boolean: ['help'], string: ['out', 'width'] });
} catch (error) {
  console.error(`${error.message} (try --help)`);
  process.exit(1);
}
if (opts.help) {
  console.log('Usage: npm run photos:candidates -- [manifest|brochure|photo-id]… [--out dir] [--width 640]');
  process.exit(0);
}
const outDir = path.resolve(ROOT, opts.out ?? CANDIDATE_DIR);
const previewWidth = Math.min(Math.max(Number(opts.width) || 640, 200), 1280);
const TILE = 360;
const LABEL = 78;

const manifests = await loadManifests();
const slots = manifests.flatMap((m) => m.photos.map((photo) => ({ manifest: m.name, brochure: m.brochure, photo })));
const selected = slots.filter((s) => matchesOnly(opts._, { manifest: s.manifest, brochure: s.brochure, id: s.photo.id }));
if (selected.length === 0) {
  console.error(slots.length ? `Nothing matches ${opts._.join(', ')}` : 'No manifests yet (src/data/photos/manifest/*.json).');
  process.exit(1);
}

// Every candidate, not just the chosen file: curation compares them all.
const titlesOf = (photo) => candidateTitles({ candidates: [photo.file, ...(photo.candidates ?? [])].filter(Boolean) });
let info;
try {
  info = await queryImageInfo(
    selected.flatMap((s) => titlesOf(s.photo)),
    // A standard thumbnail step at least as wide as the preview (imageInfoUrl snaps it too).
    { thumbWidth: thumbStep(previewWidth) },
  );
} catch (error) {
  console.error(networkHint(error));
  process.exit(2);
}

const sheets = [];
await pool(selected, 2, async ({ manifest, photo }) => {
  const dir = path.join(outDir, manifest, photo.id);
  await mkdir(dir, { recursive: true });
  const titles = titlesOf(photo);
  const entries = [];
  await pool(
    titles.map((title, i) => ({ title, i })),
    3,
    async ({ title, i }) => {
      const result = info.get(title);
      const verdict = evaluateCandidate(result);
      const entry = {
        n: i + 1,
        title,
        page: commonsPageUrl(title),
        size: result?.info ? `${result.info.width}×${result.info.height}` : '',
        attribution: verdict.credit ? [verdict.credit.title, verdict.credit.author, verdict.credit.license].filter(Boolean).join(' · ') : '',
        license: verdict.credit?.license ?? verdict.license?.label ?? '',
        author: verdict.credit?.author ?? '',
        ok: verdict.ok,
        reason: verdict.reason ?? '',
        chosen: photo.file ? candidateTitles({ file: photo.file })[0] === title : false,
        preview: null,
      };
      const url = result?.info?.thumburl || result?.info?.url;
      if (url && !result?.info?.mime?.startsWith('video')) {
        try {
          const response = await politeFetch(url, { accept: 'image/*' });
          const file = path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`);
          await sharp(Buffer.from(await response.arrayBuffer()))
            .rotate()
            .resize({ width: previewWidth, withoutEnlargement: true })
            .jpeg({ quality: 78 })
            .toFile(file);
          entry.preview = file;
        } catch (error) {
          entry.reason ||= `preview failed (${error.status ?? error.message})`;
        }
      }
      entries[i] = entry;
    },
  );

  const sheet = path.join(outDir, manifest, `${photo.id}.jpg`);
  await contactSheet(entries, sheet, photo);
  await writeFile(
    path.join(outDir, manifest, `${photo.id}.json`),
    `${JSON.stringify({ id: photo.id, place: photo.place ?? '', use: photo.use ?? '', candidates: entries }, null, 2)}\n`,
  );
  sheets.push({ id: photo.id, sheet, entries });
});

sheets.sort((a, b) => a.id.localeCompare(b.id));
for (const { id, sheet, entries } of sheets) {
  console.log(`\n${id} → ${path.relative(ROOT, sheet)}`);
  for (const e of entries) console.log(`  ${e.ok ? '✓' : '✗'} ${e.n}. ${e.title}  ${e.size}  ${e.license}${e.reason ? `  — ${e.reason}` : ''}`);
}

/** A grid of previews with a caption strip under each (index, title, size, licence, verdict). */
async function contactSheet(entries, file, photo) {
  const layout = contactSheetLayout(entries.length, { tile: TILE, label: LABEL });
  const header = 56;
  const composites = [];
  const captions = [];
  for (const [i, e] of entries.entries()) {
    const { x, y } = layout.cells[i];
    const top = y + header;
    if (e.preview) {
      const tile = await sharp(e.preview).resize({ width: TILE, height: TILE, fit: 'contain', background: '#1b1a17' }).toBuffer();
      composites.push({ input: tile, left: x, top });
    }
    const mark = e.ok ? '✓' : '✗';
    const color = e.ok ? '#7fd18b' : '#ff8a7a';
    const title = e.title.replace(/^File:/, '');
    captions.push(
      `<rect x="${x}" y="${top}" width="${TILE}" height="${TILE}" fill="none" stroke="${e.chosen ? '#f4a516' : '#3a372f'}" stroke-width="${e.chosen ? 6 : 1}"/>`,
      `<text x="${x}" y="${top + TILE + 22}" fill="${color}" font-size="17" font-weight="700">${mark} ${e.n}${e.chosen ? ' · chosen' : ''}</text>`,
      `<text x="${x + 70}" y="${top + TILE + 22}" fill="#f3eee4" font-size="15">${xmlEscape(title.length > 38 ? `${title.slice(0, 37)}…` : title)}</text>`,
      `<text x="${x}" y="${top + TILE + 44}" fill="#cfc8b8" font-size="14">${xmlEscape([e.size, e.license].filter(Boolean).join(' · '))}</text>`,
      `<text x="${x}" y="${top + TILE + 64}" fill="#a49d8e" font-size="13">${xmlEscape((e.reason || e.author).slice(0, 52))}</text>`,
    );
  }
  const width = layout.width;
  const height = layout.height + header;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="DejaVu Sans, Arial, sans-serif">
<text x="16" y="34" fill="#f3eee4" font-size="22" font-weight="700">${xmlEscape(photo.id)}</text>
<text x="${16 + photo.id.length * 13 + 16}" y="34" fill="#a49d8e" font-size="16">${xmlEscape([photo.use, photo.place].filter(Boolean).join(' · '))}</text>
${captions.join('\n')}
</svg>`;
  await sharp({ create: { width, height, channels: 3, background: '#12110e' } })
    .composite([...composites, { input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ quality: 82 })
    .toFile(file);
}
