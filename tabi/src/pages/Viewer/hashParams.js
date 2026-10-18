/**
 * Set (or with `value === null`, remove) one query parameter inside a
 * hash-router URL fragment: "#/brochures/kyoto?p=3" → "#/brochures/kyoto?p=4".
 * Other parameters keep their order.
 */
export function withHashParam(hash, name, value) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const at = raw.indexOf('?');
  const path = at === -1 ? raw : raw.slice(0, at);
  const params = new URLSearchParams(at === -1 ? '' : raw.slice(at + 1));
  if (value === null || value === undefined) params.delete(name);
  else params.set(name, value);
  const query = params.toString();
  return `#${path || '/'}${query ? `?${query}` : ''}`;
}

function safeDecode(path) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * The raw `p` parameter of a hash-router URL, `null` when there is none —
 * or `undefined` when the hash points at another route than `pathname`
 * (compared decoded, so "/brochures/京都" matches its percent-encoded form).
 */
export function pageParamFromHash(hash, pathname) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const at = raw.indexOf('?');
  const path = at === -1 ? raw : raw.slice(0, at);
  if (safeDecode(path || '/') !== safeDecode(String(pathname ?? ''))) return undefined;
  return new URLSearchParams(at === -1 ? '' : raw.slice(at + 1)).get('p');
}

/**
 * Point the address bar's ?p= at `page` without a navigation
 * (history.replaceState keeps the router's state); page 0 drops it.
 */
export function writePageToHash(page) {
  const url = withHashParam(window.location.hash, 'p', page > 0 ? String(page) : null);
  if (url !== window.location.hash) window.history.replaceState(window.history.state, '', url);
}
