import { motion } from 'framer-motion';
import { Marquee } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { ease, viewportOnce } from '../../../lib/motion.js';
import { SECTIONS, WORDS } from '../homeContent.js';
import { useMotionPaused } from '../homeMotion.js';
import styles from './WordMarquee.module.css';

/** The hairline draws itself in, like the SectionHead running heads. */
const rule = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.2, ease: ease.out } },
};

/** One word: 旅 · tabi · journey. */
function Word({ word }) {
  return (
    <span className={styles.word}>
      <span lang="ja" className={styles.jp}>
        {word.jp}
      </span>
      <span className={styles.gloss}>
        <span className={styles.romaji}>{word.romaji}</span>
        <span className={styles.meaning}>{word.meaning}</span>
      </span>
      <span className={styles.sun} aria-hidden="true" />
    </span>
  );
}

/**
 * Two counter-scrolling bands of Japanese words with romaji and meaning,
 * laid across the page like strips of washi tape. Pauses on hover, while
 * focus is inside and with the hero's "Pause motion" control; static and
 * scrollable under reduced motion (handled by <Marquee>).
 */
export function WordMarquee() {
  const [first, second] = WORDS;
  const paused = useMotionPaused();
  return (
    <section className={styles.section}>
      <motion.h2 className={cn('container', styles.label)} initial="hidden" whileInView="show" viewport={viewportOnce}>
        <span className={styles.num}>{SECTIONS.words.num}</span>
        <span className={styles.labelText}>{SECTIONS.words.label}</span>
        <motion.span className={styles.line} variants={rule} aria-hidden="true" />
        <span lang="ja" className={styles.labelJp}>
          {SECTIONS.words.jp}
        </span>
      </motion.h2>
      <div className={styles.bands}>
        <div className={cn(styles.band, styles.ink)}>
          <Marquee speed={70} gap="2.5rem" paused={paused} className={styles.tape}>
            {first.map((word) => (
              <Word key={word.romaji} word={word} />
            ))}
          </Marquee>
        </div>
        <div className={cn(styles.band, styles.shu)}>
          <Marquee speed={80} gap="2.5rem" reverse paused={paused} className={styles.tape}>
            {second.map((word) => (
              <Word key={word.romaji} word={word} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
