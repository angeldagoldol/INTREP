/**
 * Credits for the photographs a Home section shows, for a credit line under
 * them ("Photos — Mount Fuji: Author · CC BY-SA 4.0 / …"). Pure: the photo
 * lookup is passed in (getPhoto from data/photos in the app, a stub in tests).
 */

/** Only http(s) links leave the page. */
function webLink(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * One entry per downloaded photo that carries a credit, in the order given.
 * `slots` are `{ id, label }` (label: a short name for the picture, e.g.
 * "Mount Fuji"; it falls back to the photo's caption). Photos not downloaded
 * yet (the fallback art is showing) and photos without author or licence are
 * skipped, so the line never credits a picture that is not on screen.
 *   → [{ id, label, author, license, sourceUrl, licenseUrl, title }]
 */
export function creditEntries(slots, getPhoto) {
  const out = [];
  for (const slot of Array.isArray(slots) ? slots : []) {
    const id = typeof slot === 'string' ? slot : slot?.id;
    const photo = typeof id === 'string' ? getPhoto(id) : null;
    if (!photo?.available) continue;
    const credit = photo.credit ?? {};
    const author = typeof credit.author === 'string' ? credit.author.trim() : '';
    const license = typeof credit.license === 'string' ? credit.license.trim() : '';
    if (!author && !license) continue;
    const label = (typeof slot === 'object' && typeof slot.label === 'string' && slot.label.trim()) || photo.caption || '';
    out.push({
      id,
      label,
      author: author || 'Unknown author',
      license,
      title: typeof credit.title === 'string' ? credit.title : '',
      sourceUrl: webLink(credit.sourceUrl),
      licenseUrl: webLink(credit.licenseUrl),
    });
  }
  return out;
}

/** True when every id is a downloaded photo (so the copy may say "photographs"). */
export function allAvailable(ids, getPhoto) {
  const list = Array.isArray(ids) ? ids : [];
  return list.length > 0 && list.every((id) => Boolean(getPhoto(id)?.available));
}
