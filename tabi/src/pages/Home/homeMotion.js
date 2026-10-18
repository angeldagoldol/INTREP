import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'framer-motion';
import { readStorage, writeStorage } from '../../lib/storage.js';

/**
 * The Home page's "Pause motion" switch (WCAG 2.2.2): one place that stops
 * every ambient loop — the word marquee, falling petals, the compass ring,
 * the clock's pulse, the season emblem, the "how it works" sketches and the
 * postcard autoplay. Kept outside React's tree (like navState.js) so any
 * section can read it without a provider, and remembered in `tabi:motion`
 * ('auto' | 'paused') so a visitor who paused it is not greeted by motion
 * again next time. The OS reduced-motion setting is separate and always wins.
 */
const KEY = 'motion';
const listeners = new Set();
let paused = null; // read from storage on first use

function read() {
  if (paused === null) paused = readStorage(KEY, 'auto') === 'paused';
  return paused;
}

function update(next) {
  if (next === read()) return;
  paused = next;
  listeners.forEach((listener) => listener());
}

// Another tab paused or resumed: follow it.
function onStorage(event) {
  if (event.storageArea !== window.localStorage) return;
  if (event.key === null || event.key === `tabi:${KEY}`) update(readStorage(KEY, 'auto') === 'paused');
}

function subscribe(listener) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Pause (true) or resume (false) the Home page's ambient motion. */
export function setMotionPaused(value) {
  const next = Boolean(value);
  if (next === read()) return;
  writeStorage(KEY, next ? 'paused' : 'auto');
  update(next);
}

/** True while the visitor has paused the Home page's motion. */
export function useMotionPaused() {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** True when ambient loops should rest: OS reduced motion, or paused by the visitor. */
export function useStill() {
  const reduce = useReducedMotion();
  const pausedByVisitor = useMotionPaused();
  return Boolean(reduce) || pausedByVisitor;
}
