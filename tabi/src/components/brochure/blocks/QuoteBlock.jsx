import { CoverArt } from '../CoverArt.jsx';
import { fitSize, pageHeading, text, verseLines, verseSize } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './QuoteBlock.module.css';

/** Height (cqw) of the vertical column the original Japanese is set in. */
const COLUMN = 90;

/**
 * Real, attributed words — a haiku, a tanka, a proverb, an inscription. The
 * original Japanese (quoteJp) stands in vertical mincho down the outer side,
 * between 「 」, broken where the poem breaks; the English translation sits
 * at the foot of the page in lines, as a poem is printed (" / " in the data
 * marks a line break), with the author and source beneath. Without quoteJp the
 * English is set large between brackets.
 */
export function QuoteBlock({ page, brochure, index }) {
  const quote = text(page.quote);
  const author = text(page.author);
  const role = text(page.role);
  const jpLines = verseLines(page.quoteJp, { japanese: true });
  const lines = verseLines(quote);
  const verse = lines.length > 1;
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
  const size = verse ? fitSize(longest, { max: 5.4, min: 3, ideal: 26 }) : fitSize(quote, { max: jpLines.length ? 4.8 : 6.2, min: 2.8, ideal: jpLines.length ? 70 : 90 });

  return (
    <figure className={styles.quote} data-original={jpLines.length > 0 || undefined}>
      <h2 className="sr-only">{pageHeading(page, brochure)}</h2>
      <Reveal variant="fade" className={styles.art} aria-hidden="true">
        <CoverArt style="enso" seed={index + 3} theme={brochure.theme} />
      </Reveal>

      {jpLines.length > 0 && (
        <Reveal variant="fade" className={styles.original}>
          <p lang="ja" className={styles.jp} style={{ '--jp': `${verseSize(jpLines, { height: COLUMN - 10, perChar: 1.24, offset: 1.4 })}cqw`, '--col': `${COLUMN}cqw` }}>
            {jpLines.map((line, i) => (
              <span key={i} className={styles.jpLine}>
                {i === 0 && (
                  <span className={styles.bracket} aria-hidden="true">
                    「
                  </span>
                )}
                {line}
                {i === jpLines.length - 1 && (
                  <span className={styles.bracket} aria-hidden="true">
                    」
                  </span>
                )}
              </span>
            ))}
          </p>
        </Reveal>
      )}

      {!jpLines.length && (
        <Reveal variant="fade" className={styles.open} aria-hidden="true">
          <span lang="ja">「</span>
        </Reveal>
      )}

      <div className={styles.foot} data-fit="">
        {quote && (
          <Reveal as="blockquote" className={styles.text} data-verse={verse || undefined} style={{ '--fs': `${size}cqw` }}>
            {verse ? (
              <p>
                {lines.map((line, i) => (
                  <span key={i} className={styles.line}>
                    {line}
                  </span>
                ))}
              </p>
            ) : (
              <p>
                {quote}
                {!jpLines.length && (
                  <span className={styles.close} lang="ja" aria-hidden="true">
                    」
                  </span>
                )}
              </p>
            )}
          </Reveal>
        )}
        {(author || role) && (
          <Reveal as="figcaption" className={styles.by}>
            {author && <span className={styles.author}>{author}</span>}
            {role && <span className={styles.role}>{role}</span>}
          </Reveal>
        )}
      </div>
    </figure>
  );
}
