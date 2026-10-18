import { useId, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, CircleDashed, PenLine } from 'lucide-react';
import { Photo } from '../../components/photo/Photo.jsx';
import { PhotoCredit } from '../../components/photo/PhotoCredit.jsx';
import { useLivePhotos } from '../../components/photo/useLivePhotos.js';
import { sourceLinks } from '../../components/viewer/links.js';
import { sealText } from '../../components/viewer/pageMeta.js';
import { Button, Hanko, RevealText, VerticalText } from '../../components/ui/index.js';
import { getCategory } from '../../data/categories.js';
import { photoIdsIn } from '../../data/photos/index.js';
import { getRegion } from '../../data/regions.js';
import { FORMATS } from '../../data/schema.js';
import { SEASONS } from '../../data/seasons.js';
import { formatDate, pad, pluralize } from '../../lib/format.js';
import { fadeUp, stagger, viewportOnce } from '../../lib/motion.js';
import { factsStatus, featurePhoto, pendingNote, photoStatus } from './aboutFacts.js';
import styles from './AboutBrochure.module.css';

/** 春 夏 秋 冬 — all four seasons, the brochure's best ones inked in their colours. */
function SeasonMarks({ seasons }) {
  const best = new Set(Array.isArray(seasons) ? seasons : []);
  const names = SEASONS.filter((s) => best.has(s.id)).map((s) => s.label.toLowerCase());
  return (
    <span className={styles.seasons}>
      <span className="sr-only">{names.length ? names.join(', ') : 'Any season'}</span>
      {SEASONS.map((s) => (
        <span
          key={s.id}
          lang="ja"
          className={styles.season}
          data-best={best.has(s.id) || undefined}
          style={{ '--season': s.color }}
          title={`${s.label} · ${s.months}`}
          aria-hidden="true"
        >
          {s.jp}
        </span>
      ))}
    </span>
  );
}

/**
 * A downloaded landscape photograph of the place, full-bleed, drifting a
 * little against the scroll (still under reduced motion), with its caption
 * and credit printed in the lower margin like a magazine plate.
 */
function FeaturePlate({ photo, titleJp }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%']);
  const caption = photo.caption || photo.place;
  return (
    <figure ref={ref} className={styles.plate}>
      <motion.div className={styles.plateMedia} style={reduce ? undefined : { y }}>
        <Photo photo={photo} sizes="100vw" credit="none" className={styles.platePhoto} />
      </motion.div>
      <span className={styles.plateShade} aria-hidden="true" />
      {titleJp && (
        <span className={styles.plateSlip} aria-hidden="true">
          <VerticalText className={styles.plateSlipText}>{titleJp}</VerticalText>
        </span>
      )}
      <figcaption className={`container ${styles.plateCaption}`}>
        <span className={styles.plateKicker}>
          <span lang="ja">写真</span> Pictured
        </span>
        {caption && <span className={styles.plateText}>{caption}</span>}
        <PhotoCredit credit={photo.credit} className={styles.plateCredit} />
      </figcaption>
    </figure>
  );
}

/** The fact-check status: a filled seal (検, checked) or an empty dashed one (未, waiting). */
function FactsStatus({ status }) {
  return (
    <div className={styles.status} data-checked={status.checked || undefined}>
      <span className={styles.stamp} aria-hidden="true">
        <span lang="ja">{status.checked ? '検' : '未'}</span>
      </span>
      <div className={styles.statusText}>
        <p className={styles.statusLabel}>{status.label}</p>
        <p className={styles.statusNote}>{status.note}</p>
      </div>
    </div>
  );
}

/** Numbered list of the brochure's sources, each opening in a new tab. */
function SourceList({ links, headingId }) {
  return (
    <div className={styles.block}>
      <h4 id={headingId} className={styles.blockTitle}>
        Sources
        <span lang="ja" className={styles.blockJp}>
          出典
        </span>
        <span className={styles.blockCount}>{links.length}</span>
      </h4>
      {links.length ? (
        <ol className={styles.sources} aria-labelledby={headingId}>
          {links.map((link, i) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.source}>
                <span className={styles.sourceNum} aria-hidden="true">
                  {pad(i + 1)}
                </span>
                <span className={styles.sourceLabel}>{link.label}</span>
                <span className={styles.sourceHost}>
                  {link.host}
                  <ArrowUpRight aria-hidden="true" focusable="false" />
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.blockEmpty}>No sources are listed for this brochure.</p>
      )}
    </div>
  );
}

/** Photo credits: a thumbnail, what it shows, and the author and licence (linked). */
function PhotoCredits({ brochure, credits, pending, loading = 0, headingId }) {
  const total = credits.length + pending.length;
  return (
    <div className={styles.block}>
      <h4 id={headingId} className={styles.blockTitle}>
        Photographs
        <span lang="ja" className={styles.blockJp}>
          写真
        </span>
        <span className={styles.blockCount}>{credits.length}</span>
      </h4>
      {credits.length > 0 && (
        <ul className={styles.credits} aria-labelledby={headingId}>
          {credits.map((credit) => (
            <li key={credit.id} className={styles.credit}>
              <span className={styles.thumb}>
                <Photo id={credit.id} brochure={brochure} alt="" sizes="96px" credit="none" />
              </span>
              <span className={styles.creditText}>
                <span className={styles.creditWhat}>{credit.caption || credit.place || credit.title || 'Photograph'}</span>
                <PhotoCredit credit={credit} className={styles.creditLine} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {loading > 0 ? (
        <p className={styles.pending} role="status">
          Looking up {pluralize(loading, 'photograph')} on Wikimedia Commons…
        </p>
      ) : (
        pending.length > 0 && <p className={styles.pending}>{pendingNote(pending.length, credits.length)}</p>
      )}
      {total === 0 && <p className={styles.blockEmpty}>No photographs: this brochure’s pictures are drawn in code from traditional patterns.</p>}
    </div>
  );
}

/**
 * "About this brochure": a full-bleed photograph of the place (once one is
 * downloaded), the story in a sentence, tags and the colophon facts (region,
 * seasons, category, format, pages, reading time, updated, publisher, facts
 * checked), the two next steps — plan the trip, remix it in the Studio — and
 * the sources & credits: the fact-check status (checked, or honestly
 * waiting), the numbered sources (new tab), every photo credit with a
 * thumbnail, and a link to the Credits page.
 * Props: brochure, onPlan.
 */
export function AboutBrochure({ brochure, onPlan }) {
  const headingId = useId();
  const sourcesId = useId();
  const photosId = useId();
  const region = getRegion(brochure.region);
  const category = getCategory(brochure.category);
  const format = FORMATS.find((f) => f.id === brochure.format)?.label ?? 'Booklet';
  const pages = Array.isArray(brochure.pages) ? brochure.pages.length : 0;
  const tags = (Array.isArray(brochure.tags) ? brochure.tags : []).filter((t) => typeof t === 'string' && t.trim());
  const updated = formatDate(brochure.updatedAt);
  const headline = brochure.subtitle || brochure.title || 'A Japan brochure';

  const links = useMemo(() => sourceLinks(brochure), [brochure]);
  const status = factsStatus(brochure, links.length);
  // Live Commons photos count (and are credited) as soon as they resolve.
  const photoIds = useMemo(() => photoIdsIn(brochure), [brochure]);
  const live = useLivePhotos(photoIds);
  const credits = useMemo(() => live.creditsFor(brochure), [live, brochure]);
  const { pending } = useMemo(() => photoStatus(brochure, live.resolvePhoto), [live, brochure]);
  const feature = useMemo(() => featurePhoto(brochure, live.resolvePhoto), [live, brochure]);

  const facts = [
    { label: 'Region', value: region.label, jp: region.jp },
    { label: 'Best seasons', node: <SeasonMarks seasons={brochure.seasons} /> },
    { label: 'Category', value: category.label, jp: category.jp },
    { label: 'Format', value: `${format} · ${pluralize(pages, 'page')}` },
    Number.isFinite(brochure.readMinutes) && { label: 'Reading time', value: `${brochure.readMinutes} min` },
    updated && { label: 'Updated', node: <time dateTime={brochure.updatedAt}>{updated}</time> },
    brochure.organization && { label: 'Publisher', value: brochure.organization },
    {
      label: 'Facts',
      node: (
        <span className={styles.factsValue} data-checked={status.checked || undefined}>
          {status.checked ? <BadgeCheck aria-hidden="true" focusable="false" /> : <CircleDashed aria-hidden="true" focusable="false" />}
          {status.checked ? `Checked ${status.when}` : status.when ? `Dated ${status.when} by the author` : 'Awaiting check'}
        </span>
      ),
    },
  ].filter(Boolean);

  return (
    <section className={styles.about} aria-labelledby={headingId} data-plate={feature ? '' : undefined}>
      {feature && <FeaturePlate photo={feature} titleJp={brochure.titleJp} />}

      <div className={`container ${styles.grid}`}>
        <motion.aside className={styles.aside} initial="hidden" whileInView="show" viewport={viewportOnce} variants={fadeUp} aria-hidden="true">
          <VerticalText className={styles.bigJp}>{brochure.titleJp || '旅'}</VerticalText>
          <Hanko text={sealText(brochure)} size={52} className={styles.seal} />
        </motion.aside>

        <div className={styles.main}>
          <p className="eyebrow">
            About this brochure
            <span lang="ja" className={styles.eyebrowJp}>
              この冊子について
            </span>
          </p>
          <RevealText as="h2" text={headline} className={styles.heading} />
          <span id={headingId} className="sr-only">
            About {brochure.title}
          </span>

          <motion.div className={styles.body} initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger(0.08, 0.1)}>
            {brochure.summary && (
              <motion.p className={styles.summary} variants={fadeUp}>
                {brochure.summary}
              </motion.p>
            )}

            {tags.length > 0 && (
              <motion.ul className={styles.tags} variants={fadeUp} aria-label="Tags">
                {tags.map((tag) => (
                  <li key={tag} className={styles.tag}>
                    {tag}
                  </li>
                ))}
              </motion.ul>
            )}

            <motion.dl className={styles.facts} variants={fadeUp}>
              {facts.map((fact) => (
                <div key={fact.label} className={styles.fact}>
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.node ?? fact.value}
                    {fact.jp && (
                      <span lang="ja" className={styles.factJp}>
                        {fact.jp}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </motion.dl>

            <motion.div className={styles.actions} variants={fadeUp}>
              <Button variant="accent" size="lg" onClick={onPlan} iconLeft={<CalendarDays />}>
                Plan this trip
              </Button>
              <Button variant="secondary" size="lg" to={`/studio?from=${encodeURIComponent(brochure.slug ?? '')}`} iconLeft={<PenLine />}>
                Remix in Studio
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <motion.div className={`container ${styles.colophon}`} initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger(0.08)}>
        <motion.div className={styles.colophonHead} variants={fadeUp}>
          <h3 className={styles.colophonTitle}>
            Sources &amp; credits
            <span lang="ja" className={styles.colophonJp}>
              奥付
            </span>
          </h3>
          <Link to="/credits" className={styles.allCredits}>
            Every credit in Tabi <ArrowRight aria-hidden="true" focusable="false" />
          </Link>
        </motion.div>
        <div className={styles.colophonGrid}>
          <motion.div variants={fadeUp}>
            <FactsStatus status={status} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <SourceList links={links} headingId={sourcesId} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <PhotoCredits brochure={brochure} credits={credits} pending={pending} loading={live.loading} headingId={photosId} />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
