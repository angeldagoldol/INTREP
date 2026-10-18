import { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { VerticalText } from '../../../components/ui/index.js';
import { pad } from '../../../lib/format.js';
import { ease } from '../../../lib/motion.js';
import { SECTIONS, STEPS } from '../homeContent.js';
import { BrowseSketch } from './BrowseSketch.jsx';
import { CreateSketch } from './CreateSketch.jsx';
import { FlipSketch } from './FlipSketch.jsx';
import { SectionHead } from './SectionHead.jsx';
import styles from './HowItWorks.module.css';

const SKETCHES = { browse: BrowseSketch, flip: FlipSketch, create: CreateSketch };

const swap = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2, ease: ease.in } },
};

/**
 * 06 使い方 — "From paper to pixels". Desktop: a sticky column whose big
 * numeral, step list and progress rule follow the scroll, beside three live
 * illustrations (Browse → Flip → Create). Phones: a simple stacked list.
 */
export function HowItWorks() {
  const stepsRef = useRef(null);
  const stepRefs = useRef([]);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ['start 55%', 'end 55%'] });
  const meter = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, Math.floor(value * STEPS.length)));
    setActive((current) => (current === next ? current : next));
  });

  const jumpTo = (index) => {
    stepRefs.current[index]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

  const step = STEPS[active];

  return (
    <section className={styles.section}>
      <div className={`container ${styles.layout}`}>
        <div className={styles.aside}>
          <div className={styles.sticky}>
            <SectionHead section={SECTIONS.how} layout="stack" title={['From paper ', { text: 'to pixels', className: 'serif-italic' }]} />

            <div className={styles.now} aria-hidden="true">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={step.id} className={styles.bigNum} {...swap}>
                  {pad(active + 1)}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={step.id} className={styles.bigJp} {...swap}>
                  <VerticalText>{step.jp}</VerticalText>
                </motion.span>
              </AnimatePresence>
            </div>

            <div className={styles.tocWrap}>
              <span className={styles.meter} aria-hidden="true">
                <motion.span className={styles.meterFill} style={{ scaleY: reduce ? scrollYProgress : meter }} />
              </span>
              <ol className={styles.toc}>
                {STEPS.map((s, i) => (
                  <li key={s.id} className={styles.tocItem} data-active={i === active || undefined}>
                    <button type="button" className={styles.tocButton} onClick={() => jumpTo(i)} aria-current={i === active ? 'step' : undefined}>
                      <span className={styles.tocNum}>{pad(i + 1)}</span>
                      <span className={styles.tocTitle}>{s.title}</span>
                      <span lang="ja" className={styles.tocJp}>
                        {s.jp}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {i === active && (
                        <motion.div
                          className={styles.tocReveal}
                          aria-hidden="true"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.45, ease: ease.out } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.25, ease: ease.in } }}
                        >
                          <p className={styles.tocText}>{s.text}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <ol className={styles.steps} ref={stepsRef}>
          {STEPS.map((s, i) => {
            const Sketch = SKETCHES[s.id];
            return (
              <li
                key={s.id}
                ref={(node) => {
                  stepRefs.current[i] = node;
                }}
                className={styles.step}
                data-active={i === active || undefined}
              >
                <motion.figure
                  className={styles.card}
                  initial={{ opacity: 0, y: 48, rotate: i % 2 ? 1.5 : -1.5 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1, ease: ease.out }}
                >
                  <div className={styles.sketch}>
                    <Sketch />
                  </div>
                  <figcaption className={styles.caption}>
                    <span className={styles.capNum}>{pad(i + 1)}</span>
                    <h3 className={styles.capTitle}>
                      {s.title}{' '}
                      <span lang="ja" className={styles.capJp}>
                        {s.jp}
                      </span>{' '}
                      <span className={styles.capRomaji}>{s.romaji}</span>
                    </h3>
                    <p className={styles.capText}>{s.text}</p>
                  </figcaption>
                </motion.figure>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
