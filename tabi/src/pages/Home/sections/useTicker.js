import { useEffect, useState } from 'react';

/**
 * A counter that advances every `interval` ms while `running` is true —
 * the heartbeat of the small looping illustrations. It keeps its value when
 * paused, so a sketch resumes where it left off.
 */
export function useTicker(running, interval) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), interval);
    return () => window.clearInterval(id);
  }, [running, interval]);

  return tick;
}
