import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, motionValue } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { FLAT_LEFT, FLAT_RIGHT } from './flipMath.js';

/** Delay between leaves when several turn at once (a riffle). */
const RIFFLE_DELAY = 0.065;

const targetFor = (index, position) => (index < position ? FLAT_LEFT : FLAT_RIGHT);

function toggled(set, index, on) {
  if (set.has(index) === on) return set;
  const next = new Set(set);
  if (on) next.add(index);
  else next.delete(index);
  return next;
}

/**
 * One rotateY motion value per leaf, driven towards `position` with the
 * paper spring. Every leaf animates independently, so rapid input simply
 * retargets springs mid-flight (keeping their velocity) and big jumps riffle
 * through the leaves in reading order — the book can never get into a broken
 * state. While the pointer holds a leaf, it owns that leaf's angle.
 *
 * Returns { angles, moving, grab, drag, release }. `moving` holds every leaf
 * that is held, animating, or about to turn because `position` changed — it
 * is derived during render, so a leaf never loses its content (or cast
 * shadow) between a position change and the start of its animation.
 * Mount it keyed by leaf count: the motion values are created once.
 */
export function useLeafMotion(leafCount, position) {
  const [angles] = useState(() => Array.from({ length: leafCount }, (_, i) => motionValue(targetFor(i, position))));
  // Where each leaf last came to rest, and which ones are animating or held.
  const [rested, setRested] = useState(() => angles.map((value) => value.get()));
  const [active, setActive] = useState(() => new Set());
  const targets = useRef(null);
  const runs = useRef([]);
  const held = useRef(null);

  const moving = useMemo(() => {
    const set = new Set(active);
    rested.forEach((angle, i) => {
      if (angle !== targetFor(i, position)) set.add(i);
    });
    return set;
  }, [active, rested, position]);

  const markActive = useCallback((index, on) => setActive((prev) => toggled(prev, index, on)), []);

  const markRested = useCallback(
    (index, angle) => {
      markActive(index, false);
      setRested((prev) => (prev[index] === angle ? prev : prev.map((a, i) => (i === index ? angle : a))));
    },
    [markActive],
  );

  const stop = useCallback((index) => {
    runs.current[index]?.animation?.stop();
    runs.current[index] = null;
  }, []);

  const settle = useCallback(
    (index, target, { velocity = 0, delay = 0 } = {}) => {
      stop(index);
      targets.current[index] = target;
      const value = angles[index];
      if (value.get() === target && velocity === 0) {
        markRested(index, target);
        return;
      }
      markActive(index, true);
      const run = {};
      runs.current[index] = run;
      run.animation = animate(value, target, {
        ...spring.page,
        velocity,
        delay,
        onComplete: () => {
          if (runs.current[index] !== run) return;
          runs.current[index] = null;
          markRested(index, target);
        },
      });
    },
    [angles, markActive, markRested, stop],
  );

  // Reconcile every leaf with the requested position.
  useEffect(() => {
    if (!targets.current) targets.current = angles.map((value) => value.get());
    const changed = [];
    for (let i = 0; i < angles.length; i += 1) {
      if (held.current === i) continue;
      if (targets.current[i] !== targetFor(i, position)) changed.push(i);
    }
    if (changed.length === 0) return;
    const forward = targetFor(changed[0], position) === FLAT_LEFT;
    changed.sort((a, b) => (forward ? a - b : b - a));
    changed.forEach((index, k) => settle(index, targetFor(index, position), { delay: k * RIFFLE_DELAY }));
  }, [angles, position, settle]);

  // Stop everything on unmount.
  useEffect(() => {
    const list = runs.current;
    return () => list.forEach((run) => run?.animation?.stop());
  }, []);

  /** The pointer takes hold of a leaf: stop its spring wherever it is. */
  const grab = useCallback(
    (index) => {
      if (!angles[index]) return false;
      stop(index);
      held.current = index;
      markActive(index, true);
      return true;
    },
    [angles, markActive, stop],
  );

  const drag = useCallback((index, angle) => angles[index]?.set(angle), [angles]);

  /** Let go: settle on `target` (the turned or the original side) with the throw velocity. */
  const release = useCallback(
    (index, target, velocity = 0) => {
      held.current = null;
      if (angles[index]) settle(index, target, { velocity });
    },
    [angles, settle],
  );

  return { angles, moving, grab, drag, release };
}
