#!/usr/bin/env node
/**
 * Adds a photo you own or have a licence for, through the same resize / LQIP /
 * colour pipeline as the Commons fetch — the fallback when Commons is out of
 * reach. The photo id should be one listed in a manifest (that is where its
 * alt text and caption come from).
 *
 *   npm run photos:import -- ~/Pictures/inari.jpg --id kyoto-senbon-torii \
 *     --author "Jane Doe" --license "CC BY-SA 4.0" \
 *     --license-url https://creativecommons.org/licenses/by-sa/4.0/ \
 *     --source https://commons.wikimedia.org/wiki/File:Example.jpg
 *
 * For a photo that is not under a free licence (your own picture, or one used
 * with permission) pass --license "© Jane Doe, used with permission" plus
 * --permission to confirm you hold the rights to publish it.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { attributionRequired, buildRecord, classifyLicense, cleanLicenseUrl, parseArgs } from './lib.mjs';
import { PUBLIC_DIR, ROOT, loadGenerated, loadManifests, saveGenerated } from './io.mjs';
import { processImage } from './process.mjs';

const USAGE =
  'Usage: npm run photos:import -- <image> --id <photo-id> --author <name> --license <licence> [--license-url <url>] [--source <url>] [--author-url <url>] [--title <title>] [--permission] [--dry-run]';

let opts;
try {
  opts = parseArgs(process.argv.slice(2), { boolean: ['permission', 'dry-run', 'help'], string: ['id', 'author', 'author-url', 'license', 'license-url', 'source', 'title'] });
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(1);
}
if (opts.help) {
  console.log(USAGE);
  process.exit(0);
}

const [input] = opts._;
const fail = (message) => {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
};
if (!input) fail('Which image? Pass a file path.');
for (const key of ['id', 'author', 'license']) if (typeof opts[key] !== 'string' || !opts[key].trim()) fail(`--${key} is required.`);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.id)) fail('--id must be kebab-case, e.g. kyoto-senbon-torii');

const httpUrl = (value, flag) => {
  if (value === undefined) return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    // fall through
  }
  return fail(`${flag} must be an http(s) URL`);
};
const sourceUrl = httpUrl(opts.source, '--source');
const authorUrl = httpUrl(opts.authorUrl, '--author-url');

const license = classifyLicense(opts.license);
if (!license.ok && !opts.permission) {
  fail(
    `"${opts.license}" is not one of the accepted free licences (CC0, public domain, CC BY, CC BY-SA). If you own the photo or have permission to publish it, add --permission.`,
  );
}
// CC BY / BY-SA credits link the licence: the given URL, else the deed for the version named.
const licenseUrl = cleanLicenseUrl(httpUrl(opts.licenseUrl, '--license-url')) || (license.ok ? (license.url ?? '') : '');
if ((license.kind === 'cc-by' || license.kind === 'cc-by-sa') && !licenseUrl) fail(`Which version of ${opts.license}? Name it (e.g. "CC BY-SA 4.0") or pass --license-url.`);

const file = path.resolve(process.cwd(), input);
try {
  await stat(file);
} catch {
  fail(`No such file: ${file}`);
}

// Read the registry first: a broken file stops the import before anything is written.
let generated;
try {
  generated = await loadGenerated();
} catch (error) {
  fail(error.message);
}

const manifests = await loadManifests();
const listed = manifests.some((m) => m.photos.some((p) => p.id === opts.id));
if (!listed) console.warn(`! "${opts.id}" is not in any manifest yet: it will have no alt text or caption until one lists it.`);

const out = await processImage(await readFile(file), opts.id, { outDir: PUBLIC_DIR, dryRun: opts.dryRun });
const record = buildRecord({
  id: opts.id,
  file: `local:${path.basename(file)}`,
  ...out,
  credit: {
    title: typeof opts.title === 'string' ? opts.title.trim() : '',
    author: opts.author.trim(),
    authorUrl,
    license: opts.license.trim(),
    licenseUrl,
    sourceUrl,
    attributionRequired: license.ok ? attributionRequired(license.kind) : true,
  },
  fetchedAt: new Date().toISOString(),
});

if (opts.dryRun) {
  console.log(JSON.stringify({ ...record, lqip: `${record.lqip.slice(0, 40)}…` }, null, 2));
  process.exit(0);
}
generated[opts.id] = record;
await saveGenerated(generated);
console.log(`✓ ${opts.id}: ${out.widths.join('/')}w → ${path.relative(ROOT, PUBLIC_DIR)}/ · ${record.license} · ${record.author}`);
