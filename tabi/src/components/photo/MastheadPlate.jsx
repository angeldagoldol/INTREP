import { motion } from 'framer-motion';
import { CoverArt } from '../brochure/CoverArt.jsx';
import { Hanko, VerticalText } from '../ui/index.js';
import { getPhoto } from '../../data/photos/index.js';
import { cn } from '../../lib/cn.js';
import { ease } from '../../lib/motion.js';
import { Photo } from './Photo.jsx';
import { PhotoCredit } from './PhotoCredit.jsx';
import { useLivePhotos } from './useLivePhotos.js';
import styles from './MastheadPlate.module.css';

/** Generated art until the photograph arrives: a faded, sepia print, the same in both themes. */
const SEPIA = { paper: '#efe5d2', ink: '#2b2118', accent: '#a8572f', accent2: '#4f6b5a', muted: '#7a6a58' };

/** "Yasaka-dōri, Kyoto — street lanterns at dawn…" → "Yasaka-dōri, Kyoto". */
const placeLine = (photo) => {
  const caption = typeof photo?.caption === 'string' ? photo.caption.trim() : '';
  const title = caption.split(/\s[—–]\s/)[0].trim();
  return title || (typeof photo?.place === 'string' ? photo.place.trim() : '');
};

/**
 * A page masthead's photograph: a real photograph of a nostalgic place set
 * like a print inside crop marks, a vertical Japanese word on a paper slip
 * hung from its top edge, a seal on its corner, and a caption that names the
 * place and credits the photographer. Library and Credits lead with it.
 *   <MastheadPlate ids={['nostalgic-fullpage', 'nostalgic-ginzan']} jp="旅のしおり" seal="資料"
 *                  label="Tabi no shiori"><em>Tabi no shiori</em> — …</MastheadPlate>
 * `ids` is an order of preference (keep it a module constant): the first one
 * the photo registry knows is shown; live photos arrive as they are found and
 * the art holds the place until then (or for good, with none known). On
 * phones it becomes a wide band under the masthead's copy.
 */
export function MastheadPlate({ ids, jp, seal, label, className, children }) {
  const id = (Array.isArray(ids) ? ids : []).find((candidate) => getPhoto(candidate)) ?? null;
  const live = useLivePhotos(id ? [id] : []);
  const photo = id ? live.getPhoto(id) : null;
  const place = placeLine(photo);

  return (
    <motion.aside
      className={cn(styles.plate, className)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.1, ease: ease.out, delay: 0.35 }}
      aria-label={label}
    >
      <figure className={styles.figure}>
        <div className={styles.frame}>
          <Photo
            id={id ?? ''}
            sizes="(min-width: 761px) 20vw, 100vw"
            priority
            className={styles.photo}
            fallback={<CoverArt style="kumo" seed={29} theme={SEPIA} />}
          />
          <span className={styles.slip}>
            <VerticalText className={styles.slipText}>{jp}</VerticalText>
          </span>
          <Hanko text={seal} size={48} className={styles.seal} />
        </div>
        <figcaption className={styles.caption}>
          <span className={styles.note}>{children}</span>
          {place && <span className={styles.place}>{place}</span>}
          {photo?.available && <PhotoCredit credit={photo.credit} className={styles.credit} />}
        </figcaption>
      </figure>
    </motion.aside>
  );
}
