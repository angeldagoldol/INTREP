import { useId } from 'react';
import { motion } from 'framer-motion';
import { PenLine } from 'lucide-react';
import { BrochureCard } from '../../../components/brochure/BrochureCard.jsx';
import { Button } from '../../../components/ui/index.js';
import { ease } from '../../../lib/motion.js';
import { CreateTile } from '../components/CreateTile.jsx';
import { ShelfHead } from '../components/ShelfHead.jsx';
import styles from './Shelves.module.css';

/** "Your brochures": the visitor's own work, plus a tile to start another. */
export function YourShelf({ num, brochures }) {
  const headingId = useId();
  return (
    <motion.section
      className={styles.section}
      aria-labelledby={headingId}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: ease.out }}
    >
      <div className="container">
        <ShelfHead
          id={headingId}
          num={num}
          title="Your brochures"
          jp="自作"
          aside={
            <Button to="/studio" size="sm" variant="secondary" iconLeft={<PenLine />}>
              New brochure
            </Button>
          }
        />
      </div>
      <div className={styles.scroller}>
        <ul className={styles.track}>
          <li className={styles.item}>
            <CreateTile />
          </li>
          {brochures.map((brochure, i) => (
            <li key={brochure.id} className={styles.item}>
              <BrochureCard brochure={brochure} index={i + 1} />
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
