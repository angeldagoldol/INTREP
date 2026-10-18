/**
 * Cover-art scene builder: style + seed + theme → a deterministic tree of SVG
 * descriptors (see svg.js). Pure: no React, no DOM, no Math.random.
 */
import { isDark, mix, normalizeTheme } from './color.js';
import { createRng } from './rng.js';
import { countNodes } from './svg.js';
import { asanoha } from './styles/asanoha.js';
import { enso } from './styles/enso.js';
import { fuji } from './styles/fuji.js';
import { hinomaru } from './styles/hinomaru.js';
import { ichimatsu } from './styles/ichimatsu.js';
import { kumo } from './styles/kumo.js';
import { sakura } from './styles/sakura.js';
import { seigaiha } from './styles/seigaiha.js';
import { shippo } from './styles/shippo.js';
import { torii } from './styles/torii.js';

export { H as ART_HEIGHT, W as ART_WIDTH } from './svg.js';

export const GENERATORS = { seigaiha, asanoha, hinomaru, fuji, sakura, torii, shippo, enso, kumo, ichimatsu };

export const FALLBACK_STYLE = 'hinomaru';

/**
 * Everything a generator needs: a seeded rng, the palette (theme colours plus
 * whether the paper is dark and which blend mode reads as ink on it), and
 * helpers that namespace SVG ids so many covers can share a page.
 */
export function createArtContext(style, seed, theme, uid = 'art') {
  const t = normalizeTheme(theme);
  const dark = isDark(t.paper);
  return {
    rng: createRng(seed, style),
    pal: { ...t, dark, blend: dark ? 'screen' : 'multiply', tint: (color, amount) => mix(t.paper, color, amount) },
    id: (name) => `${uid}-${name}`,
    url: (name) => `url(#${uid}-${name})`,
  };
}

/** Build the scene for a cover. Unknown styles fall back to the rising sun. */
export function buildScene(style, seed = 1, theme, uid = 'art') {
  const key = Object.hasOwn(GENERATORS, style) ? style : FALLBACK_STYLE;
  const { defs = [], layers = [] } = GENERATORS[key](createArtContext(key, seed, theme, uid));
  return { style: key, defs, layers };
}

export function sceneSize(scene) {
  return countNodes(scene.defs) + countNodes(scene.layers);
}
