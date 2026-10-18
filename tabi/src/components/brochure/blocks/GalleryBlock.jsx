import { pad } from '../../../lib/format.js';
import { Photo } from '../../photo/Photo.jsx';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { usePhotoRecord } from '../../photo/photoContext.js';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { fitSize, list, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './GalleryBlock.module.css';
import type from './type.module.css';

/** Slot widths per layout, for srcset's first guess (the frame then measures itself). */
const SIZES = {
  hero: '(min-width: 1100px) 680px, 100vw',
  half: '(min-width: 1100px) 340px, 55vw',
  third: '(min-width: 1100px) 220px, 34vw',
};

/**
 * Photographs as plates in an editorial grid that changes with the number of
 * items, photo first like a magazine: one plate across the page; a staggered
 * pair; a tall plate beside two, running off the left trim; a wide plate
 * running off both side trims over three. Each has a numbered caption and its
 * photographer's credit. Items without a photo (or not downloaded yet) show
 * generative art instead.
 */
export function GalleryBlock({ page, brochure }) {
  const heading = text(page.heading);
  const items = list(page.items, 4);
  const count = items.length;

  return (
    <div className={styles.gallery} data-bleed={count === 1 || count >= 3 ? 'side' : undefined}>
      <header className={`${type.header} ${styles.header}`}>
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 6.8, min: 4.2, ideal: 26 })}cqw` }}>
            {heading}
          </Reveal>
        )}
        {count > 0 && (
          <Reveal as="p" variant="fade" className={styles.count}>
            <span lang="ja" className={type.jp} aria-hidden="true">
              写真
            </span>
            {`${pad(count)} ${count === 1 ? 'plate' : 'plates'}`}
          </Reveal>
        )}
      </header>

      {count > 0 && (
        <ul className={styles.grid} data-count={count} data-fit="" data-fit-min="0.7">
          {items.map((item, i) => (
            <Plate key={i} item={item} index={i} count={count} brochure={brochure} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Plate({ item, index, count, brochure }) {
  const { isStatic } = usePage();
  const id = text(item.photo);
  const record = usePhotoRecord(id);
  const caption = text(item.caption);
  const art = <CoverArt style={item.art} seed={item.seed ?? index + 1} theme={brochure.theme} />;
  const size = count === 1 || (count === 4 && index === 0) || (count === 3 && index === 0) ? SIZES.hero : count === 2 || count === 3 ? SIZES.half : SIZES.third;

  return (
    <Reveal as="li" className={styles.cell}>
      <figure className={styles.figure}>
        <div className={styles.frame}>
          {id ? <Photo id={id} sizes={size} alt={record?.alt || caption || undefined} className={styles.photo} fallback={art} /> : art}
        </div>
        <figcaption className={styles.caption}>
          <span className={styles.fig} aria-hidden="true">
            {pad(index + 1)}
          </span>
          <span className={styles.captionText}>
            {caption && <span className={styles.captionLine}>{caption}</span>}
            {record?.available && <PhotoCredit credit={record.credit} links={!isStatic} className={styles.credit} />}
          </span>
        </figcaption>
      </figure>
    </Reveal>
  );
}
