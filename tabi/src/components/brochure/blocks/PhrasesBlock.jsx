import { circledNumeral, fitSize, list, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './PhrasesBlock.module.css';
import type from './type.module.css';

/** A printed phrasebook: Japanese in mincho, rōmaji in mono, the meaning in plain sans. */
export function PhrasesBlock({ page }) {
  const heading = text(page.heading);
  const items = list(page.items, 6).filter((item) => text(item.jp) || text(item.romaji) || text(item.meaning));

  return (
    <div className={styles.phrases}>
      <header className={type.header}>
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 6.8, min: 4.2, ideal: 26 })}cqw` }}>
            {heading}
          </Reveal>
        )}
        {items.length > 0 && (
          <Reveal as="p" variant="fade" className={styles.legend} aria-hidden="true">
            <span>
              <span lang="ja">日本語</span> · Rōmaji
            </span>
            <span>Meaning</span>
          </Reveal>
        )}
      </header>

      {items.length > 0 && (
        <ol className={styles.list} data-fit="">
          {items.map((item, i) => {
            const jp = text(item.jp);
            return (
              <Reveal as="li" key={i} className={styles.item}>
                <span className={`${styles.num} ${type.jp}`} aria-hidden="true">
                  {circledNumeral(i + 1)}
                </span>
                <div className={styles.say}>
                  {jp && (
                    <p className={`${styles.jp} ${type.jp}`} lang="ja" style={{ '--fs': `${fitSize(jp, { max: 4.2, min: 2.6, ideal: 9 })}cqw` }}>
                      {jp}
                    </p>
                  )}
                  {text(item.romaji) && <p className={styles.romaji}>{text(item.romaji)}</p>}
                </div>
                {text(item.meaning) && <p className={styles.meaning}>{text(item.meaning)}</p>}
              </Reveal>
            );
          })}
        </ol>
      )}
    </div>
  );
}
