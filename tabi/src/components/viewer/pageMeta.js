import { spreadPartner } from '../../data/photoSpreads.js';
import { PAGE_TYPES } from '../../data/schema.js';
import { sealChars } from '../../lib/format.js';
import { BLANK } from './spreads.js';

/** { label, jp } for a page (or the blank endpaper). */
export function pageMeta(page, face) {
  if (face === BLANK) return { label: 'Endpaper', jp: '見返し' };
  const type = page?.type;
  // The same Japanese name the page prints in its margin and the Studio shows.
  return { label: PAGE_TYPES[type]?.label ?? 'Page', jp: PAGE_TYPES[type]?.jp ?? '頁' };
}

/** "Introduction · Features" for the pages of a spread; "Photo spread" for the two halves of one picture. */
export function spreadCaption(spread, pages) {
  const shown = spread?.pages ?? [];
  if (shown.length === 2 && spreadPartner(pages, shown[0]) === shown[1]) return 'Photo spread';
  return shown.map((i) => pageMeta(pages?.[i]).label).join(' · ');
}

/** Seal characters for a brochure: up to two characters of its Japanese title. */
export function sealText(brochure) {
  return sealChars(brochure?.titleJp);
}

/** Book colours come from the brochure, so stacks, ears and endpapers match its paper. */
export function paperVars(theme) {
  return {
    '--b-paper': theme?.paper || 'var(--page-paper)',
    '--b-ink': theme?.ink || 'var(--wa-sumi)',
    '--b-accent': theme?.accent || 'var(--wa-shu)',
  };
}
