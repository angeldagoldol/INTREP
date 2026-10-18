import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, MoveHorizontal } from 'lucide-react';
import { BrochureCard } from '../../../components/brochure/BrochureCard.jsx';
import { Hanko, IconButton } from '../../../components/ui/index.js';
import { useFinePointer } from '../../../hooks/useMediaQuery.js';
import { pad } from '../../../lib/format.js';
import { ease, spring } from '../../../lib/motion.js';
import { indexForSlide, nearestIndex, shelfIndex, snapPoints, trackProgress } from './carousel.js';
import styles from './FeaturedCarousel.module.css';

const slideIn = {
  hidden: { opacity: 0, y: 40 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.out, delay: Math.min(i, 5) * 0.08 } }),
};

/** The shelf always ends somewhere useful: an invitation to make your own. */
function MakeYourOwn() {
  return (
    <Link to="/studio" className={styles.own}>
      <Hanko text="作" size={64} />
      <span className={styles.ownTitle}>
        Your Japan,
        <br />
        <em>in print</em>
      </span>
      <span className={styles.ownText}>Start from a blank brochure, or remix one of these in the Studio.</span>
      <span className={styles.ownCta}>
        Open the Studio <ArrowUpRight aria-hidden="true" />
      </span>
    </Link>
  );
}

/**
 * Horizontally draggable shelf of feature cards with momentum and snap,
 * prev/next buttons, arrow keys, focus-follow and a progress rule.
 * The first card lines up with the page container; the shelf bleeds right.
 *
 * - `brochures` the brochures to show (a "make your own" card is appended).
 */
export function FeaturedCarousel({ brochures }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const dragged = useRef(false);
  // The snap point a button/key press is springing to; null while dragging.
  const target = useRef(null);
  const reduce = useReducedMotion();
  const finePointer = useFinePointer();
  const x = useMotionValue(0);
  const maxScroll = useMotionValue(0);
  const visible = useMotionValue(1);
  const [geometry, setGeometry] = useState({ points: [0], starts: [0], max: 0 });
  const [index, setIndex] = useState(0);
  const { points, starts, max } = geometry;

  // Measure slide positions whenever the viewport or the track resizes.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const slides = Array.from(track.children);
      const origin = slides[0]?.offsetLeft ?? 0;
      const nextStarts = slides.map((slide) => slide.offsetLeft - origin);
      const nextMax = Math.max(0, track.scrollWidth - viewport.clientWidth);
      const nextPoints = snapPoints(nextStarts, nextMax);
      maxScroll.set(nextMax);
      visible.set(track.scrollWidth > 0 ? Math.min(1, viewport.clientWidth / track.scrollWidth) : 1);
      x.set(nextPoints[nearestIndex(nextPoints, Math.min(0, Math.max(-nextMax, x.get())))]);
      setGeometry({ points: nextPoints, starts: nextStarts, max: nextMax });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [brochures.length, x, maxScroll, visible]);

  useMotionValueEvent(x, 'change', (value) => {
    const next = shelfIndex(points, value, target.current);
    setIndex((current) => (current === next ? current : next));
  });

  // Progress rule: starts at the visible share of the shelf, ends full.
  const fill = useTransform([x, maxScroll, visible], ([value, m, v]) => v + (1 - v) * trackProgress(value, m));

  const goTo = (wanted) => {
    const i = Math.min(points.length - 1, Math.max(0, wanted));
    target.current = i;
    setIndex(i);
    if (reduce) {
      x.set(points[i]);
      target.current = null;
      return;
    }
    animate(x, points[i], {
      ...spring.gentle,
      onComplete: () => {
        if (target.current === i) target.current = null;
      },
    });
  };

  const onKeyDown = (event) => {
    const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: points.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    goTo(keys[event.key]);
  };

  // Keyboard users tabbing through cards: bring the focused card into view.
  const onFocus = (event) => {
    const slide = event.target.closest('li');
    const viewport = viewportRef.current;
    if (!slide || !viewport) return;
    const slideRect = slide.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();
    if (slideRect.left >= viewRect.left - 1 && slideRect.right <= viewRect.right + 1) return;
    goTo(indexForSlide(points, starts, Array.from(slide.parentElement.children).indexOf(slide)));
  };

  const canScroll = max > 0;

  return (
    <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label="Featured brochures" onKeyDown={onKeyDown}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDownCapture={() => {
          dragged.current = false;
          // A drag interrupts the spring: the index follows the track again.
          target.current = null;
        }}
        onClickCapture={(event) => {
          if (!dragged.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragStartCapture={(event) => event.preventDefault()}
        onFocus={onFocus}
      >
        <motion.ul
          ref={trackRef}
          className={styles.track}
          style={{ x }}
          drag={canScroll ? 'x' : false}
          dragConstraints={{ left: -max, right: 0 }}
          dragElastic={0.08}
          dragTransition={{
            power: 0.28,
            timeConstant: 260,
            modifyTarget: (end) => points[nearestIndex(points, end)],
            bounceStiffness: 260,
            bounceDamping: 32,
          }}
          onDragStart={() => {
            dragged.current = true;
          }}
          data-draggable={canScroll || undefined}
        >
          {brochures.map((brochure, i) => (
            <motion.li
              key={brochure.id ?? brochure.slug}
              className={styles.slide}
              custom={i}
              variants={slideIn}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${brochures.length + 1}`}
            >
              <BrochureCard brochure={brochure} index={i} variant="feature" />
            </motion.li>
          ))}
          <motion.li
            className={styles.slide}
            custom={brochures.length}
            variants={slideIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            aria-roledescription="slide"
            aria-label={`${brochures.length + 1} of ${brochures.length + 1}`}
          >
            <MakeYourOwn />
          </motion.li>
        </motion.ul>
      </div>

      <div className={`container ${styles.controls}`}>
        <div className={styles.progress}>
          <span className={styles.count} aria-hidden="true">
            {pad(index + 1)} <span>/ {pad(points.length)}</span>
          </span>
          <span className={styles.rule} aria-hidden="true">
            <motion.span className={styles.fill} style={{ scaleX: fill }} />
          </span>
          <span className="sr-only" aria-live="polite">
            {`Shelf position ${index + 1} of ${points.length}`}
          </span>
          {finePointer && canScroll && (
            <span className={styles.hint} aria-hidden="true">
              <MoveHorizontal /> Drag
            </span>
          )}
        </div>
        <div className={styles.buttons}>
          <IconButton
            label="Previous brochures"
            icon={<ArrowLeft />}
            variant="outline"
            size="lg"
            tooltipSide="top"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
          />
          <IconButton
            label="Next brochures"
            icon={<ArrowRight />}
            variant="outline"
            size="lg"
            tooltipSide="top"
            onClick={() => goTo(index + 1)}
            disabled={index >= points.length - 1}
          />
        </div>
      </div>
    </div>
  );
}
