import { useRef } from 'react';
import { motion, useInView, useMotionValue, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowDown, ArrowRight, PenLine } from 'lucide-react';
import { Button, Magnetic, RevealText, VerticalText } from '../../../components/ui/index.js';
import { useFinePointer } from '../../../hooks/useMediaQuery.js';
import { ease } from '../../../lib/motion.js';
import { HERO_PANELS, SECTIONS } from '../homeContent.js';
import { useMotionPaused } from '../homeMotion.js';
import { HeroStage } from './HeroStage.jsx';
import { MotionToggle } from './MotionToggle.jsx';
import { Petals } from './Petals.jsx';
import { PhotoCredits } from './PhotoCredits.jsx';
import { TokyoClock } from './TokyoClock.jsx';
import styles from './Hero.module.css';

const HEADLINE = ['Japan, ', { text: 'folded', className: `serif-italic ${styles.folded}` }, ' into pages.'];

/** The tri-fold's photographs, credited left to right as the brochure reads. */
const HERO_CREDITS = [HERO_PANELS.left, HERO_PANELS.middle, HERO_PANELS.right].map((panel) => ({ id: panel.photo, label: panel.title }));

/** Copy blocks rise in after the headline. */
const rise = (delay) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: ease.out, delay },
});

/** The 日本 / 旅 spine: a book's vertical title, set in mincho. */
function Spine() {
  return (
    <motion.div className={styles.spine} aria-hidden="true" {...rise(0.45)}>
      <VerticalText className={styles.nihon}>日本</VerticalText>
      <span className={styles.spineRule} />
      <VerticalText className={styles.tabi}>旅</VerticalText>
      <span className={styles.spineCaption}>Nihon · Tabi</span>
    </motion.div>
  );
}

/**
 * The first impression: masthead headline, pitch and CTAs beside an
 * interactive tri-fold brochure of real photographs (Fuji, Fushimi Inari,
 * Shibuya; credited under it) under a rising sun, with drifting sakura and
 * a meta strip (counts, the page's "Pause motion" control, live Tokyo clock).
 * The brochure follows the pointer and folds shut as the hero scrolls away.
 *
 * - `brochureCount` number of brochures in the library (meta strip).
 */
export function Hero({ brochureCount = 0 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const finePointer = useFinePointer();
  const inView = useInView(ref);
  const motionPaused = useMotionPaused();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const onPointerMove = (event) => {
    if (!finePointer || reduce || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const scrollOn = () => {
    ref.current?.nextElementSibling?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <section ref={ref} className={styles.hero} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <Petals paused={!inView || motionPaused} />

      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <motion.p className={styles.kicker} {...rise(0.05)}>
            <span className={styles.kickerNum}>{SECTIONS.hero.num}</span>
            <span>{SECTIONS.hero.label}</span>
            <span lang="ja" className={styles.kickerJp}>
              日本の旅
            </span>
          </motion.p>

          <RevealText as="h1" text={HEADLINE} immediate delay={0.15} stagger={0.09} duration={1.1} className={styles.title} />

          <motion.p className={styles.pitch} {...rise(0.55)}>
            Interactive brochures about Japan that turn like paper — browse the library, or make your own in minutes.
          </motion.p>

          <motion.div className={styles.ctas} {...rise(0.7)}>
            <Button to="/brochures" size="lg" iconRight={<ArrowRight />}>
              Browse brochures
            </Button>
            <Magnetic strength={0.25}>
              <Button to="/studio" size="lg" variant="secondary" iconRight={<PenLine />}>
                Make your own
              </Button>
            </Magnetic>
          </motion.div>
        </div>

        <div className={styles.stage}>
          <HeroStage pointerX={pointerX} pointerY={pointerY} progress={scrollYProgress} />
          <motion.div {...rise(1.1)}>
            <PhotoCredits slots={HERO_CREDITS} className={styles.credits} />
          </motion.div>
        </div>
        <Spine />
      </div>

      <motion.div className={`container ${styles.metaWrap}`} {...rise(0.95)}>
        <div className={styles.meta}>
          <p className={styles.facts}>
            <span>
              <b>47</b> prefectures
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <b>4</b> seasons
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <b>{brochureCount}</b> {brochureCount === 1 ? 'brochure' : 'brochures'}
            </span>
          </p>

          <button type="button" className={styles.cue} onClick={scrollOn}>
            <span className={styles.cueIcon} aria-hidden="true">
              <ArrowDown />
            </span>
            <span>Scroll</span>
            <span lang="ja" className={styles.cueJp}>
              下へ
            </span>
          </button>

          <div className={styles.metaEnd}>
            <MotionToggle className={styles.motion} />
            <TokyoClock />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
