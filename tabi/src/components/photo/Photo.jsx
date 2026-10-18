import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { PhotoContext, PrintPhotosContext } from './photoContext.js';
import { PhotoCredit } from './PhotoCredit.jsx';
import { renderedWidth } from './renderedWidth.js';
import { reportLiveImage, useLivePhotos } from './useLivePhotos.js';
import styles from './Photo.module.css';

/** How long the art stays under a live photo after it has loaded (its fade-in is 700 ms). */
const UNDERLAY_MS = 900;

const DEFAULT_SIZES = '(min-width: 900px) 50vw, 100vw';
/** The one file a printed photo uses (an A4 page at ~150 dpi). */
const PRINT_WIDTH = 1280;

/**
 * A real photograph from the photo registry (src/data/photos) or one the
 * brochure carries itself (brochure.userPhotos, ids "user:<key>"), drawn the
 * way print does it: the dominant colour and a blurred preview hold the space,
 * then the picture sharpens in. A photo not bundled with the site is shown
 * live from Wikimedia Commons once the browser has looked it up
 * (data/photos/live.js; this component asks for it): the `fallback` art holds
 * the space while the picture travels, then the photo sharpens in over it.
 * Until there is a photo — or if it fails to load — the `fallback` (usually
 * the brochure's <CoverArt>) stands in, filling the same box, so pages always
 * look finished.
 *
 *   <Photo id="kyoto-senbon-torii" sizes="(min-width: 900px) 50vw, 100vw"
 *          credit="overlay" fallback={<CoverArt style="torii" seed={5} theme={theme} />} />
 *
 * - `id` | `photo`  a photo id (registry or "user:<key>"), or a record from resolvePhoto()
 *                   (a registry record not available yet is looked up again, so it turns live).
 * - `brochure`      where "user:<key>" ids are looked up; defaults to the surrounding
 *                   <PhotoContext> (every <BrochurePage> provides its brochure).
 * - `alt`           overrides the manifest's alt text (falling back to its caption);
 *                   '' makes the photo decorative.
 * - `sizes`         a first guess at the slot's width, for srcset. Once laid out, the
 *                   frame measures itself and replaces it with the width the picture is
 *                   really drawn at — wider than the slot when `cover` crops a landscape
 *                   photo into a portrait box — so thumbnails fetch the 480 and covers
 *                   never upscale. `priority` loads eagerly with high fetch priority. Inside
 *                   <PrintPhotosContext value> (the print edition) every photo loads eagerly,
 *                   from one fixed 1280px file and no srcset.
 * - `fit`           'cover' (default) or 'contain'; `focus` overrides the CSS
 *                   object-position from the manifest ("50% 40%").
 * - `credit`        'none' (decorative, thumbnail, or credited elsewhere on the page),
 *                   'overlay' (a small chip in the corner) or 'caption' (a credit line
 *                   under the picture). `creditLinks={false}` prints it without links
 *                   (static pages). Hosts can also place <PhotoCredit> themselves.
 * - `rounded`, `kenBurns` (a slow drift in scale; off under reduced motion).
 * Fills its parent box; with no height from the parent it keeps the photo's aspect ratio.
 */
export function Photo({
  id,
  photo,
  brochure,
  alt,
  sizes = DEFAULT_SIZES,
  priority = false,
  fit = 'cover',
  focus,
  className,
  credit = 'none',
  creditLinks = true,
  fallback = null,
  rounded = false,
  kenBurns = false,
}) {
  const fromContext = useContext(PhotoContext);
  const forPrint = useContext(PrintPhotosContext);
  const given = photo && typeof photo === 'object' ? photo : null;
  const lookupId = given ? (given.available || given.user ? null : given.id) : id;
  const live = useLivePhotos(lookupId ? [lookupId] : []);
  const record = given && !lookupId ? given : (live.resolvePhoto(lookupId, brochure ?? fromContext) ?? given);
  const usable = Boolean(record?.available && (record.srcSet || record.src?.(960)));
  const key = usable ? `${record.id}|${record.token ?? record.srcSet}` : 'none';
  return (
    <PhotoFrame
      key={key}
      record={usable ? record : null}
      color={record?.color}
      alt={alt}
      sizes={sizes}
      priority={priority}
      forPrint={forPrint}
      fit={fit}
      focus={focus}
      className={className}
      credit={credit}
      creditLinks={creditLinks}
      fallback={fallback}
      rounded={rounded}
      kenBurns={kenBurns}
    />
  );
}

/** Keyed by the photo's files, so a new photo starts from a fresh loading state. */
function PhotoFrame({ record, color, alt, sizes, priority, forPrint, fit, focus, className, credit, creditLinks, fallback, rounded, kenBurns }) {
  const [state, setState] = useState(record ? 'loading' : 'fallback');
  const [drawn, setDrawn] = useState(null);
  // A live photo has no LQIP: the art stays under it until it has faded in.
  const [settled, setSettled] = useState(false);
  const img = useRef(null);
  const frameRef = useRef(null);
  // Printed photos use one fixed file: a srcset would be re-chosen for the paper, unloaded.
  const responsive = Boolean(record?.srcSet) && !forPrint;

  // An image already in the cache can finish before React listens: check once.
  useLayoutEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth > 0) setState('loaded');
  }, []);

  const live = Boolean(record?.live);
  useEffect(() => {
    if (!live || state !== 'loaded') return undefined;
    const timer = setTimeout(() => setSettled(true), UNDERLAY_MS);
    return () => clearTimeout(timer);
  }, [live, state]);

  // Measure the frame (layout size, so flips and zooms do not count) before the
  // browser picks a file from srcset, and again whenever the frame resizes.
  const aspect = record?.width && record?.height ? record.width / record.height : 0;
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || !responsive) return undefined;
    const measure = () => setDrawn(renderedWidth(el.clientWidth, el.clientHeight, aspect, fit));
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [responsive, aspect, fit]);

  const showFallback = !record || state === 'error';
  const position = focus || record?.focus || '50% 50%';
  const style = {
    '--photo-color': color || undefined,
    '--photo-focus': position,
    '--photo-ratio': record?.width && record?.height ? `${record.width} / ${record.height}` : undefined,
  };
  const withCaption = credit === 'caption' && !showFallback;
  const underlay = live && !showFallback && !settled && fallback;

  const frame = (
    <div className={styles.frame} ref={frameRef}>
      {showFallback ? (
        fallback && (
          <div className={styles.fallback} data-photo-fallback="">
            {fallback}
          </div>
        )
      ) : (
        <>
          {underlay && (
            <div className={styles.fallback} data-photo-underlay="" aria-hidden="true">
              {fallback}
            </div>
          )}
          {record.lqip && <span className={styles.lqip} style={{ backgroundImage: `url("${record.lqip}")` }} aria-hidden="true" />}
          <img
            ref={img}
            className={styles.img}
            src={record.src(forPrint ? PRINT_WIDTH : 960)}
            srcSet={responsive ? record.srcSet : undefined}
            sizes={responsive ? (drawn ? `${drawn}px` : sizes) : undefined}
            width={record.width ?? undefined}
            height={record.height ?? undefined}
            alt={alt ?? (record.alt || record.caption || '')}
            loading={priority || forPrint ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            draggable={false}
            onLoad={() => {
              setState('loaded');
              reportLiveImage(record, true);
            }}
            onError={() => {
              setState('error');
              reportLiveImage(record, false);
            }}
          />
          {credit === 'overlay' && <PhotoCredit credit={record.credit} links={creditLinks} className={styles.chip} />}
        </>
      )}
    </div>
  );

  return (
    <div
      className={cn(styles.photo, withCaption && styles.withCaption, rounded && styles.rounded, kenBurns && styles.kenBurns, className)}
      style={style}
      data-state={showFallback ? 'fallback' : state}
      data-live={live || undefined}
      data-object-fit={fit === 'contain' ? 'contain' : 'cover'}
    >
      {frame}
      {withCaption && <PhotoCredit credit={record.credit} links={creditLinks} className={styles.caption} />}
    </div>
  );
}
