import { createContext, useContext } from 'react';
import { useLivePhotos } from './useLivePhotos.js';

/**
 * The brochure whose photos a <Photo> resolves: "user:<key>" ids read its
 * `userPhotos` (the Studio's uploads). <BrochurePage> provides it for every
 * block; outside a page, pass `brochure` to <Photo> instead.
 */
export const PhotoContext = createContext(null);

/**
 * True inside the print edition (viewer/PrintPages): every <Photo> there loads
 * at once (it is never on screen, so a lazy image would never be fetched) and
 * from one fixed file, without a srcset — the print layout would otherwise
 * pick a different width, which is not loaded yet, and print a blank.
 */
export const PrintPhotosContext = createContext(false);

/**
 * The photo record for `id` — a registry photo (bundled, or live from
 * Wikimedia Commons once resolved) or, for "user:<key>", the brochure's own
 * upload — or null. Uses `brochure` when given, else the surrounding
 * <PhotoContext>. Blocks use it to decide what to draw around a photo (a
 * credit line, a caption) before the picture itself renders; it asks for the
 * live photo and re-renders when it arrives.
 */
export function usePhotoRecord(id, brochure) {
  const fromContext = useContext(PhotoContext);
  const live = useLivePhotos(typeof id === 'string' && id ? [id] : []);
  return live.resolvePhoto(id, brochure ?? fromContext);
}
