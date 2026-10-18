#!/usr/bin/env node
/**
 * `npm run dev`: starts Vite straight away and, beside it, downloads the real
 * photographs of Japan from Wikimedia Commons into public/photos — on the
 * first run, or whenever a manifest lists a photo this computer does not have
 * yet (otherwise it checks the files on disk, says so in one line and asks
 * nothing of the network). The open page swaps its placeholder art for the
 * photos as they arrive (scripts/photos/fetch.mjs publishes them in a few
 * batches; src/data/photos/index.js takes them in without a reload).
 *
 *   npm run dev                       # Vite + the photo download
 *   npm run dev -- --port 3000        # arguments go to Vite
 *   npm run dev:vite                  # Vite alone
 *
 * Offline, the download prints a short warning and stops; Vite keeps running.
 * Ctrl+C (or `q` in Vite) stops both; photos downloaded so far are kept and
 * the next run carries on from there.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const fetchScript = path.join(ROOT, 'scripts', 'photos', 'fetch.mjs');
/** Let Vite print its address first, so the photo lines come after it. */
const DOWNLOAD_DELAY_MS = 1200;

const children = new Set();
function start(args, options) {
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', ...options });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}

const vite = start([viteBin, ...process.argv.slice(2)]);
let photos = null;
const timer = setTimeout(() => {
  if (process.env.TABI_SKIP_PHOTOS === '1') return;
  photos = start([fetchScript, '--auto', '--dev'], { stdio: ['ignore', 'inherit', 'inherit'] });
  photos.on('error', () => {});
}, DOWNLOAD_DELAY_MS);

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  // A terminal's Ctrl+C reaches every process in it already; this covers a plain `kill` of the launcher.
  for (const child of children) if (child.exitCode === null) child.kill(signal);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal === 'SIGHUP' ? 'SIGTERM' : signal));

vite.on('error', (error) => {
  console.error(`Could not start Vite: ${error.message}`);
  stop('SIGTERM');
  process.exitCode = 1;
});
vite.on('exit', (code, signal) => {
  // Vite is done (q, Ctrl+C, or it failed): stop the download too — it saves what it has and resumes next time.
  stop('SIGTERM');
  const finish = () => process.exit(code ?? (signal ? 0 : 1));
  if (photos && photos.exitCode === null && photos.signalCode === null) {
    photos.on('exit', finish);
    setTimeout(finish, 5000).unref();
  } else finish();
});
