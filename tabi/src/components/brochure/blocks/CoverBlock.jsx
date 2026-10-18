import { Hanko, VerticalText } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { usePhotoRecord } from '../../photo/photoContext.js';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { pad, sealChars } from '../../../lib/format.js';
import { fitSize, formatEdition, formatLatLng, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './CoverBlock.module.css';

/** Cover lines: the places inside (place pages with a name), with their page numbers — at most four. */
function coverLines(brochure) {
  const pages = Array.isArray(brochure.pages) ? brochure.pages : [];
  return pages
    .map((page, i) => ({ name: page?.type === 'place' ? text(page.name) : '', number: i + 1 }))
    .filter((line) => line.name)
    .slice(0, 4);
}

/**
 * Front cover, set like a travel magazine: a full-bleed photograph of the
 * place (page.photo, else brochure.cover.photo — or the generative art while
 * there is none) under a soft scrim, the masthead and edition at the top, the
 * Japanese title in tall vertical mincho with the place's coordinates, and the
 * eyebrow, headline and standfirst at the foot beside a vermilion seal. Cover
 * lines list the places inside with their page numbers ("In this issue"),
 * when the brochure has place pages. The photographer's credit runs in small
 * type along the bottom edge.
 */
export function CoverBlock({ page, brochure }) {
  const { isStatic, active } = usePage();
  const title = text(page.title) || text(brochure.title);
  const titleJp = text(page.titleJp) || text(brochure.titleJp);
  const eyebrow = text(page.eyebrow);
  const subtitle = text(page.subtitle);
  const organization = text(brochure.organization);
  const edition = text(brochure.factsChecked) || formatEdition(brochure.updatedAt);
  const where = formatLatLng(brochure.location?.lat, brochure.location?.lng);
  const seal = sealChars(titleJp);
  const cover = brochure.cover ?? {};
  const photo = text(page.photo) || text(cover.photo);
  const record = usePhotoRecord(photo);
  const art = <CoverArt style={cover.art} seed={cover.seed} theme={brochure.theme} animated={active && !isStatic} />;
  const jpChars = Array.from(titleJp).length;
  const lines = coverLines(brochure);

  return (
    <div className={styles.cover} data-photo={record?.available || undefined}>
      <Reveal variant="zoom" className={styles.media}>
        {photo ? (
          <Photo
            id={photo}
            priority={!isStatic}
            sizes="(min-width: 1100px) 640px, 100vw"
            kenBurns={active && !isStatic}
            fallback={art}
          />
        ) : (
          art
        )}
      </Reveal>
      <span className={styles.scrim} aria-hidden="true" />

      {(organization || edition) && (
        <Reveal variant="fade" className={styles.masthead}>
          {organization && <span className={styles.org}>{organization}</span>}
          {organization && edition && <span className={styles.mastRule} aria-hidden="true" />}
          {edition && <span className={styles.edition}>{edition}</span>}
        </Reveal>
      )}

      {lines.length > 0 && (
        <Reveal variant="fade" className={styles.lines} data-fit="" data-fit-min="0.5">
          <p className={styles.linesHead}>
            <span>In this issue</span>
            <span lang="ja">目次</span>
          </p>
          <ol className={styles.linesList}>
            {lines.map((line) => (
              <li key={line.number}>
                <span className={styles.lineNum}>{pad(line.number)}</span>
                <span className={styles.lineName}>{line.name}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      {titleJp && (
        <Reveal
          variant="fade"
          className={styles.jp}
          style={{ '--jp': `${Math.min(13, 62 / Math.max(2, jpChars * 1.12)).toFixed(2)}cqw` }}
        >
          <VerticalText className={styles.jpText}>{titleJp}</VerticalText>
          {where && (
            <span className={styles.coords} aria-hidden="true">
              {where}
            </span>
          )}
        </Reveal>
      )}

      <Reveal variant="rise" className={styles.foot} data-fit="">
        <div className={styles.copy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          {title && (
            <h2 className={styles.title} style={{ '--fs': `${fitSize(title, { max: 12.5, min: 6.4, ideal: 14 })}cqw` }}>
              {title}
            </h2>
          )}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <Reveal variant="stamp" className={styles.sealWrap}>
          <Hanko text={seal} className={styles.seal} />
        </Reveal>
      </Reveal>

      {record?.available && <PhotoCredit credit={record.credit} links={!isStatic} className={styles.credit} />}
    </div>
  );
}
