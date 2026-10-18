import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { ImageOff, X } from 'lucide-react';
import { bundledCount, livePhotos, subscribePhotos } from '../../data/photos/index.js';
import { setLivePhotosEnabled } from '../../data/photos/liveSetting.js';
import { NOTICE_SESSION_KEY, downloadStatus, noticeText, placeholderReason } from './photoNotice.js';
import styles from './PhotoNotice.module.css';

/** How long a reason must hold before the notice appears (no flash while a lookup settles). */
const SETTLE_MS = 1200;
const STATUS_PATH = '/__tabi/photo-status';
const STATUS_EVENT = 'tabi:photo-status';

function readSession() {
  try {
    return window.sessionStorage.getItem(NOTICE_SESSION_KEY);
  } catch {
    return null;
  }
}

function markShown() {
  try {
    window.sessionStorage.setItem(NOTICE_SESSION_KEY, 'shown');
  } catch {
    /* storage disabled: it may show again after a reload, which is fine */
  }
}

/** Commands in the text set as code: "run npm run photos:fetch" → run <code>npm run photos:fetch</code>. */
function withCommands(text) {
  return text.split(/(npm run [a-z:-]+)/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

/** Everything the notice depends on, as one comparable string (useSyncExternalStore needs a stable snapshot). */
function snapshot() {
  const { bundled, total } = bundledCount();
  return JSON.stringify({ ...livePhotos.health(), bundled, total });
}

/**
 * Development only: what the background photo download of `npm run dev` is
 * doing (the dev server forwards .cache/photo-fetch/status.json). Null in a
 * production build, where import.meta.hot does not exist.
 */
function useDownloadStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const hot = import.meta.hot;
    if (!import.meta.env.DEV || !hot || import.meta.env.MODE === 'test') return undefined;
    let alive = true;
    fetch(STATUS_PATH, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => alive && setStatus(downloadStatus(value)))
      .catch(() => {});
    const onStatus = (value) => setStatus(downloadStatus(value));
    hot.on(STATUS_EVENT, onStatus);
    return () => {
      alive = false;
      hot.off?.(STATUS_EVENT, onStatus);
    };
  }, []);
  return status;
}

/**
 * One small, dismissible notice — at most once per browser session — for
 * when photo slots show the generative placeholder art because the real
 * photographs could not load (offline, Wikimedia Commons blocked or
 * unreachable, live photos switched off) and they are not bundled with the
 * site. It says why and how to get them: connect, try again, switch live
 * photos on, or run `npm run photos:fetch`; during `npm run dev` it follows
 * the background download instead. It goes away by itself once the photos
 * are there. Lazy-loaded by AppShell (it needs the photo registry); logs nothing.
 */
export default function PhotoNotice() {
  const [seen] = useState(() => readSession() !== null);
  // 'waiting' → 'shown' → 'closed' (dismissed, or the photos it was about arrived): once per session.
  const [phase, setPhase] = useState('waiting');
  const [settled, setSettled] = useState(null);
  const state = JSON.parse(useSyncExternalStore(subscribePhotos, snapshot, snapshot));
  const download = useDownloadStatus();
  const reason = placeholderReason(state);
  const missing = (state.asked ?? 0) - (state.ready ?? 0);
  const titleId = useId();

  // Only a reason that holds for a moment counts.
  useEffect(() => {
    if (!reason) return undefined;
    const timer = setTimeout(() => setSettled(reason), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [reason]);

  // Derived during render (React's "adjust state when inputs change" pattern).
  const due = !seen && Boolean(reason) && settled === reason;
  if (phase === 'waiting' && due) setPhase('shown');
  if (phase === 'shown' && missing <= 0) setPhase('closed');
  useEffect(() => {
    if (phase === 'shown') markShown();
  }, [phase]);

  const visible = phase === 'shown' && due;
  if (!visible) return null;
  const text = noticeText(reason, { download, bundled: state.bundled, total: state.total });
  if (!text) return null;

  return (
    <aside className={styles.notice} aria-labelledby={titleId} data-reason={reason}>
      <span className={styles.icon} aria-hidden="true">
        <ImageOff size={16} strokeWidth={2} />
      </span>
      <div className={styles.body} role="status">
        <p id={titleId} className={styles.title}>
          {text.title}
        </p>
        <p className={styles.text}>{text.body}</p>
        {text.hint && <p className={styles.hint}>{withCommands(text.hint)}</p>}
      </div>
      <button type="button" className={styles.close} onClick={() => setPhase('closed')} aria-label="Dismiss the photo notice">
        <X size={16} aria-hidden="true" />
      </button>
      {text.action && (
        <div className={styles.actions}>
          {text.action === 'enable' ? (
            <button type="button" className={styles.action} onClick={() => setLivePhotosEnabled(true)}>
              Turn photo loading on
            </button>
          ) : (
            <button type="button" className={styles.action} onClick={() => livePhotos.resume()}>
              Try again
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
