// Build Tabi 旅 (the Japan brochure app in ./tabi) into dist/tabi so the same
// Vercel deployment serves it at /tabi/ next to the storefront.
//
// Runs after build-storefront.mjs:
//   1. npm ci inside tabi/
//   2. Download the real Wikimedia Commons photos (Vercel's build machines
//      have internet). Wikimedia throttles busy clients, so the download gets
//      a time budget (TABI_PHOTOS_BUDGET_MIN, default 12 minutes). When the
//      budget runs out it is stopped politely: every photo downloaded so far
//      is kept and ships with the site, and any photo still missing is loaded
//      live from Wikimedia in the visitor's browser instead.
//   3. vite build (with the photo step skipped, since step 2 already ran).
//   4. Copy tabi/dist to dist/tabi.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = 'tabi';
const OUT_DIR = join(process.env.STOREFRONT_OUT || 'dist', 'tabi');
const BUDGET_MIN = Number(process.env.TABI_PHOTOS_BUDGET_MIN) || 12;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, env = process.env) {
  console.log(`\n▸ (${APP_DIR}) ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: APP_DIR, stdio: 'inherit', env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${APP_DIR} (exit ${result.status ?? result.signal}).`);
  }
}

/** Run the photo download with a time budget. Never throws: photos are optional for the build. */
function downloadPhotos() {
  console.log(`\n▸ (${APP_DIR}) downloading real photos (time budget ${BUDGET_MIN} min)`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/photos/fetch.mjs', '--auto'], { cwd: APP_DIR, stdio: 'inherit' });
    let killTimer;
    const budgetTimer = setTimeout(() => {
      console.log(`\n▸ Photo download reached its ${BUDGET_MIN}-minute budget: saving what has arrived and moving on.`);
      child.kill('SIGINT'); // the downloader keeps everything finished so far on the first signal
      killTimer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    }, BUDGET_MIN * 60_000);
    child.on('exit', (code, signal) => {
      clearTimeout(budgetTimer);
      clearTimeout(killTimer);
      console.log(`▸ Photo download finished (${signal ?? `exit ${code}`}).`);
      resolve();
    });
    child.on('error', (error) => {
      clearTimeout(budgetTimer);
      console.log(`▸ Photo download could not start: ${error.message}`);
      resolve();
    });
  });
}

if (!existsSync(join(APP_DIR, 'package.json'))) {
  throw new Error(`${APP_DIR}/package.json not found — is the Tabi app checked in?`);
}

run(npm, ['ci', '--no-audit', '--no-fund']);
await downloadPhotos();
// The download already ran above, so the app's own prebuild photo step is skipped.
run(npm, ['run', 'build'], { ...process.env, TABI_SKIP_PHOTOS: '1' });

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
cpSync(join(APP_DIR, 'dist'), OUT_DIR, { recursive: true });
console.log(`\n✓ Tabi built into ${OUT_DIR} — served at /tabi/`);
