import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { Photo } from '../../../components/photo/Photo.jsx';
import { VerticalText } from '../../../components/ui/index.js';
import { useLivePhotos } from '../../../components/photo/useLivePhotos.js';
import { cn } from '../../../lib/cn.js';
import { ease, spring } from '../../../lib/motion.js';
import { HERO_PANELS as PANELS } from '../homeContent.js';
import { allAvailable } from '../photoCredits.js';
import { flapAngles, openness, shade } from './trifold.js';
import styles from './TriFold.module.css';

/** The demo brochure is a printed object: it keeps its own paper colours in both themes. */
const PRINT = { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' };

const TILT = { stiffness: 110, damping: 18, mass: 0.7 };
const FOLD = { stiffness: 140, damping: 26 };

const PANEL_PHOTOS = Object.values(PANELS).map((p) => p.photo);

/** The scene's accessible name: it says "photographs" only once they are all on show (bundled or live). */
function sceneLabel(getPhoto) {
  const photos = allAvailable(PANEL_PHOTOS, getPhoto);
  return photos
    ? 'A tri-fold brochure about Japan, unfolding: photographs of Mount Fuji, the torii of Fushimi Inari and Shibuya Crossing at night'
    : 'A tri-fold brochure about Japan, unfolding: panels on Mount Fuji, the torii of Fushimi Inari and Shibuya Crossing';
}

/**
 * One inside panel: a full-bleed photograph (or, until it is downloaded, the
 * panel's generative art) over a printed text block. Credits for the three
 * photos are printed under the hero stage (<PhotoCredits>), since the panels
 * live inside one 3D object.
 */
function PhotoPanel({ panel }) {
  return (
    <div className={styles.panel}>
      <div className={styles.art}>
        <Photo
          id={panel.photo}
          sizes="240px"
          priority
          credit="none"
          className={styles.photo}
          fallback={<CoverArt style={panel.art} seed={panel.seed} theme={PRINT} />}
        />
        <span className={styles.plateEdge} aria-hidden="true" />
      </div>
      <div className={styles.copy}>
        <span className={styles.kicker} lang="ja">
          {panel.jp}
        </span>
        <span className={styles.title}>{panel.title}</span>
        <span className={styles.body}>{panel.body}</span>
        <span className={styles.folio}>
          <span>Tabi 旅</span>
          <span>{panel.folio}</span>
        </span>
      </div>
    </div>
  );
}

/** Outside of the left flap: the front cover you see while the brochure is closed. */
function FrontCover() {
  return (
    <div className={styles.cover}>
      <span className={styles.coverMast}>Tabi · Vol. 01</span>
      <span className={styles.coverSun} />
      <VerticalText className={styles.coverJp}>日本の旅</VerticalText>
      <span className={styles.coverEn}>
        Japan, folded
        <br />
        into pages
      </span>
      <span className={styles.coverSeal} lang="ja">
        旅
      </span>
    </div>
  );
}

/** Outside of the right flap: the back panel, glimpsed mid-fold. */
function BackPanel() {
  return (
    <div className={styles.backPanel}>
      <span className={styles.backJp} lang="ja">
        またね
      </span>
      <span className={styles.backEn}>Mata ne — see you soon</span>
      <span className={styles.backRule} />
      <span className={styles.backSmall}>tabi.example</span>
    </div>
  );
}

/**
 * A tri-fold brochure built from CSS 3D transforms. It rises in closed,
 * unfolds with a paper spring, leans toward the pointer and folds shut again
 * as `fold` goes 0 → 1. Under reduced motion it rests open and still.
 *
 * - `pointerX` / `pointerY`  motion values in −1…1 (0 = centred)
 * - `fold`                   motion value 0…1 (usually hero scroll progress)
 */
export function TriFold({ pointerX, pointerY, fold }) {
  const reduce = useReducedMotion();
  const live = useLivePhotos(PANEL_PHOTOS);
  const leftOpen = useMotionValue(reduce ? 1 : 0);
  const rightOpen = useMotionValue(reduce ? 1 : 0);
  // 1 while motion is allowed: scroll-folding is multiplied by it, so the
  // pose never depends on a stale closure if the OS setting changes.
  const motionAllowed = useMotionValue(reduce ? 0 : 1);
  const foldSpring = useSpring(fold, FOLD);

  useEffect(() => {
    motionAllowed.set(reduce ? 0 : 1);
    if (reduce) {
      leftOpen.set(1);
      rightOpen.set(1);
      return undefined;
    }
    // Roll fold: the cover flap opens first, then the inner flap.
    const cover = animate(leftOpen, 1, { ...spring.page, delay: 0.75 });
    const inner = animate(rightOpen, 1, { ...spring.page, delay: 1.15 });
    return () => {
      cover.stop();
      inner.stop();
    };
  }, [reduce, leftOpen, rightOpen, motionAllowed]);

  const pose = (l, r, f, m) => flapAngles({ left: l, right: r }, f * m);
  const leftAngle = useTransform([leftOpen, rightOpen, foldSpring, motionAllowed], ([l, r, f, m]) => pose(l, r, f, m).left);
  const rightAngle = useTransform([leftOpen, rightOpen, foldSpring, motionAllowed], ([l, r, f, m]) => pose(l, r, f, m).right);
  const open = useTransform([leftAngle, rightAngle], ([left, right]) => openness({ left, right }));
  const closedBy = useTransform([foldSpring, motionAllowed], ([f, m]) => f * m);

  // Paper darkens as a flap turns away from the light.
  const leftShade = useTransform(leftAngle, (a) => shade(a) * 0.34);
  const rightShade = useTransform(rightAngle, (a) => shade(a) * 0.26);
  const floorScale = useTransform(open, [0, 1], [0.42, 1]);

  // Rest slightly turned, follow the pointer, square up as it closes.
  const tiltX = useSpring(pointerY, TILT);
  const tiltY = useSpring(pointerX, TILT);
  const rotateX = useTransform([tiltX, closedBy], ([t, f]) => 9 - t * 7 - f * 3);
  const rotateY = useTransform([tiltY, closedBy], ([t, f]) => -10 + t * 13 + f * 6);
  const rotateZ = useTransform(closedBy, [0, 1], [0, -5]);
  const scale = useTransform(closedBy, [0, 1], [1, 0.9]);

  return (
    <div
      className={styles.scene}
      role="img"
      aria-label={sceneLabel(live.getPhoto)}
      style={{
        '--p-paper': PRINT.paper,
        '--p-ink': PRINT.ink,
        '--p-accent': PRINT.accent,
        '--p-accent2': PRINT.accent2,
        '--p-muted': PRINT.muted,
      }}
    >
      <motion.div className={styles.floor} style={{ scaleX: floorScale }} aria-hidden="true" />
      <motion.div
        className={styles.enter}
        initial={{ opacity: 0, y: 90, rotateZ: -8 }}
        animate={{ opacity: 1, y: 0, rotateZ: 0 }}
        transition={{ duration: 1.1, ease: ease.out, delay: 0.15 }}
      >
        <motion.div className={styles.object} style={{ rotateX, rotateY, rotateZ, scale }}>
          <div className={styles.middle}>
            <div className={styles.face}>
              <PhotoPanel panel={PANELS.middle} />
            </div>

            <motion.div className={cn(styles.flap, styles.left)} style={{ rotateY: leftAngle, z: 3 }}>
              <div className={styles.face}>
                <PhotoPanel panel={PANELS.left} />
                <motion.span className={styles.shade} style={{ opacity: leftShade }} />
              </div>
              <div className={cn(styles.face, styles.back)}>
                <FrontCover />
              </div>
            </motion.div>

            <motion.div className={cn(styles.flap, styles.right)} style={{ rotateY: rightAngle, z: 1.5 }}>
              <div className={styles.face}>
                <PhotoPanel panel={PANELS.right} />
                <motion.span className={cn(styles.shade, styles.shadeRight)} style={{ opacity: rightShade }} />
              </div>
              <div className={cn(styles.face, styles.back)}>
                <BackPanel />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
