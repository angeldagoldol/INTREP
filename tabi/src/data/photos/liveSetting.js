/**
 * The visitor's choice "Load photos from Wikimedia Commons" (on by default),
 * stored as `tabi:live-photos-enabled` and synced across tabs. Off, no photo
 * is requested from Wikimedia and slots without a bundled photo show their
 * generated art. Tiny on purpose: the footer imports it (app entry), while the
 * resolver itself (live.js) loads with the photo registry.
 *
 *   livePhotosEnabled() → boolean
 *   setLivePhotosEnabled(false)
 *   subscribeLivePhotosSetting(listener) → unsubscribe
 * React: useLivePhotosSetting() in components/photo/useLivePhotosSetting.js.
 */
import { readStorage, writeStorage } from '../../lib/storage.js';

export const LIVE_SETTING_KEY = 'live-photos-enabled'; // lib/storage adds the "tabi:" prefix

const listeners = new Set();
let enabled = null;
let watching = false;

function read() {
  return readStorage(LIVE_SETTING_KEY, true) !== false;
}

function emit() {
  for (const listener of [...listeners]) listener();
}

/** True unless the visitor switched live photos off. */
export function livePhotosEnabled() {
  if (enabled === null) enabled = read();
  return enabled;
}

/** Switch live photos on or off (remembered on this device). */
export function setLivePhotosEnabled(value) {
  const next = Boolean(value);
  writeStorage(LIVE_SETTING_KEY, next);
  if (next === livePhotosEnabled()) return;
  enabled = next;
  emit();
}

/** Calls `listener` whenever the setting changes (here or in another tab). */
export function subscribeLivePhotosSetting(listener) {
  listeners.add(listener);
  if (!watching && typeof window !== 'undefined') {
    watching = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== null && event.key !== `tabi:${LIVE_SETTING_KEY}`) return;
      const next = read();
      if (next === enabled) return;
      enabled = next;
      emit();
    });
  }
  return () => listeners.delete(listener);
}
