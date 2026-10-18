import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, Info, X } from 'lucide-react';
import { spring } from '../lib/motion.js';
import styles from './Toast.module.css';

const ToastContext = createContext(null);
const ICONS = { success: Check, error: CircleAlert, default: Info };
/** How long the announcer keeps a toast's text: long enough to be queued, short
    enough that browsing the landmark doesn't meet it twice. */
export const ANNOUNCE_MS = 1000;

/**
 * App-wide toasts.
 *   const toast = useToast();
 *   toast({ title: 'Saved', description: 'Your brochure is live.', tone: 'success' });
 * tone: 'default' | 'success' | 'error'; duration in ms (default 4200, or
 * 10000 when there is an action to reach; 0 = sticky). Hovering or focusing
 * a toast pauses its clock (WCAG 2.2.1), and it resumes when you leave.
 * action: optional { label, onClick } button inside the toast. Returns the toast id.
 *
 * Screen readers hear each toast once, through one of two persistent live
 * regions (polite, or assertive for errors) that hold its text for a moment.
 * The visible list itself is not live, so no live region sits inside another
 * and its action stays reachable in the "Notifications" landmark.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // The latest toast's text for the screen-reader announcer: { id, text, assertive }.
  const [announcement, setAnnouncement] = useState(null);
  // id → { timer, remaining, started }: a timed toast's clock, so it can pause.
  const timers = useRef(new Map());
  // Toasts render into the fullscreen element while one is active (the
  // reader's fullscreen mode); anything portalled to <body> would be hidden.
  const [host, setHost] = useState(() => document.fullscreenElement ?? document.body);

  useEffect(() => {
    const onChange = () => setHost(document.fullscreenElement ?? document.webkitFullscreenElement ?? document.body);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!announcement) return undefined;
    const timer = setTimeout(() => setAnnouncement(null), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [announcement]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id)?.timer);
    timers.current.delete(id);
  }, []);

  /** Run (or resume) a toast's clock. */
  const resume = useCallback(
    (id) => {
      const clock = timers.current.get(id);
      if (!clock || clock.timer) return;
      clock.started = Date.now();
      clock.timer = setTimeout(() => dismiss(id), clock.remaining);
    },
    [dismiss],
  );

  /** Stop a toast's clock while it is being read or reached; at least 1s is left afterwards. */
  const pause = useCallback((id) => {
    const clock = timers.current.get(id);
    if (!clock?.timer) return;
    clearTimeout(clock.timer);
    clock.timer = null;
    clock.remaining = Math.max(1000, clock.remaining - (Date.now() - clock.started));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'default', duration, action }) => {
      const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const ms = duration ?? (action ? 10_000 : 4200);
      setToasts((list) => [...list.slice(-3), { id, title, description, tone, action }]);
      const text = [title, description].filter(Boolean).join('. ');
      if (text) setAnnouncement({ id, text, assertive: tone === 'error' });
      if (ms > 0) {
        timers.current.set(id, { timer: null, remaining: ms, started: 0 });
        resume(id);
      }
      return id;
    },
    [resume],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className={styles.viewport} role="region" aria-label="Notifications" data-print="hide">
          <ol className={styles.list}>
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const Icon = ICONS[t.tone] ?? Info;
                return (
                  <motion.li
                    key={t.id}
                    layout
                    className={styles.toast}
                    data-tone={t.tone}
                    initial={{ opacity: 0, y: 24, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                    onPointerEnter={() => pause(t.id)}
                    onPointerLeave={(event) => {
                      if (!event.currentTarget.contains(document.activeElement)) resume(t.id);
                    }}
                    onFocus={() => pause(t.id)}
                    onBlur={(event) => {
                      const toastEl = event.currentTarget;
                      if (!toastEl.contains(event.relatedTarget) && !toastEl.matches(':hover')) resume(t.id);
                    }}
                  >
                    <span className={styles.icon} aria-hidden="true">
                      <Icon size={16} strokeWidth={2.25} />
                    </span>
                    <div className={styles.body}>
                      <p className={styles.title}>{t.title}</p>
                      {t.description && <p className={styles.description}>{t.description}</p>}
                      {t.action && (
                        <button
                          type="button"
                          className={styles.action}
                          onClick={() => {
                            t.action.onClick();
                            dismiss(t.id);
                          }}
                        >
                          {t.action.label}
                        </button>
                      )}
                    </div>
                    <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
                      <X size={14} />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
          <div className="sr-only" role="status">
            {announcement && !announcement.assertive && <p key={announcement.id}>{announcement.text}</p>}
          </div>
          <div className="sr-only" role="alert">
            {announcement?.assertive && <p key={announcement.id}>{announcement.text}</p>}
          </div>
        </div>,
        host,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
