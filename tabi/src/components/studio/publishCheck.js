/**
 * Pre-publish checks for a Studio draft, and an automatic fixer for the
 * structural ones. A publishable brochure has a title, at least three pages,
 * opens with a cover and closes with a back cover, and its double-page photo
 * spreads sit on facing pages.
 */
import { fixSpreadPlacement, spreadIssues } from '../../data/photoSpreadEdits.js';
import { PAGE_TYPES } from '../../data/schema.js';
import { createId } from '../../lib/id.js';

export const MIN_PAGES = 3;

/**
 * Issues blocking publication, in reading order.
 * Each is { id: 'title'|'pages'|'cover'|'back'|'spreads', message, fixable }.
 * The title is fixable only when the cover page already has a headline to borrow.
 */
export function validateForPublish(doc) {
  const pages = Array.isArray(doc?.pages) ? doc.pages : [];
  const issues = [];
  if (!String(doc?.title ?? '').trim()) {
    const coverTitle = String(pages.find((p) => p.type === 'cover')?.title ?? '').trim();
    issues.push({
      id: 'title',
      message: coverTitle ? `Add a title — we can use the cover’s “${coverTitle}”.` : 'Give your brochure a title.',
      fixable: Boolean(coverTitle),
    });
  }
  if (pages.length < MIN_PAGES) {
    issues.push({ id: 'pages', message: `Add at least ${MIN_PAGES} pages (you have ${pages.length}).`, fixable: true });
  }
  if (pages[0]?.type !== 'cover') {
    issues.push({ id: 'cover', message: 'The first page should be a cover.', fixable: true });
  }
  if (pages.at(-1)?.type !== 'back') {
    issues.push({ id: 'back', message: 'The last page should be a back cover.', fixable: true });
  }
  const spreads = spreadIssues(pages);
  if (spreads.length) {
    issues.push({
      id: 'spreads',
      message: spreads.length === 1 ? spreads[0].message : `${spreads.length} double-page spreads are out of place — their halves don’t face each other.`,
      fixable: true,
    });
  }
  return issues;
}

/** True when every issue can be repaired by autoFix (given an optional title). */
export function canAutoFix(issues, title = '') {
  return issues.every((issue) => issue.fixable || (issue.id === 'title' && String(title).trim()));
}

function newPage(type, makeId, overrides = {}) {
  return { id: makeId('pg'), type, ...PAGE_TYPES[type].create(), ...overrides };
}

/**
 * Repair structure without losing content: move an existing cover to the
 * front (or create one), move an existing back cover to the end (or create
 * one), pad to three pages with introductions, line up double-page photo
 * spreads (data/photoSpreads.js) and borrow a title.
 */
export function autoFix(doc, { makeId = createId, title } = {}) {
  let pages = Array.isArray(doc?.pages) ? [...doc.pages] : [];
  const docTitle = String(title ?? doc?.title ?? '').trim();

  if (pages[0]?.type !== 'cover') {
    const at = pages.findIndex((p) => p.type === 'cover');
    const cover =
      at === -1
        ? newPage('cover', makeId, { title: docTitle || PAGE_TYPES.cover.create().title, titleJp: doc?.titleJp || '旅' })
        : pages[at];
    if (at !== -1) pages.splice(at, 1);
    pages = [cover, ...pages];
  }

  if (pages.at(-1).type !== 'back') {
    const at = pages.findLastIndex((p, i) => i > 0 && p.type === 'back');
    const back = at === -1 ? newPage('back', makeId) : pages[at];
    if (at !== -1) pages.splice(at, 1);
    pages = [...pages, back];
  }

  while (pages.length < MIN_PAGES) pages.splice(pages.length - 1, 0, newPage('intro', makeId));
  pages = fixSpreadPlacement(pages);

  const coverTitle = String(pages[0]?.title ?? '').trim();
  return { ...doc, title: docTitle || coverTitle, pages };
}
