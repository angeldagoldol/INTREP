import { useRef } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { ART_LABELS } from '../../../data/schema.js';
import { spring } from '../../../lib/motion.js';
import { useStill } from '../homeMotion.js';
import { useTicker } from './useTicker.js';
import styles from './CreateSketch.module.css';

const TITLE = 'My Japan';
const TICKS_PER_LOOP = 16;
const STAMP_AT = 11;
/** Each loop the "designer" picks another cover motif and palette. */
const LOOKS = [
  { art: 'fuji', theme: { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' } },
  { art: 'sakura', theme: { paper: '#fbf3f1', ink: '#2a1a1d', accent: '#c4283b', accent2: '#f2a7b8', muted: '#7a6066' } },
  { art: 'torii', theme: { paper: '#f2f0e6', ink: '#1b2a1c', accent: '#d9542c', accent2: '#6f8a3c', muted: '#5e6a58' } },
  { art: 'seigaiha', theme: { paper: '#eef2f6', ink: '#14202e', accent: '#c79a3b', accent2: '#1b2a4a', muted: '#55657a' } },
];

/**
 * Illustration for step 03 "Create": a miniature Studio where a title types
 * itself, a palette and motif get picked and a 作 seal stamps the cover.
 * Decorative; loops only while on screen, shows the finished state under
 * reduced motion and freezes on the page's "Pause motion".
 */
export function CreateSketch() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const still = useStill();
  const tick = useTicker(inView && !still, 260);
  const phase = reduce ? TICKS_PER_LOOP - 1 : tick % TICKS_PER_LOOP;
  const look = Math.floor(tick / TICKS_PER_LOOP) % LOOKS.length;
  const { art, theme } = LOOKS[look];
  const typed = TITLE.slice(0, Math.max(0, phase - 1));
  const stamped = phase >= STAMP_AT;

  return (
    <div ref={ref} className={styles.sketch} role="img" aria-label="Sketch: designing a brochure in the Studio — typing a title, choosing colours and a cover motif">
      <div className={styles.window} aria-hidden="true">
        <div className={styles.toolbar}>
          <span className={styles.brand}>
            Studio <span lang="ja">制作</span>
          </span>
          <span className={styles.saved} data-on={stamped || undefined}>
            <Check /> Saved
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.thumbs}>
            {LOOKS.slice(0, 3).map((l, i) => (
              <span key={l.art} className={styles.thumb} data-on={i === 0 || undefined}>
                {i === 0 ? <CoverArt style={art} seed={7} theme={theme} /> : <span className={styles.lines} />}
              </span>
            ))}
          </div>

          <div className={styles.canvas} style={{ '--c-paper': theme.paper, '--c-ink': theme.ink, '--c-accent': theme.accent }}>
            <div className={styles.page}>
              <div className={styles.art}>
                <CoverArt style={art} seed={7} theme={theme} />
              </div>
              <div className={styles.title}>
                {typed}
                <span className={styles.caret} />
              </div>
              <span className={styles.sub} />
              <span className={styles.sub} data-short />
              <AnimatePresence>
                {stamped && (
                  <motion.span
                    key={look}
                    className={styles.seal}
                    lang="ja"
                    initial={{ scale: 2.2, opacity: 0, rotate: -18 }}
                    animate={{ scale: 1, opacity: 1, rotate: -6 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={spring.bouncy}
                  >
                    作
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className={styles.inspector}>
            <span className={styles.label}>Colours</span>
            <span className={styles.swatches}>
              {LOOKS.map((l, i) => (
                <span key={l.art} className={styles.swatch} style={{ background: l.theme.accent }} data-on={i === look || undefined} />
              ))}
            </span>
            <span className={styles.label}>Motif</span>
            <span className={styles.motifs}>
              {LOOKS.map((l, i) => (
                <span key={l.art} className={styles.motif} lang="ja" data-on={i === look || undefined}>
                  {ART_LABELS[l.art].jp}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
