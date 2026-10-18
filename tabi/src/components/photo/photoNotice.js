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
/** Why a download stopped early: no connection, Commons turned it away, Commons was busy, or its image tool (sharp) could not load. */
const REASONS = new Set(['offline', 'refused', 'busy', 'tools']);
const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

/** The dev server's report of the background photo download (scripts/build/photo-status.mjs), checked; or null. */
export function downloadStatus(value) {
  if (!value || typeof value !== 'object' || !STATES.has(value.state)) return null;
  return { state: value.state, reason: REASONS.has(value.reason) ? value.reason : '', done: count(value.done), total: count(value.total), published: count(value.published) };
}

/** What the terminal's download needs, when it stopped early (development only). */
const DOWNLOAD_HINTS = {
  offline: 'The download in your terminal couldn’t connect either: once you’re online, run npm run photos:fetch (or restart npm run dev).',
  refused: 'Wikimedia Commons turned away the download in your terminal; it says there what to do (usually: add your e-mail in PHOTOS_CONTACT), then run npm run photos:fetch.',
  busy: 'Wikimedia Commons was busy, so the download in your terminal stopped for now: run npm run photos:fetch a little later (or restart npm run dev).',
  tools: 'The download in your terminal couldn’t start its image tool: run npm install again, then npm run photos:fetch.',
};

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
  const art = 'The patterned pictures are placeholder art, not photographs.';
  const why = {
    off: `${art} “Load photos from Wikimedia Commons” is switched off.`,
    offline: `${art} The real photos come from Wikimedia Commons: connect to the internet and they will appear.`,
    blocked: `${art} This browser couldn’t reach Wikimedia Commons, where the photos come from (no internet, or it is blocked).`,
    failed: `${art} Wikimedia Commons didn’t send the photos this time.`,
  }[reason];

  if (download?.state === 'running' && download.total > 0) {
    return {
      title: 'Real photos are on their way',
      body: reason === 'off' ? why : `${art} This browser couldn’t load them from Wikimedia Commons itself.`,
      hint: `Your terminal is downloading the real photos right now (${Math.min(download.done, download.total)} of ${download.total}). They replace the art here by themselves.`,
      action: reason === 'off' ? 'enable' : null,
    };
  }
  let hint = '';
  if (download?.state === 'offline') {
    hint = DOWNLOAD_HINTS[download.reason] ?? DOWNLOAD_HINTS.offline;
  } else if (download?.state === 'stopped' && download.reason === 'tools') {
    hint = DOWNLOAD_HINTS.tools;
  } else if (total > 0 && bundled < total) {
    hint = 'On your computer, npm run photos:fetch (also part of npm run dev and npm run build) saves the real photos with the site once, so they show even offline.';
  }
  return { title: TITLES[reason], body: why, hint, action: reason === 'off' ? 'enable' : reason === 'offline' ? null : 'retry' };
}
