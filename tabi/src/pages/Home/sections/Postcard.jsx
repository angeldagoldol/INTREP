import { useId } from 'react';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { TRANSLATION_CREDIT } from '../homeContent.js';
import styles from './Postcard.module.css';

/** Stamps are printed matter: fixed paper colours in both themes. */
const STAMP_THEME = { paper: '#f6f0e4', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' };

/** Circular cancellation mark — the town round the top, the year across — trailing wavy bars to the right. */
function Postmark({ town, date }) {
  const arcId = `pm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Long town names (KASHIWABARA) set a little smaller to stay on the arc.
  const townSize = town.length > 9 ? 7.4 : 9;
  return (
    <svg className={styles.postmark} viewBox="0 0 150 80" aria-hidden="true" focusable="false">
      <defs>
        <path id={arcId} d="M12 40 a30 30 0 0 1 60 0" />
      </defs>
      <g className={styles.waves}>
        {[24, 34, 44, 54].map((y) => (
          <path key={y} d={`M84 ${y} q8 -5 16 0 t16 0 t16 0 t16 0`} />
        ))}
      </g>
      <circle cx="42" cy="40" r="36" className={styles.ring} />
      <circle cx="42" cy="40" r="25" className={styles.ringInner} />
      <text className={styles.town} style={{ fontSize: townSize }}>
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {town}
        </textPath>
      </text>
      <text x="42" y="44" textAnchor="middle" className={styles.date}>
        {date}
      </text>
    </svg>
  );
}

/**
 * A haiku sent as a Japanese postcard (hagaki). The message half carries our
 * English translation (credited) and the romaji; the address half — where a
 * Japanese address runs in vertical columns — carries the original, set
 * 縦書き and staggered like brushed calligraphy, under a stamp, a postmark
 * with the place and year, and the red postcode boxes, left blank. Screen
 * readers get the poem in Japanese, the translation, the romaji, then the
 * poet, place and year.
 *   <Postcard haiku={{ poet, poetJp, place, today, postmark, year, jp: [], romaji: [], en: [], art, seed }} />
 */
export function Postcard({ haiku }) {
  const jp = haiku.jp ?? [];
  const romaji = haiku.romaji ?? [];
  const en = haiku.en ?? [];
  return (
    <figure className={styles.card}>
      {/* The address side's printed furniture: stamp, postmark and the blank postcode boxes. */}
      <div className={styles.franking} aria-hidden="true">
        <span className={styles.stamp}>
          <span className={styles.stampArt}>
            <CoverArt style={haiku.art} seed={haiku.seed} theme={STAMP_THEME} />
          </span>
          <span className={styles.stampText}>NIPPON</span>
        </span>
        <Postmark town={haiku.postmark} date={haiku.year} />
        <span className={styles.postcode}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={styles.box} data-gap={i === 3 || undefined} />
          ))}
        </span>
      </div>

      <blockquote className={styles.poem} lang="ja">
        <p className={styles.poemText}>
          {jp.map((line) => (
            <span key={line} className={styles.poemLine}>
              {line}
            </span>
          ))}
        </p>
      </blockquote>

      <div className={styles.message}>
        <p className={styles.en}>
          {en.map((line) => (
            <span key={line} className={styles.enLine}>
              {line}
            </span>
          ))}
        </p>
        <p className={styles.credit}>{TRANSLATION_CREDIT}</p>
      </div>

      <p className={styles.romaji} lang="ja-Latn">
        {romaji.join(' / ')}
      </p>

      <figcaption className={styles.from}>
        <span className={styles.fromLabel}>From</span>
        <span className={styles.poet}>
          {haiku.poet}
          {haiku.poetJp && (
            <span lang="ja" className={styles.poetJp}>
              {haiku.poetJp}
            </span>
          )}
        </span>
        <span className={styles.place}>
          {haiku.place}
          <span className={styles.year}> · {haiku.year}</span>
          {haiku.today && <span className={styles.today}>today {haiku.today}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
