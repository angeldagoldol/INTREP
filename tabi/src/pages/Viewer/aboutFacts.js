/**
 * What "About this brochure" says about where a brochure's facts and
 * pictures come from. Pure: the photo lookup is passed in (resolvePhoto from
 * data/photos in the app, a stub in tests).
 */
import { photoIdsIn } from '../../data/photos/registry.js';

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The brochure's fact-check status, worded honestly for who made it:
 *   { checked, label, when, by, note }
 * Built-ins are checked by Tabi Guides against official sources; a Studio
 * brochure's date is its author's own claim, which Tabi has not reviewed.
 */
export function factsStatus(brochure, sourceCount = 0) {
  const when = str(brochure?.factsChecked);
  const builtin = brochure?.source !== 'user';
  const sources = sourceCount === 1 ? '1 source' : `${sourceCount} sources`;
  if (builtin && when) {
    return {
      checked: true,
      label: `Facts checked ${when}`,
      when,
      by: 'Tabi Guides',
      note: `Checked by Tabi Guides against ${sources}${sourceCount ? ', official sites first' : ''}. Opening hours and prices change, so confirm them on the official sites before you go.`,
    };
  }
  if (builtin) {
    return {
      checked: false,
      label: 'Facts awaiting check',
      when: '',
      by: '',
      note: 'These facts have not been checked against official sources yet. Confirm hours, prices and access on the official sites before you go.',
    };
  }
  if (when) {
    return {
      checked: false,
      label: `Facts checked ${when}, says the author`,
      when,
      by: 'its author',
      note: 'Made in the Studio. Its author dated the fact check; Tabi Guides has not reviewed it. Confirm details on the official sites before you go.',
    };
  }
  return {
    checked: false,
    label: 'Facts awaiting check',
    when: '',
    by: '',
    note: 'Made in the Studio, and its facts have not been checked. Confirm details on the official sites before you go.',
  };
}

/**
 * The photographs a brochure lists, resolved: { photos, available, pending }
 * — every known photo record in reading order, the downloaded ones and the
 * ones still waiting (their pages show the generative art meanwhile).
 * Unknown ids are skipped.
 */
export function photoStatus(brochure, resolve) {
  const photos = photoIdsIn(brochure)
    .map((id) => resolve(id, brochure))
    .filter(Boolean);
  return {
    photos,
    available: photos.filter((p) => p.available),
    // Uploads that do not load (a blob: URL from a closed tab) are not "on their way".
    pending: photos.filter((p) => !p.available && !p.user),
  };
}

/**
 * One honest sentence about photographs not downloaded yet (registry photos
 * only; `shown` = how many credited photos are already listed), or ''.
 */
export function pendingNote(pendingCount, shown = 0) {
  const n = Number(pendingCount) || 0;
  if (n <= 0) return '';
  const one = n === 1;
  if (shown > 0) {
    return `${n} more ${one ? 'photograph is' : 'photographs are'} listed but not downloaded yet; ${one ? 'its page shows' : 'their pages show'} generated art for now.`;
  }
  return `${n} ${one ? 'photograph' : 'photographs'} from Wikimedia Commons ${one ? 'is' : 'are'} listed for this brochure but not downloaded yet. Until then, ${one ? 'its page shows' : 'the pages show'} generated art in ${one ? 'its' : 'their'} place, and ${one ? 'it' : 'each'} will be credited here.`;
}

const isLandscape = (p) => p.width > 0 && p.height > 0 && p.width >= p.height * 1.2;

/**
 * The picture for the full-bleed plate that opens "About this brochure": a
 * downloaded landscape photograph other than the cover (the reader just
 * showed that) — a `wide` one first. Null when none is downloaded yet.
 */
export function featurePhoto(brochure, resolve) {
  const cover = str(brochure?.cover?.photo);
  const { available } = photoStatus(brochure, resolve);
  const candidates = available.filter((p) => p.id !== cover && isLandscape(p));
  return candidates.find((p) => p.use === 'wide') ?? candidates[0] ?? null;
}
