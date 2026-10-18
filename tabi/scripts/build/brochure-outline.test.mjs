// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OUTLINE_LIST_KEYS, OUTLINE_PAGE_KEYS, outlineBrochureSource, outlineIndexSource } from './brochure-outline.mjs';

const DIR = fileURLToPath(new URL('../../src/data/brochures/', import.meta.url));
const STEMS = readdirSync(DIR)
  .filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.includes('.test.'))
  .map((f) => f.replace(/\.js$/, ''));

const evaluate = async (code) => (await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)).default;

describe('outlineBrochureSource', () => {
  it.each(STEMS)('%s: keeps every top-level field and a light stub per page', async (stem) => {
    const source = readFileSync(`${DIR}${stem}.js`, 'utf8');
    const out = outlineBrochureSource(source, stem);
    expect(out).not.toBeNull();
    const [full, outline] = await Promise.all([evaluate(source), evaluate(out)]);

    const { pages, ...top } = full;
    const { pages: stubs, outline: marker, ...outlineTop } = outline;
    expect(marker).toBe(stem);
    expect(outlineTop).toEqual(top);
    expect(stubs).toHaveLength(pages.length);
    pages.forEach((page, i) => {
      const stub = stubs[i];
      for (const key of Object.keys(stub)) expect([...OUTLINE_PAGE_KEYS, ...Object.keys(OUTLINE_LIST_KEYS)]).toContain(key);
      for (const key of OUTLINE_PAGE_KEYS) expect(stub[key]).toEqual(page[key]);
      for (const [list, keys] of Object.entries(OUTLINE_LIST_KEYS)) {
        if (!Array.isArray(page[list])) continue;
        expect(stub[list]).toHaveLength(page[list].length);
        page[list].forEach((entry, j) => keys.forEach((k) => expect(stub[list][j][k]).toEqual(entry[k])));
      }
    });
    // The point of the outline: it is a fraction of the brochure.
    expect(JSON.stringify(outline).length).toBeLessThan(JSON.stringify(full).length * 0.5);
  });

  it('keeps the photo ids of full-page photos and double-page spreads (Credits, the photo library)', async () => {
    const code = `export default { id: 'x', pages: [
      { id: 'p1', type: 'photo', photo: 'x-spread', span: 'left' },
      { id: 'p2', type: 'photo', photo: 'x-spread', span: 'right', name: 'Lake Ashi', nameJp: '芦ノ湖', caption: 'Long caption text' },
      { id: 'p3', type: 'photo', photo: 'x-fullpage', caption: 'Another', captionPlacement: 'below' },
    ] };`;
    const outline = await evaluate(outlineBrochureSource(code, 'x'));
    expect(outline.pages.map((p) => p.photo)).toEqual(['x-spread', 'x-spread', 'x-fullpage']);
    expect(outline.pages[1]).toEqual({ id: 'p2', type: 'photo', photo: 'x-spread', name: 'Lake Ashi', nameJp: '芦ノ湖' });
    expect(outline.pages[2]).not.toHaveProperty('caption');
  });

  it('keeps a page whole when it uses a spread, and skips files that are not object literals', async () => {
    const code = `const extra = { body: 'b' };\nexport default { id: 'x', pages: [{ id: 'p1', type: 'intro', body: 'long' }, { id: 'p2', type: 'place', ...extra }] };`;
    const outline = await evaluate(outlineBrochureSource(code, 'x'));
    expect(outline.outline).toBe('x');
    expect(outline.pages[0]).toEqual({ id: 'p1', type: 'intro' });
    expect(outline.pages[1]).toEqual({ id: 'p2', type: 'place', body: 'b' });
    expect(outlineBrochureSource(`const b = { pages: [] };\nexport default b;`, 'x')).toBeNull();
    expect(outlineBrochureSource(`export default { id: 'x' };`, 'x')).toBeNull();
    expect(outlineBrochureSource(`export default {`, 'x')).toBeNull();
  });
});

describe('outlineIndexSource', () => {
  it('points every relative brochure import at its outline', () => {
    const index = readFileSync(`${DIR}index.js`, 'utf8');
    const out = outlineIndexSource(index);
    const imports = [...out.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.length).toBe(STEMS.length);
    for (const spec of imports) expect(spec).toMatch(/^\.\/[^?]+\.js\?outline$/);
    expect(outlineIndexSource(`import a from "./a.js";\nimport b from 'pkg';`)).toBe(`import a from "./a.js?outline";\nimport b from 'pkg';`);
  });
});
