import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Search } from 'lucide-react';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { getRegion } from '../../../data/regions.js';
import { spring } from '../../../lib/motion.js';
import { useStill } from '../homeMotion.js';
import { useTicker } from './useTicker.js';
import styles from './BrowseSketch.module.css';

/**
 * Illustration for step 01 "Browse": a mini library whose filter chips and
 * covers take turns being picked. Decorative; loops only while on screen and
 * holds still under reduced motion or the page's "Pause motion".
 */
export function BrowseSketch() {
  const { builtins } = useBrochures();
  const picks = builtins.slice(0, 3);
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const still = useStill();
  const tick = useTicker(inView && !still, 1900);
  const active = picks.length ? tick % picks.length : 0;

  return (
    <div ref={ref} className={styles.sketch} role="img" aria-label="Sketch: filtering the brochure library by region and picking a cover">
      <div className={styles.search} aria-hidden="true">
        <Search />
        <span>Kyoto, onsen, 秋…</span>
      </div>
      <div className={styles.chips} aria-hidden="true">
        {picks.map((b, i) => (
          <span key={b.id} className={styles.chip} data-on={i === active || undefined}>
            {getRegion(b.region).label}
          </span>
        ))}
      </div>
      <div className={styles.grid} aria-hidden="true">
        {picks.map((b, i) => {
          const on = i === active;
          return (
            <motion.div
              key={b.id}
              className={styles.cover}
              data-on={on || undefined}
              animate={{ y: on ? -12 : 0, scale: on ? 1.05 : 1, rotate: on ? (i - 1) * -2 : 0 }}
              transition={spring.snappy}
            >
              <div className={styles.art}>
                <CoverArt style={b.cover?.art} seed={b.cover?.seed} theme={b.theme} />
              </div>
              <span className={styles.caption}>
                <span lang="ja">{b.titleJp}</span>
                <span className={styles.bar} />
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
