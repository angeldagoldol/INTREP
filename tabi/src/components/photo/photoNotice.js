/**
 * The photo notice (PhotoNotice.jsx): when the pictures on screen are the
 * generative placeholder art rather than photographs, say so once, say why,
 * and say how to get the photos. Pure — tested in photoNotice.test.js.
 *
 *   placeholderReason(livePhotos.health())   // 'off' | 'offline' | 'blocked' | 'failed' | null
 *   noticeText(reason, { download, bundled, total })  // { title, body, hint, action }
 */

/** sessionStorage key: set once the notice has been shown this session (it never comes back). */
export const NOTICE_SESSION_KEY = 'tabi:photo-notice';

/**
 * Why photo slots on screen show art, from the live resolver's health
 * (data/photos/live.js): live photos are switched off, the browser is
 * offline, Commons could not be reached (a network, firewall or content
 * blocker), or every lookup failed. Null when nothing is missing — bundled
 * photos never count, they are always there — or while photos are still
 * on their way.
 */
export function placeholderReason(health) {
  if (!health || !health.transport) return null;
  const missing = (health.asked ?? 0) - (health.ready ?? 0);
  if (missing <= 0) return null;
  if (!health.enabled) return 'off';
  if (!health.online) return 'offline';
  if (health.blocked) return 'blocked';
  if (!health.loading && !health.waiting && !health.ready && (health.failed ?? 0) >= 3) return 'failed';
  return null;
}

const STATES = new Set(['running', 'done', 'offline', 'stopped']);
const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

/** The dev server's report of the background photo download (scripts/build/photo-status.mjs), checked; or null. */
export function downloadStatus(value) {
  if (!value || typeof value !== 'object' || !STATES.has(value.state)) return null;
  return { state: value.state, done: count(value.done), total: count(value.total), published: count(value.published) };
}

const TITLES = {
  off: 'Photo loading is switched off',
  offline: 'You’re offline',
  blocked: 'The photos couldn’t load',
  failed: 'The photos couldn’t load',
};

/**
 * What the notice says. `download` is downloadStatus() (development only);
 * `bundled`/`total` count the photos that come with the site.
 * → { title, body, hint, action: 'enable' | 'retry' | null }
 */
export function noticeText(reason, { download = null, bundled = 0, total = 0 } = {}) {
  if (!reason) return null;
  const art = 'The patterned pictures you see are placeholder art, not photographs.';
  const why = {
    off: `${art} “Load photos from Wikimedia Commons” is off, so only the photos that come with the site are shown.`,
    offline: `${art} The real photos come from Wikimedia Commons: connect to the internet and they will appear.`,
    blocked: `${art} This browser couldn’t reach Wikimedia Commons, where the photos come from — check your internet connection (or a content blocker), then try again.`,
    failed: `${art} Wikimedia Commons didn’t send the photos this time — try again in a moment.`,
  }[reason];

  let hint = '';
  if (download?.state === 'running' && download.total > 0) {
    hint = `Your terminal is downloading the real photos right now (${Math.min(download.done, download.total)} of ${download.total}). They replace the art here by themselves.`;
  } else if (download?.state === 'offline') {
    hint = 'The photo download in your terminal couldn’t connect either. Once you’re online, run npm run photos:fetch (or restart npm run dev).';
  } else if (total > 0 && bundled < total) {
    hint = 'Running Tabi on your computer? Run npm run photos:fetch once (it also runs with npm run dev and npm run build) to save the real photos with the site, so they show even offline.';
  }
  return { title: TITLES[reason], body: why, hint, action: reason === 'off' ? 'enable' : reason === 'offline' ? null : 'retry' };
}
