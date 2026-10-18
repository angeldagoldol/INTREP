import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookDashed, RotateCcw } from 'lucide-react';
import { Button, IconButton, Kbd, VerticalText } from '../../components/ui/index.js';
import {
  Flipbook,
  Overview,
  ReaderToolbar,
  Scrubber,
  ThumbRail,
  PAGE_RATIO,
  READABLE_PAGE_WIDTH,
  ZOOM_LEVELS,
  buildBook,
  clampPan,
  computeBookLayout,
  pageAtPosition,
  positionOfPage,
  requestPrint,
  spreadAnnouncement,
  spreadCaption,
  spreadLabel,
  stepZoom,
  useElementSize,
  useFullscreen,
} from '../../components/viewer/index.js';
import { useHotkey } from '../../hooks/useHotkey.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { pad } from '../../lib/format.js';
import { libraryPath } from '../../lib/librarySearch.js';
import { saveProgress } from '../../lib/progress.js';
import { spring } from '../../lib/motion.js';
import { isMostlyVisible, ownsPageKeys, READER_KEYS, VISIBILITY_THRESHOLDS } from './readerKeys.js';
import { usePageParam } from './usePageParam.js';
import { useShare } from './useShare.js';
import styles from './Reader.module.css';

/**
 * Breathing room around the book: wide stages keep space for the side
 * arrows. The book is height-bound on most screens, so the vertical margin
 * is only what a turning leaf needs: lifted towards the reader (perspective
 * 8× the page width), its outer edge grows by up to ~7% of the page height
 * at each end, and ~6.4% of the stage height keeps that inside the stage
 * instead of clipping it against the toolbars.
 */
function stagePadding(width, height) {
  if (width < 600) return { padX: 14, padY: 14 };
  const padY = Math.round(Math.min(96, Math.max(20, height * 0.064)));
  return { padX: width >= 900 ? 96 : 72, padY };
}

/**
 * Under the stage: the counter and arrows (phones), the scrubber, the key
 * hint and the filmstrip of spreads. With `peek` (760px and up) the
 * filmstrip waits folded under the bar and rises over the foot of the stage
 * while the bar is hovered, focused or scrubbed, so the book keeps that
 * height; it also stands in for the scrubber's preview bubble, lighting up
 * the spread under the pointer.
 */
function BottomBar({ brochure, book, position, onGo, onPrev, onNext, sideArrows, peek, reduce, prevRef, nextRef }) {
  const [preview, setPreview] = useState(null);
  const spread = book.spreads[position];
  const lastPosition = book.spreads.length - 1;

  return (
    <div className={styles.bottom} data-peek={peek || undefined}>
      <div className={styles.scrubRow}>
        {!sideArrows && (
          <IconButton ref={prevRef} label="Previous page" icon={<ArrowLeft />} variant="outline" onClick={onPrev} disabled={position === 0} tooltip={false} />
        )}
        <p className={styles.counter} aria-hidden="true">
          <span className={styles.counterNow}>{spreadLabel(spread)}</span>
          <span className={styles.counterTotal}>/ {pad(book.count)}</span>
        </p>
        <Scrubber brochure={brochure} book={book} position={position} onChange={onGo} bubble={!peek} onPreview={peek ? setPreview : undefined} />
        {sideArrows ? (
          <p className={styles.keys}>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span>turn</span>
            <span className={styles.keysSep} aria-hidden="true" />
            {/* The reduced-motion book cross-fades: no corner to drag. */}
            <span>{reduce ? 'click a page edge' : 'drag a corner'}</span>
          </p>
        ) : (
          <IconButton ref={nextRef} label="Next page" icon={<ArrowRight />} variant="outline" onClick={onNext} disabled={position === lastPosition} tooltip={false} />
        )}
      </div>
      <div className={styles.rail}>
        <div className={styles.dock}>
          <ThumbRail brochure={brochure} book={book} position={position} onSelect={onGo} smooth={!reduce} preview={peek ? preview : null} />
        </div>
      </div>
    </div>
  );
}

/** Drag-to-pan and wheel-to-pan for a zoomed book; springs back inside its limits (home at 1×) whenever they change. */
function usePan(stageRef, { zoom, layout, size }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const drag = useRef(null);

  const bounds = useCallback(
    (nx, ny) =>
      clampPan({
        x: nx,
        y: ny,
        zoom,
        bookWidth: layout.bookWidth,
        bookHeight: layout.bookHeight,
        stageWidth: size.width,
        stageHeight: size.height,
      }),
    [zoom, layout.bookWidth, layout.bookHeight, size.width, size.height],
  );

  // Re-clamp whenever the zoom or the stage changes (and centre at 1×).
  useEffect(() => {
    const next = bounds(x.get(), y.get());
    const a = animate(x, next.x, spring.gentle);
    const b = animate(y, next.y, spring.gentle);
    return () => {
      a.stop();
      b.stop();
    };
  }, [bounds, x, y]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || zoom <= 1) return undefined;
    const onWheel = (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const next = bounds(x.get() - event.deltaX, y.get() - event.deltaY);
      x.set(next.x);
      y.set(next.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stageRef, zoom, bounds, x, y]);

  const handlers = {
    onPointerDown: (event) => {
      if (zoom <= 1 || event.button !== 0 || event.target.closest('a, button, input, [role="slider"]')) return;
      drag.current = { id: event.pointerId, sx: event.clientX, sy: event.clientY, x: x.get(), y: y.get() };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const next = bounds(d.x + event.clientX - d.sx, d.y + event.clientY - d.sy);
      x.set(next.x);
      y.set(next.y);
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };

  return { x, y, handlers };
}

/** FLIP for zoom: start at the old size, spring to the new one. */
function useZoomBridge(zoom, reduce) {
  const scale = useMotionValue(1);
  const previous = useRef(zoom);
  useLayoutEffect(() => {
    if (previous.current === zoom) return undefined;
    const from = previous.current / zoom;
    previous.current = zoom;
    if (reduce) return undefined;
    scale.set(from);
    const run = animate(scale, 1, spring.gentle);
    return () => run.stop();
  }, [zoom, reduce, scale]);
  return scale;
}

/**
 * The reading room: toolbar, the flipbook on its stage, the scrubber and
 * thumbnail filmstrip, and the overview grid. Owns page (in ?p=), zoom,
 * pan, overview and fullscreen state.
 * Props: brochure; onPlan opens the trip planner; planOpen pauses the
 * page-turn shortcuts while it is open.
 *
 * Keyboard: ←/→ turn, PageUp/PageDown/Home/End turn too while focus is in
 * the reader or on the page itself, + − 0 zoom. All of them switch off
 * while the reader is mostly scrolled out of view, so the keys scroll the
 * rest of the page again.
 */
export function Reader({ brochure, onPlan, planOpen = false }) {
  const pages = useMemo(() => (Array.isArray(brochure.pages) ? brochure.pages : []), [brochure.pages]);
  const count = pages.length;
  const reduce = useReducedMotion();
  const peek = useMediaQuery('(min-width: 760px)');
  const readerRef = useRef(null);
  const stageRef = useRef(null);
  const viewportRef = useRef(null);
  const prevArrowRef = useRef(null);
  const nextArrowRef = useRef(null);
  const size = useElementSize(stageRef);
  const [zoom, setZoom] = useState(1);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [page, setPage] = usePageParam(count);
  const fullscreen = useFullscreen(readerRef);
  const share = useShare(brochure);

  // Where to resume from the Library's "Continue reading" (lib/progress.js).
  useEffect(() => {
    if (count > 0) saveProgress(brochure.id, page);
  }, [brochure.id, page, count]);

  // The drawer is portalled to <body>, which is inert while the reader is
  // fullscreen: wait until the document has left fullscreen, or the drawer
  // would open without focus and ignore Esc.
  const { active: fullscreenActive, exit: exitFullscreen } = fullscreen;
  const plan = useCallback(async () => {
    if (fullscreenActive) await exitFullscreen();
    onPlan();
  }, [fullscreenActive, exitFullscreen, onPlan]);

  // Zoom re-lays the book out at its real size (text stays crisp); the
  // scale animation below only bridges the jump. On a short stage the page
  // keeps a readable width and the stage scrolls (`scrolls`) instead.
  const padding = stagePadding(size.width, size.height);
  const { base, layout } = useMemo(() => {
    const fit = computeBookLayout({ width: size.width, height: size.height, ...stagePadding(size.width, size.height), readableWidth: READABLE_PAGE_WIDTH });
    const pageWidth = Math.round(fit.pageWidth * zoom);
    return { base: fit, layout: { ...fit, pageWidth, pageHeight: Math.round(pageWidth * PAGE_RATIO) } };
  }, [size.width, size.height, zoom]);
  const zoomScale = useZoomBridge(zoom, reduce);
  const book = useMemo(() => buildBook(count, base.mode), [count, base.mode]);
  const position = positionOfPage(book, page);
  const lastPosition = book.spreads.length - 1;
  const spread = book.spreads[position];
  const pan = usePan(stageRef, { zoom, layout: base, size });
  const zoomed = zoom > 1;
  const scrolls = !zoomed && base.overflows;

  // Leaving the scrolling layout (zooming in, a taller window): back to the top.
  useLayoutEffect(() => {
    if (!scrolls && viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [scrolls]);

  // The latest requested position, so rapid input stacks up instead of repeating.
  const target = useRef(position);
  useEffect(() => {
    target.current = position;
  }, [position]);

  const go = useCallback(
    (next) => {
      const clamped = Math.min(Math.max(next, 0), lastPosition);
      target.current = clamped;
      // An arrow that is about to disable would drop focus to <body>: hand it to the other one.
      if (lastPosition > 0) {
        const active = document.activeElement;
        if (clamped === lastPosition && active && active === nextArrowRef.current) prevArrowRef.current?.focus({ preventScroll: true });
        else if (clamped === 0 && active && active === prevArrowRef.current) nextArrowRef.current?.focus({ preventScroll: true });
      }
      setPage(pageAtPosition(book, clamped));
    },
    [book, lastPosition, setPage],
  );
  const goToPage = useCallback((index) => go(positionOfPage(book, index)), [book, go]);
  const next = useCallback(() => go(target.current + 1), [go]);
  const prev = useCallback(() => go(target.current - 1), [go]);

  // The shortcuts belong to the reader only while it is (mostly) on screen.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = readerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) =>
        setInView(
          isMostlyVisible({
            visible: entry.intersectionRect.height,
            height: entry.boundingClientRect.height,
            viewport: entry.rootBounds?.height ?? window.innerHeight,
          }),
        ),
      { threshold: VISIBILITY_THRESHOLDS },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reading = !overviewOpen && !planOpen && count > 0 && (inView || fullscreenActive);
  // PageUp/PageDown/Home/End only when focus is in the reader or on the page itself.
  const onPageKey = useCallback(
    (event) => {
      if (!ownsPageKeys(event.target, readerRef.current)) return;
      event.preventDefault();
      if (READER_KEYS.pageNext.includes(event.key)) next();
      else if (READER_KEYS.pagePrev.includes(event.key)) prev();
      else go(READER_KEYS.first.includes(event.key) ? 0 : lastPosition);
    },
    [next, prev, go, lastPosition],
  );
  useHotkey(READER_KEYS.next, next, { enabled: reading });
  useHotkey(READER_KEYS.prev, prev, { enabled: reading });
  useHotkey([...READER_KEYS.pageNext, ...READER_KEYS.pagePrev, ...READER_KEYS.first, ...READER_KEYS.last], onPageKey, {
    enabled: reading,
    preventDefault: false,
  });
  useHotkey(READER_KEYS.zoomIn, () => setZoom((z) => stepZoom(z, 1)), { enabled: reading });
  useHotkey(READER_KEYS.zoomOut, () => setZoom((z) => stepZoom(z, -1)), { enabled: reading });
  useHotkey(READER_KEYS.zoomReset, () => setZoom(1), { enabled: reading });

  const caption = spreadCaption(spread, pages);
  const announcement = count ? `${spreadAnnouncement(spread, count)}${caption ? `: ${caption}` : ''}` : '';
  const sideArrows = size.width >= 600;
  const zoomIndex = ZOOM_LEVELS.indexOf(zoom);

  return (
    <section ref={readerRef} className={styles.reader} aria-label="Brochure reader" data-print="hide">
      <ReaderToolbar
        brochure={brochure}
        indicator={{ label: spreadLabel(spread), total: pad(count), caption }}
        onShare={share}
        overview={{ open: overviewOpen, onToggle: () => setOverviewOpen((o) => !o), disabled: count === 0 }}
        zoom={{
          value: zoom,
          canIn: zoomIndex < ZOOM_LEVELS.length - 1,
          canOut: zoomIndex > 0,
          onIn: () => setZoom(stepZoom(zoom, 1)),
          onOut: () => setZoom(stepZoom(zoom, -1)),
          onReset: () => setZoom(1),
        }}
        fullscreen={{ supported: fullscreen.supported, active: fullscreen.active, onToggle: fullscreen.toggle }}
        onPrint={requestPrint}
        onPlan={plan}
      />

      <div className={styles.body}>
        <div
          ref={stageRef}
          className={styles.stage}
          data-zoomed={zoomed || undefined}
          data-mode={layout.mode}
          {...pan.handlers}
        >
          <div className={styles.surface} aria-hidden="true">
            <VerticalText className={styles.watermark}>{brochure.titleJp || '旅'}</VerticalText>
            <span className={styles.crop} data-corner="tl" />
            <span className={styles.crop} data-corner="tr" />
            <span className={styles.crop} data-corner="bl" />
            <span className={styles.crop} data-corner="br" />
          </div>

          {count === 0 ? (
            <div className={styles.empty}>
              <BookDashed aria-hidden="true" />
              <h2>This brochure has no pages yet</h2>
              <p>Add a cover and a few pages in the Studio, then come back to read it here.</p>
              <Button variant="primary" to={brochure.source === 'user' ? `/studio/${encodeURIComponent(brochure.id)}` : libraryPath()}>
                {brochure.source === 'user' ? 'Open in Studio' : 'Back to the library'}
              </Button>
            </div>
          ) : (
            size.width > 0 && (
              <div ref={viewportRef} className={styles.viewport} data-scroll={scrolls || undefined}>
                <motion.div
                  className={styles.pan}
                  style={{ x: pan.x, y: pan.y, height: scrolls ? layout.bookHeight + padding.padY * 2 : undefined }}
                >
                  <motion.div className={styles.center} style={{ scale: zoomScale }}>
                    <Flipbook
                      brochure={brochure}
                      book={book}
                      position={position}
                      onNavigate={go}
                      layout={layout}
                      onCta={plan}
                      interactive={!zoomed}
                      label={`${brochure.title} — ${count} pages`}
                    />
                  </motion.div>
                </motion.div>
              </div>
            )
          )}

          {count > 0 && sideArrows && (
            <>
              <span className={styles.arrow} data-side="prev">
                <IconButton
                  ref={prevArrowRef}
                  label="Previous page"
                  icon={<ArrowLeft />}
                  variant="outline"
                  size="lg"
                  tooltipSide="right"
                  onClick={prev}
                  disabled={position === 0}
                />
              </span>
              <span className={styles.arrow} data-side="next">
                <IconButton
                  ref={nextArrowRef}
                  label="Next page"
                  icon={<ArrowRight />}
                  variant="outline"
                  size="lg"
                  tooltipSide="left"
                  onClick={next}
                  disabled={position === lastPosition}
                />
              </span>
            </>
          )}

          <AnimatePresence>
            {zoomed && (
              <motion.div
                className={styles.zoomPill}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={spring.snappy}
              >
                <span className="mono">{Math.round(zoom * 100)}%</span>
                <span className={styles.zoomHint}>Drag or scroll to pan</span>
                <button type="button" className={styles.zoomReset} onClick={() => setZoom(1)}>
                  <RotateCcw aria-hidden="true" />
                  Reset
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {count > 0 && (
          <BottomBar
            brochure={brochure}
            book={book}
            position={position}
            onGo={go}
            onPrev={prev}
            onNext={next}
            sideArrows={sideArrows}
            peek={peek}
            reduce={reduce}
            prevRef={prevArrowRef}
            nextRef={nextArrowRef}
          />
        )}

        <AnimatePresence>
          {overviewOpen && (
            <Overview
              brochure={brochure}
              book={book}
              position={position}
              onSelect={(index) => {
                goToPage(index);
                setOverviewOpen(false);
              }}
              onClose={() => setOverviewOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
