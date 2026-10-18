import { byId } from './lookup.js';

/**
 * Brochure categories. `jp` is the short Japanese label shown in vertical
 * type; `kana` its hiragana reading(s), for search (data/kana.js); `color`
 * is a wa-iro token used for chips, dots and badges.
 */
export const CATEGORIES = [
  { id: 'cities', label: 'Cities & Nightlife', jp: '都市', kana: 'とし', icon: 'Building2', color: 'var(--wa-ai)' },
  { id: 'heritage', label: 'Temples & Heritage', jp: '寺社', kana: 'じしゃ じんじゃ てら', icon: 'Landmark', color: 'var(--wa-shu)' },
  { id: 'nature', label: 'Mountains & Nature', jp: '自然', kana: 'しぜん やま', icon: 'MountainSnow', color: 'var(--wa-matcha)' },
  { id: 'islands', label: 'Islands & Coast', jp: '島', kana: 'しま うみ', icon: 'Waves', color: 'var(--wa-sora)' },
  { id: 'food', label: 'Food & Drink', jp: '食', kana: 'しょく たべもの', icon: 'Soup', color: 'var(--wa-yamabuki)' },
  { id: 'onsen', label: 'Onsen & Ryokan', jp: '温泉', kana: 'おんせん', icon: 'Bath', color: 'var(--wa-fuji)' },
  { id: 'festivals', label: 'Festivals & Seasons', jp: '祭', kana: 'まつり', icon: 'Flower2', color: 'var(--wa-sakura)' },
  { id: 'craft', label: 'Arts & Craft', jp: '工芸', kana: 'こうげい', icon: 'Brush', color: 'var(--wa-kin)' },
];

/** id → category, with no prototype (see lookup.js), so ids from user data are safe to look up. */
export const CATEGORY_MAP = byId(CATEGORIES);

export function getCategory(id) {
  return CATEGORY_MAP[id] ?? { id, label: id, jp: '旅', icon: 'Sparkles', color: 'var(--accent)' };
}
