import { FORMATS } from '../../../data/schema.js';
import { Hanko } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { useLiveCredits } from '../../photo/useLivePhotos.js';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { pluralize } from '../../../lib/format.js';
import { fitSize, formatEdition, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './BackBlock.module.css';
import type from './type.module.css';

const SWATCHES = ['--b-ink', '--b-accent', '--b-accent2', '--b-muted', '--b-paper'];

/**
 * Back cover: the front photograph wrapping round as a band (the art until
 * it is downloaded), the closing line, and a colophon (奥付, okuzuke) — title,
 * publisher, edition, format, when the facts were checked and against how
 * many sources — with the publisher's seal, then the credit of every
 * photograph in the brochure (creditsFor, live Commons photos included as
 * they arrive), linked to its source and licence.
 */
export function BackBlock({ page, brochure, total }) {
  const { isStatic } = usePage();
  const title = text(page.title);
  const body = text(page.body);
  const tagline = text(page.tagline);
  const cover = brochure.cover ?? {};
  const photo = text(cover.photo);
  const seal = Array.from(text(brochure.titleJp) || '旅').filter((ch) => ch.trim() && ch !== '・').slice(0, 2).join('') || '旅';
  const format = FORMATS.find((f) => f.id === brochure.format)?.label;
  const sources = Array.isArray(brochure.sources) ? brochure.sources.filter((s) => s && typeof s === 'object' && text(s.url)).length : 0;
  const checked = [text(brochure.factsChecked), sources ? pluralize(sources, 'source') : ''].filter(Boolean).join(' · ');
  const colophon = [
    { jp: '書名', en: 'Title', value: text(brochure.title) },
    { jp: '発行', en: 'Publisher', value: text(brochure.organization) },
    { jp: '発行日', en: 'Edition', value: formatEdition(brochure.updatedAt) },
    { jp: '判型', en: 'Format', value: [format, total > 1 ? `${total} pages` : ''].filter(Boolean).join(' · ') },
    { jp: '確認', en: 'Facts checked', value: checked },
  ].filter((row) => row.value);
  const credits = useLiveCredits(brochure);
  const art = <CoverArt style={cover.art} seed={cover.seed} theme={brochure.theme} />;

  return (
    <div className={styles.back}>
      <Reveal variant="fade" className={styles.band}>
        {/* The front cover wraps around to the back, as on a printed jacket. */}
        {photo ? <Photo id={photo} alt="" sizes="(min-width: 1100px) 640px, 100vw" focus="50% 70%" fallback={art} /> : art}
      </Reveal>

      <div className={styles.content} data-fit="" data-fit-min="0.6">
        {title && (
          <Reveal as="h2" className={`${type.heading} ${styles.title}`} style={{ '--fs': `${fitSize(title, { max: 7, min: 4.2, ideal: 24 })}cqw` }}>
            {title}
          </Reveal>
        )}
        {body && (
          <Reveal as="p" className={`${type.lede} ${styles.body}`}>
            {body}
          </Reveal>
        )}
        {tagline && (
          <Reveal as="p" className={styles.tagline}>
            {tagline}
          </Reveal>
        )}

        <Reveal className={styles.colophon}>
          <p className={styles.sectionTitle}>
            <span lang="ja" className={type.jp}>
              奥付
            </span>
            <span>Colophon</span>
          </p>
          <div className={styles.colophonBody}>
            {colophon.length > 0 && (
              <dl className={styles.rows}>
                {colophon.map((row) => (
                  <div key={row.en} className={styles.row}>
                    <dt>
                      <span lang="ja" className={type.jp}>
                        {row.jp}
                      </span>
                      {row.en}
                    </dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Reveal variant="stamp" className={styles.sealWrap}>
              <Hanko text={seal} shape="circle" className={styles.seal} />
            </Reveal>
          </div>
        </Reveal>

        {credits.length > 0 && (
          <Reveal className={styles.credits}>
            <p className={styles.sectionTitle}>
              <span lang="ja" className={type.jp}>
                写真
              </span>
              <span>Photo credits</span>
            </p>
            <ol className={styles.creditList}>
              {credits.map((credit) => (
                <li key={credit.id}>
                  <span className={styles.creditPlace}>{credit.caption || credit.place || 'Photograph'}</span>
                  <PhotoCredit credit={credit} links={!isStatic} label="" as="span" className={styles.credit} />
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        <div className={styles.proof} aria-hidden="true">
          {SWATCHES.map((name) => (
            <span key={name} style={{ background: `var(${name})` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
