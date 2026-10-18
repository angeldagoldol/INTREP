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
 * the next run carries on from there. The launcher asks the download to stop
 * over an IPC channel rather than with a signal, which on Windows would end
 * it before it saved its last photos.
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

/** A Node process for `args` (this same Node, no shell: the same on Windows, macOS and Linux). */
function start(args, options) {
  return spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', ...options });
}

const running = (child) => Boolean(child) && child.exitCode === null && child.signalCode === null;

const vite = start([viteBin, ...process.argv.slice(2)]);
let photos = null;
const timer = setTimeout(() => {
  if (process.env.TABI_SKIP_PHOTOS === '1') return;
  // stdin stays Vite's (its keyboard shortcuts); the IPC channel lets us ask the download to stop.
  photos = start([fetchScript, '--auto', '--dev'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  photos.on('error', () => {});
}, DOWNLOAD_DELAY_MS);

/** How long the download may take to save what it has and exit before it is stopped outright. */
const STOP_GRACE_MS = 4000;

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  // A terminal's Ctrl+C reaches every process in it already; this covers a plain `kill` of the launcher, and `q` in Vite.
  if (running(vite)) vite.kill(signal);
  if (running(photos)) {
    // Asked, not signalled: on Windows a signal sent to a child process ends it on the spot, and the
    // download should save its last photos first. Signalled only if it has not stopped in time.
    if (photos.connected) photos.send({ type: 'stop' }, () => {});
    else photos.kill(signal);
    setTimeout(() => {
      if (running(photos)) photos.kill('SIGTERM');
    }, STOP_GRACE_MS).unref();
  }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal === 'SIGHUP' ? 'SIGTERM' : signal));
// Whoever started us (npm, an editor's task runner) went away without passing its signal on: stop too,
// rather than leave a dev server running in the background.
const parent = process.ppid;
setInterval(() => {
  if (process.ppid !== parent) stop('SIGTERM');
}, 1000).unref();

vite.on('error', (error) => {
  console.error(`Could not start Vite: ${error.message}`);
  stop('SIGTERM');
  process.exitCode = 1;
});
vite.on('exit', (code, signal) => {
  // Vite is done (q, Ctrl+C, or it failed): stop the download too — it saves what it has and resumes next time.
  stop('SIGTERM');
  const finish = () => process.exit(code ?? (signal ? 0 : 1));
  if (running(photos)) {
    photos.on('exit', finish);
    setTimeout(finish, STOP_GRACE_MS + 2000).unref();
  } else finish();
});
