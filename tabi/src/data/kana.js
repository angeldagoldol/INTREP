/**
 * Hiragana readings for search. Japanese visitors often type a reading
 * (きょうと) rather than the kanji (京都), and an IME shows hiragana while it
 * composes, so every search index adds these readings as a hidden field.
 * search.js folds katakana to hiragana, so キョウト matches too.
 */
import { getCategory } from './categories.js';
import { getRegion } from './regions.js';
import { SEASON_MAP } from './seasons.js';

/**
 * Readings a brochure can be found by: its title's reading (`titleKana`),
 * then its region's, category's and seasons'. `titleKana` counts for library
 * brochures only: a remix copies it, and the copy may then be retitled.
 */
export function brochureKana(brochure) {
  if (!brochure || typeof brochure !== 'object') return '';
  const title = brochure.source !== 'user' && typeof brochure.titleKana === 'string' ? brochure.titleKana : '';
  const region = brochure.region ? getRegion(brochure.region).kana : '';
  const category = brochure.category ? getCategory(brochure.category).kana : '';
  const seasons = (Array.isArray(brochure.seasons) ? brochure.seasons : []).map((id) => SEASON_MAP[id]?.kana);
  return [title, region, category, ...seasons].filter((text) => typeof text === 'string' && text).join(' ');
}
