import { ArrowUpRight } from 'lucide-react';
import { safeUrl } from '../../../data/sanitize.js';
import { VerticalText } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { CoverArt } from '../CoverArt.jsx';
import { usePage } from './pageContext.js';
import { fitSize, formatLatLng, hostLabel, list, pageHeading, paragraphs, placeLayout, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './PlaceBlock.module.css';
import type from './type.module.css';

/**
 * One real sight in depth — the kit's signature page, led by its photograph
 * like a travel magazine: the picture runs off the top trim and both sides
 * (the page has no running head) and takes as much of the page as the text
 * leaves free (placeLayout), with the Japanese name on a vertical paper slip
 * (短冊) hung from the top. Below it: the kicker and the place's coordinates
 * in small type, the name, the story, and a column of practical facts
 * (Hours, Admission, Getting there…) ending in the official website. Copy and
 * facts shrink to fit rather than clip. Tabi draws no maps: lat/lng are only
 * printed. Until the photo is found, the brochure's art stands in.
 */
export function PlaceBlock({ page, brochure, index }) {
  const { isStatic, active } = usePage();
  const kicker = text(page.kicker);
  const name = text(page.name);
  const nameJp = text(page.nameJp);
  const copy = paragraphs(page.body);
  const facts = list(page.facts, 5).filter((f) => text(f.label) || text(f.value));
  const website = safeUrl(page.website);
  const where = formatLatLng(page.lat, page.lng);
  const cover = brochure.cover ?? {};
  const photo = text(page.photo);
  // A long name hangs in two columns where it breaks (ベネッセハウス｜ミュージアム, 竹林の小径｜天龍寺).
  const parts = Array.from(nameJp).length > 7 ? nameJp.split(/[\s\u3000・]+/).filter(Boolean) : [];
  const slipLines = parts.length > 1 ? parts : [nameJp];
  // Column length in characters (later columns start 1.2em lower).
  const jpChars = Math.max(...slipLines.map((line, i) => Array.from(line).length + (i ? 1.05 : 0)));
  const hasAside = facts.length > 0 || Boolean(website);
  const { aside, media } = placeLayout({ name, copy, facts, website });

  return (
    <div className={styles.place} style={{ '--media': `${media}cqw` }}>
      <Reveal variant="fade" className={styles.media} data-bleed="both">
        <Photo
          id={photo}
          sizes="(min-width: 1100px) 680px, 100vw"
          credit={photo ? 'overlay' : 'none'}
          creditLinks={!isStatic}
          kenBurns={active && !isStatic}
          className={styles.photo}
          fallback={<CoverArt style={cover.art} seed={(Number(cover.seed) || 1) + index * 7} theme={brochure.theme} />}
        />
        {nameJp && (
          <span className={styles.slip} aria-hidden="true" style={{ '--jp': `${Math.min(5.4, 46 / Math.max(3, jpChars * 1.18)).toFixed(2)}cqw` }}>
            <VerticalText className={styles.slipText}>
              {slipLines.map((line, i) => (
                <span key={i} className={styles.slipLine}>
                  {line}
                </span>
              ))}
            </VerticalText>
          </span>
        )}
      </Reveal>

      <header className={`${type.header} ${styles.header}`}>
        {(kicker || where) && (
          <Reveal className={styles.meta}>
            {kicker && <p className={`${type.kicker} ${styles.kicker}`}>{kicker}</p>}
            {where && <p className={styles.coords}>{where}</p>}
          </Reveal>
        )}
        <Reveal as="h2" className={`${type.heading} ${styles.name} ${name ? '' : 'sr-only'}`} style={{ '--fs': `${fitSize(name, { max: 7, min: 4.4, ideal: 18 })}cqw` }}>
          {name || pageHeading(page, brochure)}
          {nameJp && (
            <span className="sr-only" lang="ja">
              {` ${nameJp}`}
            </span>
          )}
        </Reveal>
      </header>

      <div className={styles.columns} data-aside={hasAside || undefined} style={{ '--cols': `minmax(0, ${(1 - aside).toFixed(3)}fr) minmax(0, ${aside.toFixed(3)}fr)` }}>
        {copy.length > 0 && (
          <Reveal className={styles.copy} data-fit="">
            {copy.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>
        )}

        {hasAside && (
          <Reveal className={styles.aside} data-fit="">
            {facts.length > 0 && (
              <dl className={styles.facts}>
                {facts.map((fact, i) => (
                  <div key={i} className={styles.fact}>
                    <dt>{text(fact.label) || 'Note'}</dt>
                    <dd>{text(fact.value) || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
            {website && (
              <p className={styles.site}>
                <span className={styles.siteLabel}>Official website</span>
                {isStatic ? (
                  <span className={styles.siteLink}>{hostLabel(website)}</span>
                ) : (
                  <a className={styles.siteLink} href={website} target="_blank" rel="noopener noreferrer">
                    {hostLabel(website)}
                    <ArrowUpRight aria-hidden="true" focusable="false" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </p>
            )}
          </Reveal>
        )}
      </div>
    </div>
  );
}
