import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { spreadPartnerPage } from '../../data/photoSpreads.js';
import { PAGE_TYPES } from '../../data/schema.js';
import { IconButton } from '../ui/index.js';
import { BrochurePage } from '../brochure/index.js';
import { ease } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { pad } from '../../lib/format.js';
import { pageHeading, SECTION_JP } from '../brochure/blocks/pageUtils.js';
import { Endpaper } from './Endpaper.jsx';
import { PageThumb } from './PageThumb.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import { BLANK, buildSpreads, isPageFace, spreadOf, spreadPages } from './studioFormat.js';
import styles from './PreviewStage.module.css';

const VIEWS = [
  { value: 'single', label: 'Page', sub: '単頁', lang: 'ja' },
  { value: 'spread', label: 'Spread', sub: '見開き', lang: 'ja' },
];

/** Pages slide in from the side you are heading towards, with a slight turn. */
const turn = {
  enter: (dir) => ({ opacity: 0, x: dir * 48, rotateY: dir * -10 }),
  center: { opacity: 1, x: 0, rotateY: 0, transition: { duration: 0.55, ease: ease.out } },
  exit: (dir) => ({ opacity: 0, x: dir * -36, rotateY: dir * 8, transition: { duration: 0.28, ease: ease.in } }),
};

/**
 * The Studio's centre stage: a live, full-size preview of the selected page
 * (or the spread it sits in), previous / next controls and a strip of
 * thumbnails for jumping around.
 *   <PreviewStage brochure={shell} pages={doc.pages} selectedIndex={i} onSelect={select} view="single" onViewChange={…} />
 */
export function PreviewStage({ brochure, pages, selectedIndex, onSelect, view, onViewChange }) {
  const reduce = useReducedMotion();
  const stripRef = useRef(null);
  const total = pages.length;
  const index = Math.min(Math.max(0, selectedIndex), total - 1);
  const page = pages[index];
  const spreads = useMemo(() => buildSpreads(total), [total]);
  const spreadIndex = spreadOf(index, total);

  // Remember which way we moved so the page turns the right way.
  const [nav, setNav] = useState({ index, dir: 1 });
  if (nav.index !== index) setNav({ index, dir: index > nav.index ? 1 : -1 });

  const canPrev = view === 'spread' ? spreadIndex > 0 : index > 0;
  const canNext = view === 'spread' ? spreadIndex < spreads.length - 1 : index < total - 1;
  const go = (delta) => {
    const target = view === 'spread' ? spreadPages(spreads[spreadIndex + delta])[0] : index + delta;
    if (pages[target]) onSelect(pages[target].id);
  };

  // Keep the selected thumbnail centred in the strip (without scrolling the page).
  useEffect(() => {
    const strip = stripRef.current;
    const thumb = strip?.querySelector(`[data-thumb="${page?.id}"]`);
    if (!strip || !thumb) return;
    strip.scrollTo({ left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [page?.id, reduce]);

  if (!page) return null;
  const meta = PAGE_TYPES[page.type];
  const spread = spreads[spreadIndex] ?? [null, index];
  const half = spread.some((face) => face === null);

  return (
    <section className={styles.stage} aria-label="Live preview">
      <div className={styles.bar}>
        <p className={styles.where} aria-live="polite">
          <span className={styles.folio}>
            {pad(index + 1)} <span className={styles.of}>/ {pad(total)}</span>
          </span>
          <span className={styles.label}>{meta?.label ?? 'Page'}</span>
          <span lang="ja" className={styles.jp}>
            {SECTION_JP[page.type] ?? ''}
          </span>
        </p>
        <SegmentedControl label="Preview layout" value={view} onChange={onViewChange} options={VIEWS} size="sm" className={styles.views} />
      </div>

      <div className={styles.desk}>
        <IconButton
          className={cn(styles.nav, styles.prev)}
          label={view === 'spread' ? 'Previous spread' : 'Previous page'}
          icon={<ChevronLeft />}
          variant="outline"
          tooltipSide="right"
          disabled={!canPrev}
          onClick={() => go(-1)}
        />
        <div className={styles.viewport}>
          <AnimatePresence initial={false} custom={nav.dir}>
            {view === 'spread' ? (
              <motion.div
                key={`spread-${spreadIndex}`}
                className={styles.spread}
                data-half={half || undefined}
                custom={nav.dir}
                variants={turn}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Faces sit by slot, as the reader binds them: [left, right]. */}
                {spread.map((face, slot) => {
                  const side = slot === 0 ? 'left' : 'right';
                  if (face === BLANK) return <Endpaper key="endpaper" brochure={brochure} className={styles.spreadBlank} data-side={side} />;
                  if (!isPageFace(face) || !pages[face]) return null;
                  return (
                    <button
                      key={pages[face].id}
                      type="button"
                      className={styles.spreadPage}
                      data-side={side}
                      aria-current={face === index ? 'page' : undefined}
                      aria-label={`Edit page ${face + 1}: ${pageHeading(pages[face], brochure)}`}
                      onClick={() => onSelect(pages[face].id)}
                    >
                      <BrochurePage brochure={brochure} page={pages[face]} index={face} total={total} isStatic facing partner={spreadPartnerPage(pages, face)} />
                    </button>
                  );
                })}
                {!half && <span className={styles.gutter} aria-hidden="true" />}
              </motion.div>
            ) : (
              <motion.div key={page.id} className={styles.frame} custom={nav.dir} variants={turn} initial="enter" animate="center" exit="exit">
                <BrochurePage brochure={brochure} page={page} index={index} total={total} active partner={spreadPartnerPage(pages, index)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <IconButton
          className={cn(styles.nav, styles.next)}
          label={view === 'spread' ? 'Next spread' : 'Next page'}
          icon={<ChevronRight />}
          variant="outline"
          tooltipSide="left"
          disabled={!canNext}
          onClick={() => go(1)}
        />
      </div>

      <div className={styles.stripWrap}>
        <div ref={stripRef} className={styles.strip} role="group" aria-label="All pages">
          {pages.map((p, i) => (
            <PageThumb key={p.id} brochure={brochure} page={p} partner={spreadPartnerPage(pages, i)} index={i} total={total} selected={i === index} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </section>
  );
}
