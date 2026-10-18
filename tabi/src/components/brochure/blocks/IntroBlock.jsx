import { Photo } from '../../photo/Photo.jsx';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { fitSize, paragraphs, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './IntroBlock.module.css';
import type from './type.module.css';

/**
 * Opening story. With a photograph: a tall plate bleeding off the page's
 * outer edge — the wider of the two columns, photo first — with the pull
 * quote beneath it, and the kicker, headline and copy (with a drop cap) in the
 * inner column. Without: headline across the page,
 * copy in two columns and a bracketed pull quote. Copy shrinks to fit.
 */
export function IntroBlock({ page, brochure }) {
  const { isStatic } = usePage();
  const photo = text(page.photo);
  const cover = brochure?.cover ?? {};
  const kicker = text(page.kicker);
  const heading = text(page.heading);
  const copy = paragraphs(page.body);
  const pullQuote = text(page.pullQuote);
  const length = copy.join(' ').length;
  // Narrow letters (I, J, l…) make a weak drop cap, as does anything non-Latin.
  const dropCap = /^[A-HK-Za-hkm-z]/.test(copy[0] ?? '');
  const withPhoto = Boolean(photo);

  const pull = pullQuote && (
    <Reveal as="blockquote" className={styles.pull}>
      <span className={styles.bracket} lang="ja" aria-hidden="true">
        「
      </span>
      <p style={{ '--fs': `${fitSize(pullQuote, { max: withPhoto ? 3.6 : 4.4, min: 2.4, ideal: withPhoto ? 44 : 60 })}cqw` }}>{pullQuote}</p>
    </Reveal>
  );

  return (
    <div className={styles.intro} data-photo={withPhoto || undefined}>
      {withPhoto && (
        <Reveal variant="fade" className={styles.media} data-bleed="outer">
          <Photo
            id={photo}
            sizes="(min-width: 1100px) 380px, 60vw"
            credit="overlay"
            creditLinks={!isStatic}
            className={styles.photo}
            fallback={<CoverArt style={cover.art} seed={(Number(cover.seed) || 1) + 2} theme={brochure?.theme} />}
          />
        </Reveal>
      )}

      <div className={styles.text}>
        <header className={type.header}>
          {kicker && (
            <Reveal as="p" className={type.kicker}>
              {kicker}
            </Reveal>
          )}
          {heading && (
            <Reveal
              as="h2"
              className={type.heading}
              style={{ '--fs': `${fitSize(heading, withPhoto ? { max: 6.4, min: 4.6, ideal: 22 } : { max: 7.4, min: 4.4, ideal: 32 })}cqw` }}
            >
              {heading}
            </Reveal>
          )}
        </header>

        <Reveal variant="wipe" className={`${type.rule} ${styles.rule}`} />

        {copy.length > 0 && (
          <Reveal
            className={styles.copy}
            data-fit={!withPhoto && length > 320 ? 'both' : ''}
            data-columns={!withPhoto && length > 320 ? 2 : 1}
            data-dropcap={dropCap || undefined}
            style={{ '--copy': `${withPhoto ? 2.5 : length > 320 ? 2.6 : 2.9}cqw` }}
          >
            {copy.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>
        )}

        {!withPhoto && pull}
      </div>

      {withPhoto && pull && <div className={styles.pullSlot}>{pull}</div>}
    </div>
  );
}
