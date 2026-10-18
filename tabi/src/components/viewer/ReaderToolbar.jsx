import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Heart, LayoutGrid, Maximize, Minimize, Printer, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { libraryPath } from '../../lib/librarySearch.js';
import { ease, spring } from '../../lib/motion.js';
import { Button, Hanko, IconButton } from '../ui/index.js';
import { stepZoom } from './layout.js';
import { MoreMenu } from './MoreMenu.jsx';
import { sealText } from './pageMeta.js';
import styles from './ReaderToolbar.module.css';

/** "04–05 / 11" with the section names underneath; the numbers roll on change. */
function PageIndicator({ label, total, caption }) {
  return (
    <div className={styles.indicator}>
      <p className={styles.count}>
        <span className={styles.roll}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              className={styles.now}
              initial={{ y: '105%' }}
              animate={{ y: '0%', transition: { duration: 0.5, ease: ease.out } }}
              exit={{ y: '-105%', transition: { duration: 0.3, ease: ease.in } }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className={styles.total}>/ {total}</span>
      </p>
      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  );
}

/** Heart toggle bound to the library's favourites. */
function FavoriteToggle({ brochure }) {
  const { isFavorite, toggleFavorite } = useBrochures();
  const saved = isFavorite(brochure.id);
  return (
    <IconButton
      label={saved ? 'Saved to favourites' : 'Save to favourites'}
      aria-pressed={saved}
      className={styles.favorite}
      data-saved={saved || undefined}
      onClick={() => toggleFavorite(brochure.id)}
      icon={
        <motion.span key={saved ? 'on' : 'off'} className={styles.heart} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy}>
          <Heart />
        </motion.span>
      }
    />
  );
}

/**
 * Reader toolbar under the navbar: back to the library, the brochure's
 * title block, the page indicator and the reading actions. Actions that do
 * not fit collapse into a "more" menu (all of them on phones).
 *
 * Props: brochure; indicator { label, total, caption }; onShare;
 * overview { open, onToggle, disabled }; zoom { value, canIn, canOut, onIn,
 * onOut, onReset }; fullscreen { supported, active, onToggle }; onPrint; onPlan.
 */
export function ReaderToolbar({ brochure, indicator, onShare, overview, zoom, fullscreen, onPrint, onPlan }) {
  const roomy = useMediaQuery('(min-width: 1180px)');
  const tablet = useMediaQuery('(min-width: 760px)');
  const percent = (value) => `${Math.round(value * 100)}%`;
  const zoomLabel = percent(zoom.value);

  const items = {
    overview: { id: 'overview', label: overview.open ? 'Close overview' : 'All pages', icon: <LayoutGrid />, onSelect: overview.onToggle, disabled: overview.disabled, hint: 'Grid' },
    share: { id: 'share', label: 'Share', icon: <Share2 />, onSelect: onShare },
    // Hints name the level each item zooms to.
    zoomIn: { id: 'zoom-in', label: 'Zoom in', icon: <ZoomIn />, onSelect: zoom.onIn, disabled: !zoom.canIn, hint: zoom.canIn ? percent(stepZoom(zoom.value, 1)) : undefined },
    zoomOut: { id: 'zoom-out', label: 'Zoom out', icon: <ZoomOut />, onSelect: zoom.onOut, disabled: !zoom.canOut, hint: zoom.canOut ? percent(stepZoom(zoom.value, -1)) : undefined },
    fullscreen: {
      id: 'fullscreen',
      label: fullscreen.active ? 'Exit full screen' : 'Full screen',
      icon: fullscreen.active ? <Minimize /> : <Maximize />,
      onSelect: fullscreen.onToggle,
    },
    print: { id: 'print', label: 'Print', icon: <Printer />, onSelect: onPrint },
  };
  const fs = fullscreen.supported ? [items.fullscreen] : [];
  const overflow = roomy
    ? []
    : tablet
      ? [items.share, items.zoomIn, items.zoomOut, ...fs, items.print]
      : [items.overview, items.share, items.zoomIn, items.zoomOut, ...fs, items.print];

  return (
    <header className={styles.toolbar}>
      <div className={styles.start}>
        {/* Back to the Library view the visitor came from, filters and all. */}
        <Button variant="ghost" size="sm" to={libraryPath()} iconLeft={<ArrowLeft />} className={styles.back} aria-label="Back to the library">
          <span className={styles.backLabel}>Library</span>
        </Button>
        <span className={styles.rule} aria-hidden="true" />
        <div className={styles.titleBlock}>
          <Hanko text={sealText(brochure)} size={34} className={styles.seal} />
          <div className={styles.titleText}>
            <h1 className={styles.title}>
              <span className={styles.titleMain}>{brochure.title || 'Untitled brochure'}</span>
              {brochure.titleJp && (
                <span lang="ja" className={styles.titleJp}>
                  {brochure.titleJp}
                </span>
              )}
            </h1>
            {brochure.organization && <p className={styles.org}>{brochure.organization}</p>}
          </div>
        </div>
      </div>

      {tablet && <PageIndicator {...indicator} />}

      <div className={styles.end}>
        <FavoriteToggle brochure={brochure} />
        {roomy && <IconButton label="Share" icon={<Share2 />} onClick={onShare} />}
        {tablet && (
          <IconButton
            label={overview.open ? 'Close overview' : 'All pages'}
            icon={<LayoutGrid />}
            className={styles.toggle}
            aria-pressed={overview.open}
            disabled={overview.disabled}
            onClick={overview.onToggle}
          />
        )}
        {roomy && (
          <div className={styles.zoom} role="group" aria-label="Zoom">
            <IconButton label="Zoom out" icon={<ZoomOut />} size="sm" onClick={zoom.onOut} disabled={!zoom.canOut} />
            <button type="button" className={styles.zoomValue} onClick={zoom.onReset} aria-label={`Zoom ${zoomLabel}. Reset zoom`} disabled={zoom.value === 1}>
              {zoomLabel}
            </button>
            <IconButton label="Zoom in" icon={<ZoomIn />} size="sm" onClick={zoom.onIn} disabled={!zoom.canIn} />
          </div>
        )}
        {roomy && fullscreen.supported && (
          <IconButton
            label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
            icon={fullscreen.active ? <Minimize /> : <Maximize />}
            onClick={fullscreen.onToggle}
          />
        )}
        {roomy && <IconButton label="Print" icon={<Printer />} onClick={onPrint} />}
        {overflow.length > 0 && <MoreMenu items={overflow} label="More reading actions" />}
        <Button variant="accent" size="sm" iconLeft={<CalendarDays />} onClick={onPlan} className={styles.plan}>
          {tablet ? 'Plan this trip' : 'Plan'}
        </Button>
      </div>
    </header>
  );
}
