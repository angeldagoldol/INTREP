import { byId } from './lookup.js';

/** The four seasons (四季, shiki) — Japanese travel is planned around them. */
export const SEASONS = [
  { id: 'spring', label: 'Spring', jp: '春', kana: 'はる', romaji: 'haru', months: 'Mar – May', color: 'var(--wa-sakura)', motif: 'Cherry blossom' },
  { id: 'summer', label: 'Summer', jp: '夏', kana: 'なつ', romaji: 'natsu', months: 'Jun – Aug', color: 'var(--wa-ai)', motif: 'Fireworks & festivals' },
  { id: 'autumn', label: 'Autumn', jp: '秋', kana: 'あき', romaji: 'aki', months: 'Sep – Nov', color: 'var(--wa-momiji)', motif: 'Red maple leaves' },
  { id: 'winter', label: 'Winter', jp: '冬', kana: 'ふゆ', romaji: 'fuyu', months: 'Dec – Feb', color: 'var(--wa-sora)', motif: 'Snow & hot springs' },
];

/** id → season, with no prototype (see lookup.js), so ids from user data are safe to look up. */
export const SEASON_MAP = byId(SEASONS);
