import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { BrochureCard } from '../../components/brochure/index.js';
import { Button } from '../../components/ui/index.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { fadeUp, stagger, viewportOnce } from '../../lib/motion.js';
import { relatedBrochures } from './related.js';
import styles from './MoreLikeThis.module.css';

/**
 * Three brochures that share this one's category or region (else featured
 * ones), as library cards that rise in when scrolled to.
 * Props: brochure.
 */
export function MoreLikeThis({ brochure }) {
  const { brochures } = useBrochures();
  const related = useMemo(() => relatedBrochures(brochure, brochures, 3), [brochure, brochures]);
  const headingId = useId();
  if (related.length === 0) return null;

  return (
    <section className={styles.more} aria-labelledby={headingId}>
      <div className={`container ${styles.layout}`}>
        <header className={styles.head}>
          <p className="eyebrow">Keep reading</p>
          <h2 id={headingId} className={styles.title}>
            More like this
            <span lang="ja" className={styles.titleJp}>
              おすすめ
            </span>
          </h2>
          <p className={styles.lede}>
            Brochures from the same region or for the same kind of trip, topped up with our editors’ favourites.
          </p>
          <Button variant="secondary" to="/brochures" iconRight={<ArrowRight />} className={styles.all}>
            All brochures
          </Button>
        </header>

        <motion.ul className={styles.grid} initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger(0.1)}>
          {related.map((b) => (
            <motion.li key={b.id} variants={fadeUp}>
              <BrochureCard brochure={b} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
