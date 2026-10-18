// Build Tabi 旅 (the Japan brochure app in ./tabi) into dist/tabi so the same
// Vercel deployment serves it at /tabi/ next to the storefront.
//
// Runs after build-storefront.mjs. Tabi's own `npm run build` first downloads
// the real Wikimedia Commons photos (its prebuild step), which works here
// because Vercel's build machines have internet access. If the photo download
// fails, Tabi still builds and its pages show their drawn placeholders.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = 'tabi';
const OUT_DIR = join(process.env.STOREFRONT_OUT || 'dist', 'tabi');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  console.log(`\n▸ (${APP_DIR}) npm ${args.join(' ')}`);
  const result = spawnSync(npm, args, { cwd: APP_DIR, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in ${APP_DIR} (exit ${result.status ?? result.signal}).`);
  }
}

if (!existsSync(join(APP_DIR, 'package.json'))) {
  throw new Error(`${APP_DIR}/package.json not found — is the Tabi app checked in?`);
}

run(['ci', '--no-audit', '--no-fund']);
run(['run', 'build']);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
cpSync(join(APP_DIR, 'dist'), OUT_DIR, { recursive: true });
console.log(`\n✓ Tabi built into ${OUT_DIR} — served at /tabi/`);
