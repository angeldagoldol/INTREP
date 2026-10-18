import { motion } from 'framer-motion';
import { ArrowRight, Shuffle } from 'lucide-react';
import { Button, Hanko, Magnetic, RevealText, VerticalText } from '../../../components/ui/index.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { fadeUp, spring, viewportOnce } from '../../../lib/motion.js';
import { SECTIONS } from '../homeContent.js';
import styles from './CtaBand.module.css';

/** The seal lands like a real stamp: big and high, then pressed into the paper. */
const stamp = {
  hidden: { opacity: 0, scale: 1.9, rotate: -22 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: { ...spring.bouncy, delay: 0.25 } },
};

/** "Kyoto: A Thousand Gates" → "Kyoto". */
function shortTitle(title = '') {
  return title.split(/[:—–]/)[0].trim();
}

/**
 * 09 制作 — the closing call to action: a big 作 seal stamped on a seigaiha
 * sheet, with the Studio as the primary (magnetic) action and a remix of a
 * built-in brochure as the secondary one.
 */
export function CtaBand() {
  const { builtins } = useBrochures();
  const remix = builtins[0];

  return (
    <section className={styles.section}>
      <div className="container">
        <motion.div className={styles.card} variants={fadeUp} initial="hidden" whileInView="show" viewport={viewportOnce}>
          <span className={styles.pattern} aria-hidden="true" />

          <motion.div className={styles.seal} variants={stamp}>
            <Hanko text="作" size={168} title="Seal: 作, “to make”" />
          </motion.div>

          <div className={styles.copy}>
            <p className={styles.running}>
              <span className={styles.num}>{SECTIONS.studio.num}</span>
              {SECTIONS.studio.label}
              <span lang="ja" className={styles.jp}>
                {SECTIONS.studio.jp}
              </span>
            </p>
            <RevealText as="h2" text={['Make your own ', { text: 'Japan', className: 'serif-italic' }, ' brochure']} className={styles.title} />
            <p className={styles.text}>
              Pick a cover motif and colours, then add pages — your favourite places with their photographs, a full-page picture, an itinerary, a phrasebook, prices. It saves in your browser, ready to flip.
            </p>
            <div className={styles.actions}>
              <Magnetic strength={0.3}>
                <Button to="/studio" variant="accent" size="lg" iconRight={<ArrowRight />}>
                  Open the Studio
                </Button>
              </Magnetic>
              {remix && (
                <Button to={`/studio?from=${remix.slug}`} variant="ghost" size="lg" iconLeft={<Shuffle />}>
                  {`Remix ${shortTitle(remix.title)}`}
                </Button>
              )}
            </div>
          </div>

          <VerticalText className={styles.vertical}>旅を作ろう</VerticalText>
        </motion.div>
      </div>
    </section>
  );
}
