/**
 * Namespaced, failure-tolerant localStorage helpers.
 * Private windows, full quotas and disabled storage all degrade to in-memory
 * defaults instead of crashing the app.
 */
const PREFIX = 'tabi:';

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable — nothing to remove */
  }
}
