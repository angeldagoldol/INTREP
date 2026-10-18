/**
 * Vite plugin (dev server only): tells the open page what the background
 * photo download (scripts/photos/fetch.mjs, started by `npm run dev`) is
 * doing, so the app's photo notice can say "downloading… 42 of 213" instead
 * of only "placeholder art". The download writes .cache/photo-fetch/status.json;
 * this plugin serves it at /__tabi/photo-status and pushes every change to the
 * page as the HMR event `tabi:photo-status`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const PHOTO_STATUS_PATH = '/__tabi/photo-status';
export const PHOTO_STATUS_EVENT = 'tabi:photo-status';

/** The status as the page may see it: known fields only; a "running" status left by a stopped process reads "stopped". */
export function readPhotoStatus(file, { alive = defaultAlive } = {}) {
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  const states = ['running', 'done', 'offline', 'stopped'];
  let state = states.includes(json.state) ? json.state : 'stopped';
  if (state === 'running' && !alive(json.pid)) state = 'stopped';
  return { state, done: count(json.done), total: count(json.total), published: count(json.published), missing: count(json.missing), updatedAt: count(json.updatedAt) };
}

function defaultAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export function photoDownloadStatus() {
  let file = path.resolve('.cache/photo-fetch/status.json');
  return {
    name: 'tabi-photo-status',
    apply: 'serve',
    configResolved(config) {
      file = path.resolve(config.root, '.cache/photo-fetch/status.json');
    },
    configureServer(server) {
      if (process.env.VITEST) return;
      server.middlewares.use(PHOTO_STATUS_PATH, (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(readPhotoStatus(file)));
      });
      const send = (changed) => {
        if (path.resolve(changed) !== file) return;
        server.ws.send({ type: 'custom', event: PHOTO_STATUS_EVENT, data: readPhotoStatus(file) });
      };
      server.watcher.add(file);
      server.watcher.on('add', send);
      server.watcher.on('change', send);
    },
  };
}
