import { Icon } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { CoverArt } from '../CoverArt.jsx';
import { fitSize, kanjiNumeral, list, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './FeaturesBlock.module.css';
import type from './type.module.css';

/**
 * Highlights grid: numbered (一, 二, 三…) cells with an icon, title and short
 * text — or, when items carry photos, a small plate per item with the numeral
 * set on it. The whole grid shrinks to fit rather than clip.
 */
export function FeaturesBlock({ page, brochure }) {
  const kicker = text(page.kicker);
  const heading = text(page.heading);
  const items = list(page.items, 6).filter((item) => text(item.title) || text(item.text));
  const columns = items.length >= 4 ? 2 : 1;
  const rows = Math.ceil(items.length / columns);
  const withPhotos = items.some((item) => text(item.photo));
  const cover = brochure?.cover ?? {};

  return (
    <div className={styles.features}>
      <header className={type.header}>
        {kicker && (
          <Reveal as="p" className={type.kicker}>
            {kicker}
          </Reveal>
        )}
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 6.8, min: 4.2, ideal: 30 })}cqw` }}>
            {heading}
          </Reveal>
        )}
      </header>

      {items.length > 0 && (
        <ul className={styles.grid} data-columns={columns} data-rows={rows} data-photos={withPhotos || undefined} style={{ '--rows': rows }} data-fit="">
          {items.map((item, i) => {
            const photo = text(item.photo);
            return (
              <Reveal as="li" key={i} className={styles.item}>
                {withPhotos ? (
                  <span className={styles.thumb}>
                    {photo ? (
                      <Photo id={photo} sizes="(min-width: 1100px) 260px, 40vw" className={styles.photo} fallback={<CoverArt style={cover.art} seed={(Number(cover.seed) || 1) + i * 5} theme={brochure?.theme} />} />
                    ) : (
                      <CoverArt style={cover.art} seed={(Number(cover.seed) || 1) + i * 5} theme={brochure?.theme} />
                    )}
                    <span className={`${styles.thumbNum} ${type.jp}`} lang="ja" aria-hidden="true">
                      {kanjiNumeral(i + 1)}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className={`${styles.num} ${type.jp}`} lang="ja" aria-hidden="true">
                      {kanjiNumeral(i + 1)}
                    </span>
                    <span className={styles.icon}>
                      <Icon name={item.icon} />
                    </span>
                  </>
                )}
                <div className={styles.copy}>
                  {text(item.title) && <h3 className={styles.title}>{text(item.title)}</h3>}
                  {text(item.text) && <p className={styles.text}>{text(item.text)}</p>}
                </div>
              </Reveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}
