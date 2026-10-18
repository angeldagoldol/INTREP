import { CAPTION_PLACEMENTS, CREDIT_PLACEMENTS } from '../../../data/schema.js';
import { Photo } from '../../photo/Photo.jsx';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { usePhotoRecord } from '../../photo/photoContext.js';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './PhotoBlock.module.css';

const captionOf = (page) => ({ name: text(page?.name), nameJp: text(page?.nameJp), line: text(page?.caption) });
const hasCaption = (c) => Boolean(c.name || c.nameJp || c.line);
const placementOf = (page) => (CAPTION_PLACEMENTS.includes(page?.captionPlacement) ? page.captionPlacement : CAPTION_PLACEMENTS[0]);
const creditOf = (page) => (CREDIT_PLACEMENTS.includes(page?.creditPlacement) ? page.creditPlacement : CREDIT_PLACEMENTS[0]);

/**
 * What a spread's two halves share, read the same way from either half so
 * they always agree: the captioned half leads (the right one when both or
 * neither are captioned), and its placements set the layout of both.
 */
function spreadLayout(page, partner) {
  const [left, right] = page.span === 'left' ? [page, partner] : [partner, page];
  const lead = hasCaption(captionOf(right)) || !hasCaption(captionOf(left)) ? right : left;
  return { left, right, lead: lead === left ? 'left' : 'right', placement: placementOf(lead), credit: creditOf(lead), caption: captionOf(lead) };
}

/**
 * The magazine caption: an accent rule, the place in small capitals with its
 * Japanese name, one line of text, and (unless it runs up the edge) the
 * photographer's credit. Shrinks to fit (data-fit) rather than clip.
 */
function Caption({ caption, record, credit, links, compact = false, className }) {
  const { name, nameJp, line } = caption;
  const showCredit = credit === 'caption' && record?.available;
  if (!hasCaption(caption) && !showCredit) return null;
  return (
    <Reveal as="figcaption" className={`${styles.caption} ${className ?? ''}`} data-fit="" data-fit-min="0.5">
      <span className={styles.mark} aria-hidden="true" />
      {(name || nameJp) && (
        <p className={styles.place}>
          {name && <span className={styles.name}>{name}</span>}
          {nameJp && (
            <span lang="ja" className={styles.nameJp}>
              {nameJp}
            </span>
          )}
        </p>
      )}
      {line && !compact && <p className={styles.line}>{line}</p>}
      {showCredit && <PhotoCredit credit={record.credit} links={links} className={styles.credit} />}
    </Reveal>
  );
}

/** The page's heading for assistive tech (the caption carries the name visually). */
function Heading({ caption, spread }) {
  const name = caption.name || caption.line || 'Photograph';
  return <h2 className="sr-only">{spread ? `${name} — double-page spread` : name}</h2>;
}

/** The credit set vertically along the outer trim (縦), as photo pages in print do. */
function EdgeCredit({ record, links }) {
  if (!record?.available) return null;
  return <PhotoCredit credit={record.credit} links={links} className={styles.edgeCredit} />;
}

/**
 * A magazine photo page (page type `photo`).
 *
 * - On its own: the photograph to the trim with an elegant caption — over
 *   the foot of the picture on a soft scrim (`captionPlacement: 'overlay'`)
 *   or on the paper beneath it ('below'); the credit ends the caption or runs
 *   up the outer edge (`creditPlacement: 'edge'`).
 * - Half of a double-page spread (`span`, with its other half placed beside
 *   it — see data/photoSpreads.js): in a spread view (`facing`) each half
 *   draws its half of ONE photograph — the picture is laid out twice the page
 *   width and shifted, so both halves crop it identically and meet exactly at
 *   the gutter — with the caption on the captioned half's outer corner.
 *   Read one page at a time (phones, print, the contact sheet), the left half
 *   is the photo cropped to the page with the caption, and the right half
 *   shows the whole wide picture as a plate on the paper.
 * - A half whose other half is missing or misplaced is drawn as a full page.
 * The brochure's generative art stands in until the photo arrives (across
 * both halves of a spread, so they still line up).
 */
export function PhotoBlock({ page, brochure, index, partner }) {
  const { isStatic, active, facing } = usePage();
  const photo = text(page.photo);
  const record = usePhotoRecord(photo);
  const cover = brochure?.cover ?? {};
  const links = !isStatic;
  const span = partner ? page.span : null;
  // Both halves of a spread draw the same art (seeded by the left half's position).
  const anchor = span === 'right' ? index - 1 : index;
  const art = <CoverArt style={cover.art} seed={(Number(cover.seed) || 1) + anchor * 7} theme={brochure?.theme} />;
  const picture = (props) => (photo ? <Photo id={photo} fallback={art} className={styles.photo} {...props} /> : art);

  if (span && facing) {
    const layout = spreadLayout(page, partner);
    const leads = layout.lead === span;
    const own = captionOf(page);
    // Each half prints its own caption; a half without one stays clean, except that the
    // leading half always carries the credit.
    const caption = hasCaption(own) ? own : leads ? { name: '', nameJp: '', line: '' } : null;
    return (
      <figure className={styles.photoPage} data-mode="half" data-span={span} data-placement={layout.placement} data-lead={leads || undefined}>
        <Heading caption={layout.caption} spread />
        <div className={styles.spreadMedia}>
          <Reveal variant="fade" className={styles.fill}>
            {/* The left half carries the description; the right half is the same picture. */}
            {picture({ sizes: '(min-width: 1100px) 1280px, 200vw', alt: span === 'left' ? undefined : '' })}
          </Reveal>
        </div>
        {caption && layout.placement === 'overlay' && hasCaption(caption) && <span className={styles.cornerScrim} aria-hidden="true" />}
        {caption && <Caption caption={caption} record={record} credit={leads ? layout.credit : 'none'} links={links} />}
        {leads && layout.credit === 'edge' && <EdgeCredit record={record} links={links} />}
      </figure>
    );
  }

  if (span === 'right') {
    // Single-page reading: the whole wide picture as a plate, named again for the page on its own.
    const layout = spreadLayout(page, partner);
    const ratio = record?.width && record?.height ? Math.min(2.4, Math.max(1.15, record.width / record.height)) : 1.5;
    return (
      <figure className={styles.photoPage} data-mode="plate">
        <Heading caption={layout.caption} spread />
        <Reveal as="p" variant="fade" className={styles.tag}>
          <span lang="ja">見開き</span>
          <span>Double-page spread · 2 / 2 — the whole view</span>
        </Reveal>
        <Reveal variant="fade" className={styles.plateMedia} style={{ '--ratio': ratio.toFixed(3) }}>
          {picture({ sizes: '(min-width: 1100px) 640px, 100vw' })}
        </Reveal>
        <Caption caption={layout.caption} record={record} credit="caption" links={links} compact className={styles.plateCaption} />
      </figure>
    );
  }

  // A page of its own, or the left half read one page at a time.
  const layout = span ? spreadLayout(page, partner) : { placement: placementOf(page), credit: creditOf(page), caption: captionOf(page) };
  const overlay = layout.placement === 'overlay';
  return (
    <figure className={styles.photoPage} data-mode="full" data-placement={layout.placement}>
      <Heading caption={layout.caption} spread={Boolean(span)} />
      <Reveal variant={isStatic ? 'fade' : 'zoom'} className={styles.media}>
        {picture({ sizes: '(min-width: 1100px) 640px, 100vw', kenBurns: active && !isStatic })}
      </Reveal>
      {overlay && hasCaption(layout.caption) && <span className={styles.scrim} aria-hidden="true" />}
      {span && (
        <Reveal as="p" variant="fade" className={`${styles.tag} ${styles.tagOver}`}>
          <span lang="ja">見開き</span>
          <span>Double-page spread · 1 / 2</span>
        </Reveal>
      )}
      <Caption caption={layout.caption} record={record} credit={layout.credit} links={links} />
      {layout.credit === 'edge' && <EdgeCredit record={record} links={links} />}
    </figure>
  );
}
