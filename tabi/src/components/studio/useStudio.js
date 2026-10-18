import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createStudioState, studioReducer } from './studioReducer.js';
import { writeDraft } from './draftStore.js';

/**
 * Studio document state. `dispatch` stamps each action with the current time
 * so the pure reducer can coalesce rapid typing into one undo step.
 */
export function useStudio(initialDoc, initialSelectedId) {
  const [state, rawDispatch] = useReducer(studioReducer, null, () =>
    createStudioState(initialDoc, initialSelectedId),
  );
  const dispatch = useCallback((action) => rawDispatch({ ...action, at: Date.now() }), []);
  return [state, dispatch];
}

/**
 * Debounced autosave of `draft` ({ doc, selectedId }) to a storage key.
 * The value it starts with counts as already saved. Pending work is flushed
 * on visibilitychange → hidden, on pagehide and when the editor unmounts,
 * so nothing typed is lost.
 * Returns { saving, savedAt, error, flush, discard }.
 */
export function useAutosave(key, draft, { delay = 600, enabled = true, initialSavedAt = 0 } = {}) {
  const [saved, setSaved] = useState({ draft, at: initialSavedAt, ok: true });
  const pending = useRef(null);
  const active = useRef(enabled);

  useEffect(() => {
    active.current = enabled;
  }, [enabled]);

  const save = useCallback(
    (value) => {
      pending.current = null;
      const at = Date.now();
      setSaved({ draft: value, at, ok: writeDraft(key, value, at) });
    },
    [key],
  );

  useEffect(() => {
    if (!enabled || draft === saved.draft) return undefined;
    pending.current = draft;
    const timer = setTimeout(() => save(draft), delay);
    return () => clearTimeout(timer);
  }, [draft, saved.draft, enabled, delay, save]);

  // Flush on visibilitychange → hidden (switching apps on a phone, where the
  // OS may discard the tab with no pagehide), on pagehide, and on unmount
  // (navigation away mid-debounce).
  useEffect(() => {
    const flushPending = () => {
      if (pending.current && active.current) writeDraft(key, pending.current, Date.now());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushPending);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [key]);

  const flush = useCallback(() => {
    if (active.current) save(draft);
  }, [draft, save]);

  /** Stop saving for good (after publishing or deleting). */
  const discard = useCallback(() => {
    active.current = false;
    pending.current = null;
  }, []);

  return {
    saving: enabled && draft !== saved.draft,
    savedAt: saved.at,
    error: !saved.ok,
    flush,
    discard,
  };
}

/** Current time, refreshed every `interval` ms — for "saved 3 min ago" labels. */
export function useNow(interval = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
