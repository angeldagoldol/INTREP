import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { Photo } from '../../../components/photo/Photo.jsx';
import { PhotoCredit } from '../../../components/photo/PhotoCredit.jsx';
import { useLivePhotos } from '../../../components/photo/useLivePhotos.js';
import { Button, VerticalText } from '../../../components/ui/index.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { listPhotos } from '../../../data/photos/index.js';
import { ease, viewportOnce } from '../../../lib/motion.js';
import { NOSTALGIC, SECTIONS, nostalgicPhotos, splitCaption } from '../homeContent.js';
import { mosaicLayout, mosaicSizes } from './mosaic.js';
import { SectionHead } from './SectionHead.jsx';
import styles from './Nostalgic.module.css';

/** Generated art until a photograph arrives: a faded, sepia print, the same in both themes. */
const SEPIA = { paper: '#efe5d2', ink: '#2b2118', accent: '#a8572f', accent2: '#4f6b5a', muted: '#7a6a58' };
const ART = ['kumo', 'asanoha', 'enso', 'shippo', 'seigaiha', 'ichimatsu', 'sakura'];

const mosaic = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const frame = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: ease.out } },
};

/** Words of three letters or more, lower-cased. */
const words = (value) => (typeof value === 'string' ? value.toLowerCase().match(/[\p{L}]{3,}/gu) ?? [] : []);

/** Does the caption's title already name the place (most of its words are the place's)? */
function namesPlace(title, place) {
  const own = words(title);
  const there = new Set(words(place));
  if (!there.size) return true;
  return own.length > 0 && own.filter((w) => there.has(w)).length / own.length >= 0.6;
}

/**
 * One photograph of the mosaic, with its caption over the foot of the
 * picture: the place (the caption's title, before its dash), its Japanese
 * name when the caption has one, a line on what it shows and the
 * photographer's credit. The lead photograph sets its Japanese name
 * vertically in its corner, like a magazine cover.
 */
function Frame({ photo, index, slot }) {
  const { title, note, jp } = splitCaption(photo.caption);
  const eyebrow = namesPlace(title, photo.place) ? '' : photo.place;
  const lead = index === 0;

  return (
    <motion.li className={styles.item} data-lead={lead || undefined} data-phone={slot.phone} style={{ '--col': slot.col, '--row': slot.row }} variants={frame}>
      <figure className={styles.figure}>
        <div className={styles.frame}>
          <Photo
            id={photo.id}
            sizes={mosaicSizes(slot)}
            credit="none"
            className={styles.photo}
            fallback={<CoverArt style={ART[index % ART.length]} seed={11 + index * 13} theme={SEPIA} />}
          />
        </div>
        {lead && jp && (
          <span className={styles.leadJp} aria-hidden="true">
            <VerticalText>{jp}</VerticalText>
          </span>
        )}
        <figcaption className={styles.caption}>
          {eyebrow && <span className={styles.place}>{eyebrow}</span>}
          {title && <span className={styles.line}>{title}</span>}
          {jp && (
            <span lang="ja" className={lead ? 'sr-only' : styles.jp}>
              {jp}
            </span>
          )}
          {note && <span className={styles.note}>{note}</span>}
          {photo.available && <PhotoCredit credit={photo.credit} className={styles.credit} />}
        </figcaption>
      </figure>
    </motion.li>
  );
}

/**
 * 03 懐かしい日本 — Nostalgic Japan: real photographs of nostalgic places as
 * a magazine mosaic (mosaic.js), from the Nostalgic Japan brochure's photo
 * manifest (ids "nostalgic-…", homeContent.js nostalgicPhotos), with a short
 * word on 懐かしい and a link to the brochure. Each frame loads lazily with a
 * srcset sized to it; live photos arrive as they are found, the art holding
 * their place. Renders nothing while the manifest has no photographs.
 */
export function Nostalgic() {
  const ids = useMemo(() => nostalgicPhotos(listPhotos()).map((p) => p.id), []);
  const live = useLivePhotos(ids);
  const photos = useMemo(() => ids.map((id) => live.getPhoto(id)).filter(Boolean), [ids, live]);
  const { getBySlug } = useBrochures();
  const brochure = getBySlug(NOSTALGIC.slug);
  const slots = mosaicLayout(photos.length);

  if (!photos.length) return null;

  return (
    <section className={styles.section}>
      <div className="container">
        <SectionHead
          section={SECTIONS.nostalgic}
          title={['Nostalgic ', { text: 'Japan', className: 'serif-italic' }]}
          intro={NOSTALGIC.intro}
          action={
            brochure ? (
              <Button to={`/brochures/${NOSTALGIC.slug}`} variant="secondary" iconRight={<ArrowRight />}>
                {`Read ${brochure.title || 'Nostalgic Japan'}`}
              </Button>
            ) : null
          }
        />

        <div className={styles.body}>
          <p className={styles.word} aria-hidden="true">
            <VerticalText className={styles.wordJp}>{NOSTALGIC.word.jp}</VerticalText>
            <span className={styles.wordRomaji}>{NOSTALGIC.word.romaji}</span>
          </p>
          <motion.ul className={styles.mosaic} data-count={photos.length} variants={mosaic} initial="hidden" whileInView="show" viewport={viewportOnce}>
            {photos.map((photo, i) => (
              <Frame key={photo.id} photo={photo} index={i} slot={slots[i]} />
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
