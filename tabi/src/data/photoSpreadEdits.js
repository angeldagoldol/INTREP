/**
 * Double-page photo spreads, for editing: the validator (spreadIssues — used
 * by brochures.test.js, the Studio's page list and editor, and the publish
 * check), where new pages go, moving a spread, and the automatic line-up.
 * The binding rules themselves are in photoSpreads.js.
 */
import { facingPair, spanOf } from './photoSpreads.js';

const photoOf = (page) => (typeof page?.photo === 'string' ? page.photo.trim() : '');

/** "pages 4–5" for the 0-based index of a left half. */
const pairName = (left) => `pages ${left + 1}–${left + 2}`;

/**
 * Every problem with the spreads in `pages`, in reading order:
 *   { code: 'side', index, ids, message }    the pair is adjacent but not bound as facing pages
 *   { code: 'photo', index, ids, message }   the two halves show different photos
 *   { code: 'alone', index, ids, message }   a half with no other half beside it
 * `index` is the first page concerned, `ids` the page ids involved.
 */
export function spreadIssues(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const issues = [];
  const idOf = (i) => (typeof list[i]?.id === 'string' ? list[i].id : String(i));
  for (let i = 0; i < list.length; i += 1) {
    const span = spanOf(list[i]);
    if (!span) continue;
    if (span === 'left' && spanOf(list[i + 1]) === 'right') {
      if (!facingPair(i, list.length)) {
        issues.push({
          code: 'side',
          index: i,
          ids: [idOf(i), idOf(i + 1)],
          message:
            i + 1 === list.length - 1
              ? `The spread on ${pairName(i)} ends on the back-cover page, so its halves don’t face each other. Move it earlier.`
              : `The spread on ${pairName(i)} starts on a right-hand page, so its halves don’t face each other. A spread starts on an even page (2, 4, 6…): move it by one page.`,
        });
      } else if (photoOf(list[i]) !== photoOf(list[i + 1])) {
        issues.push({ code: 'photo', index: i, ids: [idOf(i), idOf(i + 1)], message: `The two halves of the spread on ${pairName(i)} show different photos.` });
      }
      i += 1;
      continue;
    }
    issues.push({
      code: 'alone',
      index: i,
      ids: [idOf(i)],
      message:
        span === 'left'
          ? `Page ${i + 1} is the left half of a spread, but its right half doesn’t follow it.`
          : `Page ${i + 1} is the right half of a spread, but its left half isn’t just before it.`,
    });
  }
  return issues;
}

/**
 * Where a new spread should go so its halves face each other: the first index
 * at or after `from` that is a left-hand page and does not split another
 * spread, staying before a closing back cover; failing that, the nearest such
 * index before `from`. Inserting two pages never moves the pages after them
 * to the other side, so the brochure's other spreads stay lined up.
 */
export function spreadInsertIndex(pages, from) {
  const list = Array.isArray(pages) ? pages : [];
  const count = list.length + 2;
  const limit = list.at(-1)?.type === 'back' ? list.length - 1 : list.length;
  const start = Math.min(Math.max(1, Number.isInteger(from) ? from : limit), limit);
  const fits = (k) => k >= 1 && k <= limit && facingPair(k, count) && !(spanOf(list[k - 1]) === 'left' && spanOf(list[k]) === 'right');
  for (let k = start; k <= limit; k += 1) if (fits(k)) return k;
  for (let k = start - 1; k >= 1; k -= 1) if (fits(k)) return k;
  return Math.max(1, limit);
}

/** [left, right] indices of the pair page `index` belongs to (its halves side by side, wherever they are bound), or null. */
export function spreadPairAt(pages, index) {
  const list = Array.isArray(pages) ? pages : [];
  const span = spanOf(list[index]);
  if (span === 'left' && spanOf(list[index + 1]) === 'right') return [index, index + 1];
  if (span === 'right' && spanOf(list[index - 1]) === 'left') return [index - 1, index];
  return null;
}

/**
 * Move the spread page `index` belongs to by one spread (`dir` -1 earlier,
 * +1 later): both halves travel together, two pages at a time, so a spread
 * on facing pages stays on facing pages. Never in front of an opening cover
 * or behind a closing back cover. Returns the same array when it cannot move.
 */
export function moveSpread(pages, index, dir) {
  const pair = spreadPairAt(pages, index);
  if (!pair || (dir !== -1 && dir !== 1)) return pages;
  const min = pages[0]?.type === 'cover' && pair[0] > 0 ? 1 : 0;
  const end = pages.at(-1)?.type === 'back' && pair[1] < pages.length - 1 ? pages.length - 1 : pages.length;
  const target = pair[0] + dir * 2;
  if (target < min || target + 2 > end) return pages;
  // Without a closing back cover, the last page of an odd-length booklet is the back-cover slot:
  // a spread that faces where it is never moves onto it.
  if (facingPair(pair[0], pages.length) && !facingPair(target, pages.length)) return pages;
  const next = [...pages];
  const halves = next.splice(pair[0], 2);
  next.splice(target, 0, ...halves);
  return next;
}

/** Where a single new page should go: at `from`, unless that splits a spread — then after it. */
export function pageInsertIndex(pages, from) {
  const list = Array.isArray(pages) ? pages : [];
  const at = Math.min(Math.max(0, Number.isInteger(from) ? from : list.length), list.length);
  return spanOf(list[at - 1]) === 'left' && spanOf(list[at]) === 'right' ? at + 1 : at;
}

/**
 * Halves that were pulled apart (a drag that moved one half) back together:
 * each lone half is joined by the nearest lone half of the other side showing
 * the same photo, which moves to sit beside it.
 */
function reunite(pages) {
  const list = [...pages];
  const lone = (i) => {
    const span = spanOf(list[i]);
    if (span === 'left') return spanOf(list[i + 1]) === 'right' ? null : 'left';
    if (span === 'right') return spanOf(list[i - 1]) === 'left' ? null : 'right';
    return null;
  };
  // Each reunion leaves two fewer lone halves (moving a lone half never splits a pair), so this ends.
  for (let i = 0; i < list.length; i += 1) {
    const side = lone(i);
    if (!side) continue;
    const want = side === 'left' ? 'right' : 'left';
    let best = -1;
    for (let j = 0; j < list.length; j += 1) {
      if (j === i || lone(j) !== want || photoOf(list[j]) !== photoOf(list[i])) continue;
      if (best === -1 || Math.abs(j - i) < Math.abs(best - i)) best = j;
    }
    if (best === -1) continue;
    const anchor = list[i];
    const [moved] = list.splice(best, 1);
    const at = list.indexOf(anchor);
    list.splice(side === 'left' ? at + 1 : at, 0, moved);
    i = -1;
  }
  return list;
}

/**
 * Repair spread placement without losing content:
 * - halves pulled apart are put back together (the nearest other half with the same photo);
 * - a half with no other half anywhere becomes a full-page photo (its `span` is dropped);
 * - a pair whose halves show different photos: the right half takes the left half's photo;
 * - a pair on the wrong side is moved by one page — the next page after it that
 *   is not a spread (never the back cover) moves in front of it, or failing that
 *   the page before it (never the cover) moves behind it;
 * - a pair that shifting cannot line up (it sits on the back-cover slot of an
 *   odd-length booklet with no back page, say) moves to the nearest place where
 *   its halves face, and only if there is none do they become full-page photos.
 * Returns the same array when nothing needed fixing.
 */
export function fixSpreadPlacement(input) {
  if (!Array.isArray(input) || spreadIssues(input).length === 0) return input;
  const pages = reunite(input);
  // Units: a pair travels together; everything else is a single page.
  const units = [];
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const span = spanOf(page);
    if (span === 'left' && spanOf(pages[i + 1]) === 'right') {
      const right = photoOf(pages[i + 1]) === photoOf(page) ? pages[i + 1] : { ...pages[i + 1], photo: page.photo ?? '' };
      units.push([page, right]);
      i += 1;
    } else if (span) {
      const { span: _span, ...full } = page;
      units.push([full]);
    } else {
      units.push([page]);
    }
  }
  const fixedEnd = (u) => units[u]?.length === 1 && units[u][0]?.type === 'back' && u === units.length - 1;
  const fixedStart = (u) => u === 0 && units[0]?.length === 1 && units[0][0]?.type === 'cover';
  const countAll = pages.length;
  for (let pass = 0; pass < units.length * 2; pass += 1) {
    let start = 0;
    let moved = false;
    for (let u = 0; u < units.length; u += 1) {
      if (units[u].length === 2 && !facingPair(start, countAll)) {
        const next = units.findIndex((unit, v) => v > u && unit.length === 1 && !fixedEnd(v));
        if (next !== -1) {
          const [single] = units.splice(next, 1);
          units.splice(u, 0, single);
        } else {
          const prev = units.findLastIndex((unit, v) => v < u && unit.length === 1 && !fixedStart(v));
          if (prev === -1) break;
          const [single] = units.splice(prev, 1);
          units.splice(u, 0, single);
        }
        moved = true;
        break;
      }
      start += units[u].length;
    }
    if (!moved) break;
  }
  // Whatever one-page shifts could not line up: move the pair itself, or (no place for it) split it.
  const startOf = (u) => units.slice(0, u).reduce((n, unit) => n + unit.length, 0);
  const misplaced = () => units.findIndex((unit, u) => unit.length === 2 && !facingPair(startOf(u), countAll));
  const hasEnd = fixedEnd(units.length - 1);
  for (let guard = 0; guard < units.length; guard += 1) {
    const at = misplaced();
    if (at === -1) break;
    const before = spreadIssues(units.flat()).length;
    const [pair] = units.splice(at, 1);
    const lo = units.length && units[0]?.length === 1 && units[0][0]?.type === 'cover' ? 1 : 0;
    const hi = hasEnd ? units.length - 1 : units.length;
    let best = -1;
    for (let d = 1; best === -1 && d <= units.length + 1; d += 1) {
      for (const k of [at - d, at + d]) {
        if (best !== -1 || k < lo || k > hi) continue;
        units.splice(k, 0, pair);
        if (facingPair(startOf(k), countAll) && spreadIssues(units.flat()).length < before) best = k;
        units.splice(k, 1);
      }
    }
    if (best !== -1) units.splice(best, 0, pair);
    else
      units.splice(
        at,
        0,
        ...pair.map(({ span: _span, ...full }) => [full]),
      );
  }
  return units.flat();
}

/**
 * The two pages of a new spread, without ids: the left half carries the photo,
 * the right half the caption (its outer corner is where a reader looks for it).
 */
export function createPhotoSpread({ photo = '' } = {}) {
  return [
    { span: 'left', photo, name: '', nameJp: '', caption: '', captionPlacement: 'overlay', creditPlacement: 'caption' },
    {
      span: 'right',
      photo,
      name: 'Kiyomizu-dera',
      nameJp: '清水寺',
      caption: 'One wide view across both pages — say what it shows, and when.',
      captionPlacement: 'overlay',
      creditPlacement: 'caption',
    },
  ];
}
