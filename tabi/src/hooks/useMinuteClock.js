import { useEffect, useState } from 'react';
import { msUntilNextMinute } from '../components/layout/japanTime.js';

/**
 * The current time as a Date, re-read on every minute boundary (each tick is
 * re-aligned to :00, so it never drifts) and when the tab becomes visible
 * again after background timers were throttled. Shared by the clocks.
 *   const now = useMinuteClock();
 */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, msUntilNextMinute());
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      tick();
    };
    timer = window.setTimeout(tick, msUntilNextMinute());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return now;
}
