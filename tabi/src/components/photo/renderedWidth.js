/**
 * CSS px the picture is drawn at inside a `boxWidth` × `boxHeight` frame:
 * `cover` scales it until both sides are filled (a landscape photo in a
 * portrait frame is wider than the frame), `contain` until one side is.
 * Rounded up to 40px steps so small resizes do not churn; null when unknown.
 */
export function renderedWidth(boxWidth, boxHeight, photoAspect, fit = 'cover') {
  if (!(boxWidth > 0)) return null;
  const byHeight = photoAspect > 0 && boxHeight > 0 ? boxHeight * photoAspect : boxWidth;
  const width = fit === 'contain' ? Math.min(boxWidth, byHeight) : Math.max(boxWidth, byHeight);
  return Math.ceil(width / 40) * 40;
}
