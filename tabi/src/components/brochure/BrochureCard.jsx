import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BadgeCheck, Heart, PenLine } from 'lucide-react';
import { Badge, Hanko, IconButton, Tilt, VerticalText } from '../ui/index.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { preloadBrochure } from '../../data/catalog.js';
import { getCategory } from '../../data/categories.js';
import { getRegion } from '../../data/regions.js';
import { FORMATS } from '../../data/schema.js';
import { SEASON_MAP } from '../../data/seasons.js';
import { cn } from '../../lib/cn.js';
import { ease, spring } from '../../lib/motion.js';
import { pad, pluralize, sealChars } from '../../lib/format.js';
import { Photo } from '../photo/Photo.jsx';
import { CoverArt } from './CoverArt.jsx';
import { shortFactsChecked } from './factsChecked.js';
import styles from './BrochureCard.module.css';

const MAX_STAGGER = 8;

const entrance = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: ease.out, delay: Math.min(i, MAX_STAGGER) * 0.06 },
  }),
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.22, ease: ease.in } },
};

const BURST = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const reach = i % 2 ? 20 : 27;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, rotate: (i * 47) % 180, petal: i % 2 === 0 };
});

const NO_CATEGORY = { id: '', label: 'Uncategorised', jp: '旅', color: 'var(--ink-3)' };
const NO_REGION = { id: '', label: 'Japan', jp: '日本' };

/** Category/region lookups that never return an unlabelled entry. */
function lookup(get, id, fallback) {
  const found = id ? get(id) : null;
  return found?.label ? found : fallback;
}

/** Everything a card shows, with safe fallbacks for half-finished user brochures. */
function describe(brochure) {
  const theme = brochure.theme ?? {};
  const titleJp = String(brochure.titleJp ?? '').trim() || '旅';
  const pages = Array.isArray(brochure.pages) ? brochure.pages.length : 0;
  const seasons = (Array.isArray(brochure.seasons) ? brochure.seasons : []).map((id) => SEASON_MAP[id]).filter(Boolean);
  return {
    title: String(brochure.title ?? '').trim() || 'Untitled brochure',
    titleJp,
    seal: sealChars(titleJp),
    summary: String(brochure.summary ?? '').trim(),
    organization: String(brochure.organization ?? '').trim(),
    category: lookup(getCategory, brochure.category, NO_CATEGORY),
    region: lookup(getRegion, brochure.region, NO_REGION),
    format: FORMATS.find((f) => f.id === brochure.format)?.label ?? 'Booklet',
    seasons,
    pages,
    minutes: Number.isFinite(brochure.readMinutes) ? brochure.readMinutes : null,
    factsChecked: String(brochure.factsChecked ?? '').trim(),
    checkedShort: shortFactsChecked(brochure.factsChecked),
    isUser: brochure.source === 'user',
    vars: {
      '--b-paper': theme.paper || 'var(--page-paper)',
      '--b-ink': theme.ink || 'var(--wa-sumi)',
      '--b-accent': theme.accent || 'var(--wa-shu)',
      // Vertical title fits its slip: fewer characters, bigger type.
      '--b-jp': `${Math.min(8.5, 44 / Math.max(2, Array.from(titleJp).length))}cqw`,
    },
  };
}

/**
 * The cover as a physical object: the cover photograph (the generative art
 * until it is downloaded, or for brochures without one) with a title slip
 * (題簽) and paper band (帯), a binding crease, a stack of page edges on the
 * right and the first inner page waiting underneath. Decorative: the card's
 * text carries the meaning.
 */
function Book({ brochure, data, live }) {
  const cover = brochure.cover ?? {};
  const photo = typeof cover.photo === 'string' ? cover.photo.trim() : '';
  const art = <CoverArt style={cover.art} seed={cover.seed} theme={brochure.theme} animated={live} />;
  return (
    <div className={styles.book} aria-hidden="true">
      <span className={styles.edges} />
      <span className={styles.inner}>
        <span className={styles.innerRule} />
        <span className={styles.innerLines} />
        <VerticalText className={styles.innerJp}>{data.region.jp}</VerticalText>
        <span className={styles.innerFolio}>02</span>
      </span>
      <span className={styles.cover}>
        <span className={styles.art}>
          {photo ? <Photo id={photo} brochure={brochure} alt="" sizes="(min-width: 1100px) 300px, 50vw" className={styles.photo} fallback={art} /> : art}
        </span>
        <span className={styles.daisen}>
          <VerticalText className={styles.daisenText}>{data.titleJp}</VerticalText>
        </span>
        {/* 帯 obi: on a real book the band carries the endorsement — here, that the facts were checked. */}
        <span className={styles.obi}>
          {data.checkedShort ? (
            <span className={`${styles.obiLabel} ${styles.checked}`}>
              <BadgeCheck focusable="false" />
              <span className={styles.checkedLong}>Facts checked&nbsp;</span>
              {data.checkedShort}
            </span>
          ) : (
            <span className={styles.obiLabel}>
              {data.region.label} · {data.format}
            </span>
          )}
          <Hanko text={data.seal} className={styles.seal} />
        </span>
        <span className={styles.spine} />
        <span className={styles.sheen} />
      </span>
    </div>
  );
}

/** Heart toggle with a small burst of petals when a brochure is saved. */
function FavoriteButton({ id, title, size = 'sm' }) {
  const { isFavorite, toggleFavorite } = useBrochures();
  const reduceMotion = useReducedMotion();
  const saved = isFavorite(id);
  const [burst, setBurst] = useState(0);

  const onClick = () => {
    if (!saved && !reduceMotion) setBurst((n) => n + 1);
    toggleFavorite(id);
  };

  return (
    <span className={styles.fav}>
      <IconButton
        label={saved ? 'Saved' : 'Save'}
        aria-label={`Save “${title}” to favourites`}
        aria-pressed={saved}
        size={size}
        tooltipSide="top"
        className={styles.favButton}
        data-saved={saved || undefined}
        onClick={onClick}
        icon={
          <motion.span
            key={saved ? 'on' : 'off'}
            className={styles.heart}
            initial={reduceMotion ? false : { scale: saved ? 0.4 : 0.8 }}
            animate={{ scale: 1 }}
            transition={spring.bouncy}
          >
            <Heart />
          </motion.span>
        }
      />
      {burst > 0 && (
        <span key={burst} className={styles.burst} aria-hidden="true">
          <motion.span
            className={styles.ring}
            initial={{ scale: 0.3, opacity: 0.7 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 0.6, ease: ease.out }}
          />
          {BURST.map((p, i) => (
            <motion.span
              key={i}
              className={p.petal ? styles.petal : styles.spark}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, scale: 1, opacity: 0, rotate: p.rotate }}
              transition={{ duration: 0.75, ease: ease.out, opacity: { duration: 0.75, ease: ease.in } }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

/** Season kanji in their wa-iro colours (spoken via the card description). */
function SeasonMarks({ seasons }) {
  if (!seasons.length) return null;
  return (
    <span className={styles.seasons} aria-hidden="true">
      {seasons.map((s) => (
        <span key={s.id} lang="ja" style={{ '--season': s.color }}>
          {s.jp}
        </span>
      ))}
    </span>
  );
}

/**
 * A brochure in the library, on the home shelf or in "more like this".
 *
 *   <BrochureCard brochure={b} index={i} variant="grid" layout />
 *
 * - `brochure` a Brochure (data/schema.js); missing fields degrade gracefully.
 * - `variant`  'grid' (default) cover-led card · 'list' compact contents-page
 *              row · 'feature' larger card with summary for carousels.
 * - `index`    position in the list: staggers the entrance and numbers list rows.
 * - `layout`   animate position changes (filtering/sorting) inside a LayoutGroup.
 * - `ref`      forwarded to the <article> (AnimatePresence mode="popLayout").
 *
 * The whole card is one link to the viewer; the favourite (and, for the
 * visitor's own brochures, edit) controls sit beside it, never inside it.
 */
export function BrochureCard({ brochure, index, variant = 'grid', layout = false, className, ref }) {
  const uid = useId();
  const [live, setLive] = useState(false);
  if (!brochure) return null;

  const data = describe(brochure);
  const titleId = `${uid}-title`;
  const metaId = `${uid}-meta`;
  const isList = variant === 'list';
  const isFeature = variant === 'feature';
  const animatedEntrance = index != null;

  const book = <Book brochure={brochure} data={data} live={live && !isList} />;
  const facts = [
    { key: 'region', text: data.region.label },
    data.pages > 0 && { key: 'pages', text: pluralize(data.pages, 'page') },
    data.minutes != null && { key: 'minutes', text: `${data.minutes} min read`, short: `${data.minutes} min` },
  ].filter(Boolean);

  return (
    <motion.article
      ref={ref}
      className={cn(styles.card, styles[variant] ?? styles.grid, className)}
      style={data.vars}
      layout={layout ? 'position' : undefined}
      variants={entrance}
      custom={index ?? 0}
      initial={animatedEntrance ? 'hidden' : false}
      animate="show"
      exit="exit"
      data-variant={variant}
      data-user={data.isUser || undefined}
    >
      <Link
        to={`/brochures/${encodeURIComponent(brochure.slug ?? '')}`}
        className={styles.link}
        aria-labelledby={titleId}
        aria-describedby={metaId}
        onPointerEnter={() => {
          setLive(true);
          preloadBrochure(brochure); // a built-in's pages are their own chunk
        }}
        onPointerLeave={() => setLive(false)}
        onFocus={() => {
          setLive(true);
          preloadBrochure(brochure);
        }}
        onBlur={() => setLive(false)}
      >
        {isList && index != null && (
          <span className={styles.num} aria-hidden="true">
            {pad(index + 1)}
          </span>
        )}

        <div className={styles.stage}>
          {isList ? book : <Tilt max={isFeature ? 5 : 6} className={styles.tilt}>{book}</Tilt>}
          {data.isUser && !isList && <Badge variant="solid" className={styles.yours}>Yours</Badge>}
        </div>

        <div className={styles.meta}>
          <p className={styles.kicker} style={{ '--dot': data.category.color }}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.kickerLabel}>{data.category.label}</span>
            <span className={styles.kickerShort} aria-hidden="true">
              {data.category.label.split(' & ')[0]}
            </span>
            {data.isUser && isList && <Badge variant="solid">Yours</Badge>}
            {isList && (
              <span lang="ja" className={styles.kickerJp} aria-hidden="true">
                {data.category.jp}
              </span>
            )}
          </p>

          <h3 className={styles.title}>
            <span id={titleId} className={styles.titleText}>
              {data.title}
            </span>
            {isList && (
              <span lang="ja" className={styles.titleJp} aria-hidden="true">
                {data.titleJp}
              </span>
            )}
          </h3>

          {!isList && (data.organization || data.seasons.length > 0) && (
            <p className={styles.org}>
              <span className={styles.orgName}>{data.organization}</span>
              {!isFeature && <SeasonMarks seasons={data.seasons} />}
            </p>
          )}
          {data.summary && (isList || isFeature) && <p className={styles.summary}>{data.summary}</p>}

          <p id={metaId} className={styles.facts}>
            <span className="sr-only">
              {data.isUser ? 'Your brochure. ' : ''}
              {data.category.label}.{' '}
              {data.seasons.length > 0 && `Best in ${data.seasons.map((s) => s.label.toLowerCase()).join(' and ')}. `}
              {data.factsChecked && `Facts checked ${data.factsChecked}. `}
            </span>
            {facts.map((fact) => (
              <span key={fact.key} className={styles.fact} data-fact={fact.key}>
                {fact.short ? (
                  <>
                    <span className={styles.factLong}>{fact.text}</span>
                    <span className={styles.factShort}>{fact.short}</span>
                  </>
                ) : (
                  fact.text
                )}
              </span>
            ))}
            {isList && <SeasonMarks seasons={data.seasons} />}
          </p>

          {isFeature && (
            <span className={styles.read} aria-hidden="true">
              Read
              <span className={styles.readIcon}>
                <ArrowRight />
              </span>
            </span>
          )}
        </div>

        {isList && (
          <span className={styles.go} aria-hidden="true">
            <ArrowUpRight />
          </span>
        )}
      </Link>

      <span className={styles.actions}>
        {data.isUser && brochure.id && (
          <IconButton
            to={`/studio/${encodeURIComponent(brochure.id)}`}
            label="Edit"
            aria-label={`Edit “${data.title}” in the Studio`}
            icon={<PenLine />}
            size="sm"
            tooltipSide="top"
            className={styles.edit}
          />
        )}
        {brochure.id && <FavoriteButton id={brochure.id} title={data.title} />}
      </span>
    </motion.article>
  );
}
