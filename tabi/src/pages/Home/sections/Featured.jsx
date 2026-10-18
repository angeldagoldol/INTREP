import { useMemo } from 'react';
import { ArrowUpRight, PenLine } from 'lucide-react';
import { Button } from '../../../components/ui/index.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { SECTIONS } from '../homeContent.js';
import { pickFeatured } from '../homeStats.js';
import { FeaturedCarousel } from './FeaturedCarousel.jsx';
import { SectionHead } from './SectionHead.jsx';
import styles from './Featured.module.css';

const SHELF_SIZE = 8;

/** 03 特集 — the featured shelf: editorial heading and a draggable carousel. */
export function Featured() {
  const { brochures } = useBrochures();
  const shelf = useMemo(() => pickFeatured(brochures, SHELF_SIZE), [brochures]);

  return (
    <section className={styles.section}>
      <div className="container">
        <SectionHead
          section={SECTIONS.featured}
          title={['Brochures worth ', { text: 'unfolding', className: 'serif-italic' }]}
          intro="Hand-set guides to temple towns, neon nights, snow country and the islands — each one a small magazine that turns like paper."
          action={
            <Button to="/brochures" variant="secondary" iconRight={<ArrowUpRight />}>
              {`View all ${brochures.length}`}
            </Button>
          }
        />
      </div>

      {shelf.length > 0 ? (
        <div className={styles.shelf}>
          <FeaturedCarousel brochures={shelf} />
        </div>
      ) : (
        <div className={`container ${styles.empty}`}>
          <p>The shelf is empty for now. Why not make the first brochure?</p>
          <Button to="/studio" variant="accent" iconRight={<PenLine />}>
            Open the Studio
          </Button>
        </div>
      )}
    </section>
  );
}
