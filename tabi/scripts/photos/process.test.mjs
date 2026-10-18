// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processImage } from './process.mjs';

/** A synthetic test card (never a "real" photo): two colour fields and a stripe. */
async function testImage(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#c4321c"/><rect y="${height * 0.6}" width="100%" height="${height * 0.4}" fill="#1d4f7a"/>
    <rect x="${width * 0.45}" width="${width * 0.1}" height="100%" fill="#f3eee4"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

let dir;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'tabi-photos-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('processImage', () => {
  it('writes WebP at 480/960/1600, an LQIP data URI and the dominant colour', async () => {
    const out = await processImage(await testImage(2048, 1365), 'test-card', { outDir: dir });
    expect(out.widths).toEqual([480, 960, 1600]);
    expect(out).toMatchObject({ width: 1600, height: 1066 });
    expect(out.lqip).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    expect(out.lqip.length).toBeLessThan(1200);
    expect(out.color).toMatch(/^#[0-9a-f]{6}$/);
    expect((await readdir(dir)).sort()).toEqual(['test-card-1600.webp', 'test-card-480.webp', 'test-card-960.webp']);
    const meta = await sharp(path.join(dir, 'test-card-960.webp')).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 960, height: 640 });
  });

  it('never upscales and removes widths it no longer makes', async () => {
    await writeFile(path.join(dir, 'test-card-2-480.webp'), 'other id, keep');
    const out = await processImage(await testImage(1100, 1650), 'test-card', { outDir: dir });
    expect(out.widths).toEqual([480, 960, 1100]);
    expect(out).toMatchObject({ width: 1100, height: 1650 });
    expect((await readdir(dir)).sort()).toEqual(['test-card-1100.webp', 'test-card-2-480.webp', 'test-card-480.webp', 'test-card-960.webp']);
  });

  it('turns photos upright from their EXIF orientation before planning widths', async () => {
    // Stored landscape (2000×1000) with orientation 6: displayed as a 1000×2000 portrait.
    const sideways = await sharp(await testImage(2000, 1000)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const out = await processImage(sideways, 'upright-card', { outDir: dir });
    expect(out.widths).toEqual([480, 960]);
    expect(out).toMatchObject({ width: 960, height: 1920 });
    expect(await sharp(path.join(dir, 'upright-card-960.webp')).metadata()).toMatchObject({ width: 960, height: 1920 });
  });

  it('writes nothing on a dry run', async () => {
    const out = await processImage(await testImage(800, 600), 'dry-card', { outDir: dir, dryRun: true });
    expect(out.widths).toEqual([480, 800]);
    expect((await readdir(dir)).some((n) => n.startsWith('dry-card'))).toBe(false);
  });
});
