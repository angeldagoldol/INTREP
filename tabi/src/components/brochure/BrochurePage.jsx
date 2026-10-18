import { useLayoutEffect, useMemo, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { cn } from '../../lib/cn.js';
import { photoIdsIn } from '../../data/photos/registry.js';
import { spanOf, spreadPartner } from '../../data/photoSpreads.js';
import { PhotoContext } from '../photo/photoContext.js';
import { useLivePhotos } from '../photo/useLivePhotos.js';
import { BLOCKS, FULL_BLEED, FallbackBlock, HEADLESS } from './blocks/index.js';
import { Folio } from './blocks/Folio.jsx';
import { PageContext } from './blocks/pageContext.js';
import { pageLabel, themeVars } from './blocks/pageUtils.js';
import { PrintMarks } from './blocks/PrintMarks.jsx';
import { RunningHead } from './blocks/RunningHead.jsx';
import { SideLabel } from './blocks/SideLabel.jsx';
import { useFit } from './useFit.js';
import styles from './BrochurePage.module.css';

/** The photos a page draws (the back page credits them all): a live one arriving changes its copy, so it refits. */
function pagePhotoIds(page, brochure) {
  if (!page || typeof page !== 'object') return [];
  if (page.type === 'back') return photoIdsIn(brochure);
  return photoIdsIn({ cover: page.type === 'cover' ? brochure?.cover : null, pages: [page] });
}

/** Staggers the page's <Reveal> children when the page becomes active. */
const SHEET_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};

/**
 * One page of a brochure, art-directed per page type and scaled entirely in
 * container units: the same markup renders as a 90px thumbnail or a 900px
 * reader page. Fills its parent's width at an A-series ratio (1 : 1.414).
 *
 *   <BrochurePage brochure={b} page={b.pages[i]} index={i} total={b.pages.length} active onCta={…} />
 *
 * - `active`   plays a light entrance (stagger fade/rise) and starts counters each time it turns true.
 * - `isStatic` no motion and nothing focusable — thumbnails, flip back faces, studio previews.
 * - `onCta`    called by the contact page's button when it has no ctaUrl (rendered inert when absent or static).
 * - `facing`   the page is drawn beside its facing page (the reader's two-page view, spread thumbnails,
 *              the Studio's spread proof): each half of a double-page photo spread then draws its half
 *              of the photograph, so the two line up across the gutter. Otherwise (phones, print, a
 *              page on its own) each half is drawn as a complete page.
 * - `partner`  the other half of this page's spread, for hosts whose `brochure` has no `pages`
 *              (the Studio's shell); by default it is looked up in brochure.pages, where pages[index]
 *              must be this page. Only a correctly placed pair counts (data/photoSpreads.js).
 * Colours and heading typeface come from `brochure.theme`, never from the app theme.
 * Photos resolve in this brochure (PhotoContext), so "user:<key>" ids show its own uploads.
 * Copy regions marked data-fit shrink until nothing overflows (blocks/fit.js): text is never clipped.
 * Missing or empty fields are skipped; unknown page types get a quiet fallback.
 */
export function BrochurePage({ brochure, page, index = 0, total = 1, active = false, isStatic = false, onCta, facing = false, partner: givenPartner, className }) {
  const b = brochure && typeof brochure === 'object' ? brochure : {};
  const p = page && typeof page === 'object' ? page : {};
  const Block = BLOCKS[p.type] ?? FallbackBlock;
  const fullBleed = FULL_BLEED.has(p.type);
  const headless = !fullBleed && HEADLESS.has(p.type);
  const number = index + 1;
  const recto = number % 2 === 1;

  const pages = brochure?.pages;
  const partner = useMemo(() => {
    if (!spanOf(page)) return null;
    if (givenPartner !== undefined) return spanOf(givenPartner) ? givenPartner : null;
    return Array.isArray(pages) && pages[index] === page ? (pages[spreadPartner(pages, index)] ?? null) : null;
  }, [page, givenPartner, pages, index]);
  // A half of a spread drawn as a half: the page's own washi edges and crop marks would cut the picture.
  const half = facing && partner ? p.span : null;

  const vars = useMemo(() => themeVars(b.theme), [b.theme]);
  const context = useMemo(() => ({ isStatic, active, onCta, recto, facing }), [isStatic, active, onCta, recto, facing]);
  const ref = useRef(null);
  const photoIds = useMemo(() => pagePhotoIds(page, brochure), [page, brochure]);
  const live = useLivePhotos(photoIds);
  useFit(ref, p, b, live);

  // Replay the entrance whenever the page becomes active; inactive pages rest fully drawn.
  const controls = useAnimationControls();
  useLayoutEffect(() => {
    if (isStatic) return;
    if (active) {
      controls.set('hidden');
      controls.start('show');
    } else {
      controls.stop();
      controls.set('show');
    }
  }, [active, isStatic, controls]);

  const Sheet = isStatic ? 'div' : motion.div;
  const sheetProps = isStatic ? {} : { initial: false, animate: controls, variants: SHEET_VARIANTS };

  return (
    <article
      ref={ref}
      className={cn(styles.page, className)}
      style={vars}
      aria-label={pageLabel(p, b, index, total)}
      data-type={p.type ?? 'unknown'}
      data-typeface={b.theme?.typeface ?? 'serif'}
      data-static={isStatic || undefined}
      data-side={recto ? 'recto' : 'verso'}
      data-spread-half={half ?? undefined}
    >
      <PageContext.Provider value={context}>
        <PhotoContext.Provider value={b}>
          <Sheet className={cn(styles.sheet, fullBleed && styles.bleed, headless && styles.headless)} {...sheetProps}>
            {!fullBleed && !headless && <RunningHead brochure={b} />}
            <div className={styles.body}>
              <Block page={p} brochure={b} index={index} total={total} partner={partner} />
            </div>
            {!fullBleed && <Folio type={p.type} number={number} total={total} recto={recto} />}
            {!fullBleed && <SideLabel type={p.type} recto={recto} />}
            {!half && <PrintMarks recto={recto} />}
          </Sheet>
        </PhotoContext.Provider>
      </PageContext.Provider>
    </article>
  );
}
