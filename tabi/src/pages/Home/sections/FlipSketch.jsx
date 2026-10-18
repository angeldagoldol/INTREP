import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { BrochurePage } from '../../../components/brochure/BrochurePage.jsx';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { useLoadedBrochure } from '../../../hooks/useFullBrochure.js';
import { spring } from '../../../lib/motion.js';
import { useStill } from '../homeMotion.js';
import { FIRST_SPREAD, canFlip, nextSpread, spreadPages } from './flipLoop.js';
import styles from './FlipSketch.module.css';

const PAUSE_MS = 1500;

/**
 * A static, non-interactive page (or blank paper when the index is out of range or the pages are still loading).
 * The sketch always shows the booklet's facing pairs (1–2, 3–4…), so a double-page photo spread draws as one picture.
 */
function Sheet({ brochure, index }) {
  const page = brochure?.pages[index];
  if (!page) return <div className={styles.blank} />;
  return <BrochurePage brochure={brochure} page={page} index={index} total={brochure.pages.length} isStatic facing />;
}

/**
 * Illustration for step 02 "Flip": a real brochure spread whose right page
 * keeps turning with a paper spring. Decorative; loops only while on screen,
 * rests on one spread under reduced motion or the page's "Pause motion".
 */
export function FlipSketch() {
  const { builtins } = useBrochures();
  // The catalog's outline names the brochure; its pages load in their own chunk.
  const outline = builtins.find((b) => canFlip(b.pages?.length ?? 0));
  const brochure = useLoadedBrochure(outline);
  const total = outline?.pages.length ?? 0;
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const still = useStill();
  const [spread, setSpread] = useState(FIRST_SPREAD);
  const turn = useMotionValue(0);
  const shadow = useTransform(turn, [0, -90, -180], [0, 0.32, 0]);
  const running = Boolean(brochure) && inView && !still;

  // Swap page content and lay the leaf flat in the same frame.
  useLayoutEffect(() => {
    turn.set(0);
  }, [spread, turn]);

  useEffect(() => {
    if (!running) return undefined;
    let controls;
    const timer = window.setTimeout(() => {
      controls = animate(turn, -180, {
        ...spring.page,
        onComplete: () => setSpread((s) => nextSpread(s, total)),
      });
    }, PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
      controls?.stop();
    };
  }, [running, spread, total, turn]);

  if (!outline) return null;
  const pages = spreadPages(spread);

  return (
    <div ref={ref} className={styles.sketch} role="img" aria-label={`Sketch: turning the pages of the “${outline.title}” brochure`}>
      <div className={styles.book} aria-hidden="true">
        <div className={styles.left}>
          <Sheet brochure={brochure} index={pages.left} />
        </div>
        <div className={styles.right}>
          <Sheet brochure={brochure} index={pages.under} />
        </div>
        <motion.div className={styles.leaf} style={{ rotateY: turn }}>
          <div className={styles.front}>
            <Sheet brochure={brochure} index={pages.front} />
          </div>
          <div className={styles.back}>
            <Sheet brochure={brochure} index={pages.back} />
          </div>
          <motion.span className={styles.shade} style={{ opacity: shadow }} />
        </motion.div>
        <span className={styles.gutter} />
      </div>
    </div>
  );
}
