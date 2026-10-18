import { describe, expect, it } from 'vitest';
import { ART_STYLES } from '../../../data/schema.js';
import { GENERATORS, buildScene, sceneSize } from './scene.js';

const LIGHT = { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f' };
const DARK = { paper: '#13141c', ink: '#f2ede4', accent: '#ff4f7b', accent2: '#2ee6d6', muted: '#9aa0b4' };
const SEEDS = Array.from({ length: 24 }, (_, i) => i * 7 + 1);

/** Every id declared in a node tree. */
function ids(nodes, out = []) {
  for (const node of nodes) {
    if (node.a.id) out.push(node.a.id);
    if (node.c) ids(node.c, out);
  }
  return out;
}

/** Every url(#…) reference in a node tree. */
function refs(nodes, out = []) {
  for (const node of nodes) {
    for (const value of Object.values(node.a)) {
      const match = typeof value === 'string' && value.match(/url\(#([^)]+)\)/);
      if (match) out.push(match[1]);
    }
    if (node.a.href) out.push(node.a.href.slice(1));
    if (node.c) refs(node.c, out);
  }
  return out;
}

describe('buildScene', () => {
  it('has a generator for every schema art style', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual([...ART_STYLES].sort());
  });

  it.each(ART_STYLES)('%s is deterministic for the same style, seed and theme', (style) => {
    expect(buildScene(style, 7, LIGHT, 'u')).toEqual(buildScene(style, 7, LIGHT, 'u'));
  });

  it.each(ART_STYLES)('%s varies with the seed', (style) => {
    const variants = new Set(SEEDS.slice(0, 6).map((seed) => JSON.stringify(buildScene(style, seed, LIGHT, 'u'))));
    expect(variants.size).toBe(6);
  });

  it.each(ART_STYLES)('%s stays within the node budget and references only its own ids', (style) => {
    for (const theme of [LIGHT, DARK]) {
      for (const seed of SEEDS) {
        const scene = buildScene(style, seed, theme, 'cover7');
        expect(sceneSize(scene)).toBeLessThan(300);
        const declared = ids([...scene.defs, ...scene.layers]);
        expect(new Set(declared).size).toBe(declared.length);
        expect(declared.every((id) => id.startsWith('cover7-'))).toBe(true);
        for (const ref of refs([...scene.defs, ...scene.layers])) expect(declared).toContain(ref);
      }
    }
  });

  it('paints with the theme: a different palette changes the colours', () => {
    const a = JSON.stringify(buildScene('fuji', 3, LIGHT, 'u'));
    const b = JSON.stringify(buildScene('fuji', 3, DARK, 'u'));
    expect(a).not.toEqual(b);
    expect(a).toContain(LIGHT.accent2);
  });

  it('falls back gracefully for unknown styles, odd seeds and missing themes', () => {
    expect(buildScene('nope', 1).style).toBe('hinomaru');
    expect(() => buildScene('kumo', 'not-a-number', null)).not.toThrow();
    expect(() => buildScene('enso', Number.NaN, { paper: 'red' })).not.toThrow();
  });
});
