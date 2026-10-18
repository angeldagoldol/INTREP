/**
 * The image URL of an uploaded photo, or '' — only inline data:image/…
 * (raster: png, jpeg, webp, gif, avif) and blob: URLs; never http(s) or SVG.
 * Its own module so the stored-brochure normaliser (data/sanitize.js, in the
 * entry chunk) can use it without pulling in the photo registry.
 */
export function safeImageSrc(value) {
  if (typeof value !== 'string') return '';
  const src = value.trim();
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(src)) return src;
  if (/^blob:(?:https?:\/\/[^\s"'()<>\\]+|null)\/[0-9a-f-]{8,}$/i.test(src)) return src;
  return '';
}
