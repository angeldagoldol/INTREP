/**
 * Image processing shared by fetch.mjs and import-local.mjs (sharp):
 * resize to the planned widths as WebP, a ~24px blurred LQIP data URI and the
 * dominant colour. Writes public/photos/<id>-<w>.webp and removes stale
 * widths of the same id.
 */
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { OUTPUT_WIDTHS, outputName, ownsOutput, planWidths, scaledHeight, toHex } from './lib.mjs';

export const QUALITY = 72;
export const LQIP_WIDTH = 24;

/**
 * Process one source image (Buffer or path) for photo `id` into `outDir`.
 * Returns { width, height, widths, lqip, color, files } — width/height are the
 * largest output's. With `dryRun` nothing is written.
 */
export async function processImage(input, id, { outDir, widths: targets = OUTPUT_WIDTHS, quality = QUALITY, dryRun = false } = {}) {
  // Every output decodes the original once and is encoded once (no JPEG
  // round trip in between); rotate() applies the EXIF orientation, and sharp
  // converts through any embedded ICC profile to sRGB.
  const meta = await sharp(input, { failOn: 'error' }).metadata();
  const quarterTurn = (meta.orientation ?? 1) >= 5;
  const sourceWidth = quarterTurn ? meta.height : meta.width;
  const sourceHeight = quarterTurn ? meta.width : meta.height;
  const widths = planWidths(sourceWidth, targets);
  if (widths.length === 0 || !sourceHeight) throw new Error('image has no pixels');

  const base = () => sharp(input, { failOn: 'error' }).rotate().toColourspace('srgb');
  const files = [];
  for (const w of widths) {
    const data = await base().resize({ width: w, withoutEnlargement: true }).webp({ quality, effort: 5, smartSubsample: true }).toBuffer();
    const file = path.join(outDir ?? '.', outputName(id, w));
    files.push({ file, width: w, height: scaledHeight(w, sourceWidth, sourceHeight), bytes: data.length });
    if (!dryRun) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    }
  }

  const lqipBuffer = await base().resize({ width: LQIP_WIDTH }).blur(0.6).webp({ quality: 40, effort: 6 }).toBuffer();
  const { dominant } = await base().resize({ width: 64 }).stats();

  if (!dryRun && outDir) await removeStale(outDir, id, widths);

  const largest = files.at(-1);
  return {
    width: largest.width,
    height: largest.height,
    widths,
    lqip: `data:image/webp;base64,${lqipBuffer.toString('base64')}`,
    color: toHex(dominant),
    files,
  };
}

/** Delete outputs of `id` whose width is no longer produced. */
async function removeStale(outDir, id, widths) {
  let names = [];
  try {
    names = await readdir(outDir);
  } catch {
    return;
  }
  const keep = new Set(widths.map((w) => outputName(id, w)));
  await Promise.all(names.filter((name) => ownsOutput(id, name) && !keep.has(name)).map((name) => unlink(path.join(outDir, name))));
}

/** Delete every output of `id` (used when a photo is dropped from all manifests). */
export async function removeOutputs(outDir, id) {
  await removeStale(outDir, id, []);
}
