import { memo } from 'react';
import { motion, useTransform } from 'framer-motion';
import { castEdge, leafLayer, uprightness } from './flipMath.js';
import { PageFace } from './PageFace.jsx';
import styles from './Flipbook.module.css';

/** How far a standing leaf lifts towards the reader, as a share of its width. */
const LIFT = 0.025;

/**
 * Shadow a turning leaf throws on the page beneath it: a soft band hugging
 * the leaf's projected edge, strongest when the leaf stands upright. Each
 * half of the book has its own clip box so the band never spills over the
 * spine. Painted one layer under the leaf itself.
 */
function CastShadow({ angle, index, count, width, double, perspective }) {
  const zIndex = useTransform(angle, (a) => leafLayer(index, count, a) * 2);
  const projection = { perspective, originX: double ? 0 : width / 2 };
  const edge = useTransform(angle, (a) => castEdge(a, width, { ...projection, lift: uprightness(a) * width * LIFT }));
  const rightOpacity = useTransform(angle, (a) => (a > -90 ? uprightness(a) * 0.9 : 0));
  const leftOpacity = useTransform(angle, (a) => (a <= -90 ? uprightness(a) * 0.9 : 0));
  return (
    <>
      <motion.div className={styles.castClip} data-half="right" style={{ zIndex, opacity: rightOpacity }} aria-hidden="true">
        <motion.div className={styles.castBand} data-half="right" style={{ x: edge }} />
      </motion.div>
      {double && (
        <motion.div className={styles.castClip} data-half="left" style={{ zIndex, opacity: leftOpacity }} aria-hidden="true">
          <motion.div className={styles.castBand} data-half="left" style={{ x: edge }} />
        </motion.div>
      )}
    </>
  );
}

/**
 * One sheet of the book, hinged on its left edge (the spine in a spread,
 * the binding in single-page mode). `angle` is a rotateY motion value:
 * 0 = lying on the right, -180 = turned to the left.
 *
 * Realism comes from cheap, transform/opacity-only layers:
 * - the leaf lifts towards the viewer (translateZ) as it stands up;
 * - each face catches a sheen of light, then falls into shade as it turns
 *   edge-on; the back face does the reverse as it lands;
 * - a curl band near the outer edge brightens mid-turn;
 * - a cast shadow falls on the page underneath (only while moving).
 * Faces hide while they face away (backface-visibility plus visibility, so
 * nothing composited inside a page can bleed through).
 *
 * Props (all primitives or stable references, so unchanged leaves skip
 * re-rendering while another one turns): angle, index, count (leaves),
 * double, width, height, perspective (the book's CSS perspective, for
 * shadow projection), moving, brochure, onCta, front / back (face values
 * from spreads.js), mounted / rich (see PageFace), frontLive / backLive,
 * frontGutter / backGutter (inner-page crease).
 */
export const Leaf = memo(function Leaf({
  angle,
  index,
  count,
  double,
  width,
  height,
  perspective,
  moving,
  brochure,
  onCta,
  front,
  back,
  mounted,
  rich,
  frontLive,
  backLive,
  frontGutter,
  backGutter,
}) {
  const zIndex = useTransform(angle, (a) => leafLayer(index, count, a) * 2 + 1);
  const lift = useTransform(angle, (a) => uprightness(a) * width * LIFT);
  const frontVisibility = useTransform(angle, (a) => (a > -90 ? 'visible' : 'hidden'));
  const backVisibility = useTransform(angle, (a) => (a <= -90 ? 'visible' : 'hidden'));
  const frontShade = useTransform(angle, [0, -40, -90], [0, 0.05, 0.42]);
  const frontSheen = useTransform(angle, [0, -28, -80], [0, 0.55, 0]);
  const backShade = useTransform(angle, [-90, -125, -180], [0.42, 0.1, 0]);
  const backSheen = useTransform(angle, [-105, -150, -180], [0, 0.45, 0]);
  const curl = useTransform(angle, [0, -50, -90, -130, -180], [0, 1, 0.2, 1, 0]);
  // Single-page mode: a page peeled past the binding fades away off the stage.
  const backOpacity = useTransform(angle, double ? [-180, 0] : [-180, -130, -90], double ? [1, 1] : [0, 1, 1]);

  return (
    <>
      {moving && <CastShadow angle={angle} index={index} count={count} width={width} double={double} perspective={perspective} />}
      <motion.div
        className={styles.leaf}
        data-moving={moving || undefined}
        style={{ width, height, left: double ? width : 0, rotateY: angle, z: lift, zIndex }}
      >
        <motion.div className={styles.face} data-side="front" style={{ visibility: frontVisibility }}>
          <PageFace brochure={brochure} face={front} mounted={mounted} rich={rich} live={frontLive} onCta={onCta} facing={double} />
          {frontGutter && <span className={styles.gutter} data-side="front" aria-hidden="true" />}
          <motion.span className={styles.curl} data-side="front" style={{ opacity: curl }} aria-hidden="true" />
          <motion.span className={styles.sheen} data-side="front" style={{ opacity: frontSheen }} aria-hidden="true" />
          <motion.span className={styles.shade} style={{ opacity: frontShade }} aria-hidden="true" />
        </motion.div>
        <motion.div className={styles.face} data-side="back" style={{ visibility: backVisibility, opacity: backOpacity }}>
          {double ? (
            <PageFace brochure={brochure} face={back} mounted={mounted} rich={rich} live={backLive} onCta={onCta} facing />
          ) : (
            <div className={styles.verso} aria-hidden="true" />
          )}
          {backGutter && <span className={styles.gutter} data-side="back" aria-hidden="true" />}
          <motion.span className={styles.curl} data-side="back" style={{ opacity: curl }} aria-hidden="true" />
          <motion.span className={styles.sheen} data-side="back" style={{ opacity: backSheen }} aria-hidden="true" />
          <motion.span className={styles.shade} style={{ opacity: backShade }} aria-hidden="true" />
        </motion.div>
      </motion.div>
    </>
  );
});
