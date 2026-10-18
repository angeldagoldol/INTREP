/**
 * Brochure colour palettes named after traditional Japanese colour pairings
 * (配色, haishoku). Each sets the five theme colours; typeface is left to the
 * author. Ink always reads at AA (≥ 4.5:1) on its paper — see palettes.test.js.
 */
export const PALETTES = [
  {
    id: 'shu-kinari',
    name: 'Shu & Kinari',
    jp: '朱と生成',
    note: 'Vermilion on unbleached washi',
    theme: { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' },
  },
  {
    id: 'ai-night',
    name: 'Ai Night',
    jp: '藍の夜',
    note: 'Indigo dusk, lantern red and gold',
    theme: { paper: '#14213a', ink: '#f1ead9', accent: '#ef5a3c', accent2: '#d6a84a', muted: '#a9b4c6' },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    jp: '桜',
    note: 'Blossom pink with fresh-leaf green',
    theme: { paper: '#fbf1f1', ink: '#3a1f2b', accent: '#d9507a', accent2: '#5f7f3a', muted: '#86636f' },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    jp: '抹茶',
    note: 'Whisked tea green and roasted clay',
    theme: { paper: '#eef0e2', ink: '#1f2a17', accent: '#5f7f2e', accent2: '#b5532c', muted: '#5d6a50' },
  },
  {
    id: 'sumi',
    name: 'Sumi',
    jp: '墨',
    note: 'Ink wash with a single red seal',
    theme: { paper: '#f6f4ef', ink: '#141413', accent: '#2a2926', accent2: '#c4283b', muted: '#66625a' },
  },
  {
    id: 'momiji',
    name: 'Momiji',
    jp: '紅葉',
    note: 'Autumn maple and gold leaf',
    theme: { paper: '#f7ecdc', ink: '#2a160c', accent: '#c8451f', accent2: '#b07d22', muted: '#7a5b45' },
  },
  {
    id: 'neon-tokyo',
    name: 'Neon Tokyo',
    jp: '夜の東京',
    note: 'Midnight with pink and cyan signs',
    theme: { paper: '#0f1020', ink: '#f5f1ff', accent: '#ff3d7f', accent2: '#22d3c5', muted: '#a09cbd' },
  },
  {
    id: 'yuki',
    name: 'Yuki',
    jp: '雪',
    note: 'Fresh snow, ice blue and a red scarf',
    theme: { paper: '#f3f6f8', ink: '#13212d', accent: '#2f7fb0', accent2: '#c4283b', muted: '#5a6977' },
  },
];

export const PALETTE_MAP = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

const COLOUR_KEYS = ['paper', 'ink', 'accent', 'accent2', 'muted'];

/** The palette whose five colours match `theme` exactly (case-insensitive), or null. */
export function matchPalette(theme) {
  if (!theme) return null;
  return (
    PALETTES.find((p) => COLOUR_KEYS.every((k) => String(theme[k] ?? '').toLowerCase() === p.theme[k])) ?? null
  );
}
