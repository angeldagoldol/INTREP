import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Photo } from '../../../components/photo/Photo.jsx';
import { VerticalText } from '../../../components/ui/index.js';
import { japanMonth, seasonIdForMonth } from '../../../components/layout/japanTime.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { useLivePhotos } from '../../../components/photo/useLivePhotos.js';
import { SEASONS, SEASON_MAP } from '../../../data/seasons.js';
import { pluralize } from '../../../lib/format.js';
import { ease } from '../../../lib/motion.js';
import { SEASON_LINES, SEASON_PHOTOS, SEASON_SWATCH, SECTIONS } from '../homeContent.js';
import { countBy, tightRange } from '../homeStats.js';
import { SeasonMotif } from './SeasonMotif.jsx';
import { SectionHead } from './SectionHead.jsx';
import styles from './Seasons.module.css';

/** Hiragana readings shown beside each kanji. */
const KANA = { spring: 'はる', summer: 'なつ', autumn: 'あき', winter: 'ふゆ' };
const LAYOUT = { duration: 0.75, ease: ease.out };
const HOVER_INTENT_MS = 90;

const detail = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: ease.out, delay: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** The photo plate opens like a shutter from the panel's spine; a plain fade under reduced motion. */
const plateIn = {
  initial: { opacity: 0, clipPath: 'inset(0% 0% 0% 100%)' },
  animate: { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.95, ease: ease.out, delay: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const plateFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/**
 * One season of the accordion: a colour block that widens when chosen. An
 * open season shows its photograph as a full-height plate beside the text
 * (a band under the heading on phones) — only once the photo is downloaded;
 * until then the panel keeps its colour and emblem.
 */
function SeasonPanel({ season, count, active, isNow, ids, onChoose, onHover, onKeyDown, buttonRef }) {
  const reduce = useReducedMotion();
  const photoId = SEASON_PHOTOS[season.id];
  const live = useLivePhotos([photoId]);
  const photo = live.getPhoto(photoId);
  const hasPhoto = Boolean(photo?.available);
  return (
    <motion.div
      layout
      transition={LAYOUT}
      className={styles.panel}
      data-active={active || undefined}
      data-photo={hasPhoto || undefined}
      style={{ '--c': SEASON_SWATCH[season.id].fill, '--fg': SEASON_SWATCH[season.id].ink, borderRadius: 18 }}
      onPointerEnter={(event) => event.pointerType === 'mouse' && onHover(season.id)}
      onClick={() => onChoose(season.id)}
    >
      <motion.div layout="position" transition={LAYOUT} className={styles.motifWrap}>
        <SeasonMotif season={season.id} className={styles.motif} />
      </motion.div>

      <h3 className={styles.heading}>
        <button
          ref={buttonRef}
          type="button"
          id={ids.button}
          className={styles.trigger}
          aria-expanded={active}
          aria-controls={active ? ids.panel : undefined}
          onFocus={() => onChoose(season.id)}
          onKeyDown={onKeyDown}
        >
          <motion.span layout="position" transition={LAYOUT} className={styles.glyphs}>
            <span lang="ja" className={styles.kanji}>
              {season.jp}
            </span>
            <VerticalText className={styles.kana}>{KANA[season.id]}</VerticalText>
          </motion.span>
          <motion.span layout="position" transition={LAYOUT} className={styles.name}>
            <span className={styles.label}>{season.label}</span>
            <span className={styles.months}>{tightRange(season.months)}</span>
          </motion.span>
        </button>
      </h3>

      {isNow && (
        <motion.span layout="position" transition={LAYOUT} className={styles.now}>
          Now in Japan
        </motion.span>
      )}

      <AnimatePresence initial={false}>
        {active && hasPhoto && (
          <motion.div key="plate" layout="position" transition={LAYOUT} className={styles.plate} {...(reduce ? plateFade : plateIn)}>
            <Photo id={photoId} sizes="(min-width: 761px) 32vw, 100vw" credit="overlay" />
            {photo.caption && <p className={styles.plateCaption}>{photo.caption}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {active && (
          <motion.div key="detail" id={ids.panel} role="region" aria-labelledby={ids.button} className={styles.detail} {...detail}>
            <p className={styles.motifName}>{season.motif}</p>
            <p className={styles.line}>{SEASON_LINES[season.id]}</p>
            <Link to={`/brochures?season=${season.id}`} className={styles.link} onClick={(event) => event.stopPropagation()}>
              {count > 0 ? `${pluralize(count, 'brochure')} for ${season.label.toLowerCase()}` : 'Browse the library'}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * 04 四季 — a four-panel accordion of the seasons. Hover (mouse), focus or
 * click opens a season, tints the whole section in its colour and shows its
 * photograph and brochures. Opens on the current season in Japan. Arrow keys
 * move between seasons; on phones the panels stack.
 */
export function Seasons() {
  const { brochures } = useBrochures();
  const counts = useMemo(() => countBy(brochures, 'seasons'), [brochures]);
  const [now] = useState(() => seasonIdForMonth(japanMonth()));
  const [active, setActive] = useState(now);
  const hoverTimer = useRef(0);
  const buttons = useRef([]);
  const baseId = useId();

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const choose = (id) => {
    window.clearTimeout(hoverTimer.current);
    setActive(id);
  };

  // A short hover intent stops panels flickering as the pointer sweeps across.
  const hover = (id) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setActive(id), HOVER_INTENT_MS);
  };

  const onKeyDown = (event, index) => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (event.key in moves) next = (index + moves[event.key] + SEASONS.length) % SEASONS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = SEASONS.length - 1;
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  };

  return (
    <section className={styles.section} style={{ '--season': SEASON_MAP[active].color }}>
      <div className="container">
        <SectionHead
          section={SECTIONS.seasons}
          title={['A different Japan, ', { text: 'every', className: 'serif-italic' }, ' season']}
          intro="Japanese travel is planned around shiki, the four seasons. Choose one to see what it brings — and which brochures fit."
        />

        <div className={styles.panels} onPointerLeave={() => window.clearTimeout(hoverTimer.current)}>
          {SEASONS.map((season, index) => (
            <SeasonPanel
              key={season.id}
              season={season}
              count={counts[season.id] ?? 0}
              active={season.id === active}
              isNow={season.id === now}
              ids={{ button: `${baseId}-${season.id}-tab`, panel: `${baseId}-${season.id}-panel` }}
              onChoose={choose}
              onHover={hover}
              onKeyDown={(event) => onKeyDown(event, index)}
              buttonRef={(node) => {
                buttons.current[index] = node;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
