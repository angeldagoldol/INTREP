import { useSyncExternalStore } from 'react';

/**
 * The navbar's visibility, shared outside React's tree so sticky page
 * toolbars (the Library's filter bar) can slide into its place while it is
 * tucked away, without re-rendering the shell on every scroll.
 * The <Navbar> is the only writer.
 */
let hidden = false;
const listeners = new Set();

export function setNavHidden(value) {
  const next = Boolean(value);
  if (next === hidden) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the site navbar is tucked away above the viewport. */
export function useNavHidden() {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}
