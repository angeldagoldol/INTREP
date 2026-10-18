import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { Photo } from '../../../components/photo/Photo.jsx';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { REGIONS } from '../../../data/regions.js';
import { pad, pluralize } from '../../../lib/format.js';
import { ease, viewportOnce } from '../../../lib/motion.js';
import { REGION_NOTES, SECTIONS } from '../homeContent.js';
import { countBy } from '../homeStats.js';
import { SectionHead } from './SectionHead.jsx';
import styles from './Regions.module.css';

/** The art plate (until a photo is found) is printed matter: fixed colours in both themes. */
const PRINT = { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' };

/** Tile shapes by position, north to south: a feature plate, a wide one, the rest square-ish. */
const SHAPES = { 0: 'feature', 5: 'wide' };

/** srcset's first guess per shape (each frame then measures itself). */
const SIZES = {
  feature: '(min-width: 761px) 46vw, 100vw',
  wide: '(min-width: 761px) 46vw, 100vw',
  tile: '(min-width: 761px) 23vw, 50vw',
};

const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const tile = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: ease.out } },
};

/**
 * One region as a photograph: the picture to the edges, its number, name
 * (and Japanese name), how many brochures it has and the place pictured.
 * The region's name is the link (to the Library filtered to it), stretched
 * over the whole tile; the photo credit sits above it, without links of
 * its own (#/credits has them).
 */
function RegionTile({ region, index, count }) {
  const note = REGION_NOTES[region.id];
  const shape = SHAPES[index] ?? 'tile';

  return (
    <motion.li className={styles.tile} data-shape={shape} variants={tile}>
      <div className={styles.card}>
        <div className={styles.plate}>
          <Photo
            id={note?.photo}
            alt=""
            sizes={SIZES[shape]}
            credit="overlay"
            creditLinks={false}
            className={styles.photo}
            fallback={<CoverArt style={note?.art} seed={note?.seed} theme={PRINT} />}
          />
        </div>
        <span className={styles.scrim} aria-hidden="true" />
        <div className={styles.text}>
          <span className={styles.num} aria-hidden="true">
            {pad(index + 1)}
          </span>
          <h3 className={styles.name}>
            <Link to={`/brochures?region=${region.id}`} className={styles.link}>
              {region.label}
              <span lang="ja" className={styles.jp}>
                {region.jp}
              </span>
            </Link>
          </h3>
          {shape !== 'tile' && note?.knownFor && <p className={styles.dek}>{note.knownFor}</p>}
          <p className={styles.meta}>
            <span className={styles.count}>{count > 0 ? pluralize(count, 'brochure') : 'No brochures yet'}</span>
            {note?.place && (
              <span className={styles.pictured}>
                <span className="sr-only">Pictured: </span>
                {note.place}
                <span lang="ja" className={styles.pictureJp}>
                  {note.placeJp}
                </span>
              </span>
            )}
          </p>
        </div>
        <ArrowUpRight className={styles.arrow} aria-hidden="true" focusable="false" />
      </div>
    </motion.li>
  );
}

/**
 * 06 地方 — Japan's eight regions as a magazine grid of real photographs,
 * north to south (a feature plate for Hokkaidō, a wide one for Chūgoku):
 * each is one link into the Library filtered to that region, with its
 * Japanese name and brochure count. Plain links in reading order, so Tab
 * travels the grid; photos load lazily with srcset. No map.
 */
export function Regions() {
  const { brochures } = useBrochures();
  const counts = useMemo(() => countBy(brochures, 'region'), [brochures]);

  return (
    <section className={styles.section}>
      <div className="container">
        <SectionHead
          section={SECTIONS.regions}
          title={['Eight regions, ', { text: 'one', className: 'serif-italic' }, ' archipelago']}
          intro="From Hokkaidō’s powder snow to Okinawa’s coral coves: one photograph from each of Japan’s eight regions. Choose one to see its brochures."
        />

        <motion.ul className={styles.grid} variants={grid} initial="hidden" whileInView="show" viewport={viewportOnce}>
          {REGIONS.map((region, i) => (
            <RegionTile key={region.id} region={region} index={i} count={counts[region.id] ?? 0} />
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
