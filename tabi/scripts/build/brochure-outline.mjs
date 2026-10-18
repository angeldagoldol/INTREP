/**
 * Brochure outlines: the light version of a built-in brochure that the entry
 * chunk carries, so the first paint of every route does not wait for twelve
 * brochures' worth of page text.
 *
 * `import x from './brochures/kyoto-thousand-gates.js?outline'` gives the
 * brochure with every top-level field (title, cover, theme, location,
 * sources, factsChecked…) and one stub per page that keeps only what the
 * Library, palette, Credits and the Studio's photo library read without
 * rendering a page: id, type, name, nameJp, kicker, photo and the `photo` of
 * each item. It also gains
 * `outline: '<file stem>'`, which src/data/catalog.js uses to load the full
 * module (its own lazy chunk) when a page is drawn.
 *
 * `./brochures/index.js?outline` is the index with each of its relative
 * imports switched to `?outline`, so the curated order stays in one place.
 *
 * Works on the source text (no evaluation): the brochure files are plain
 * `export default { … }` literals. Anything it does not recognise is left
 * whole — a page it cannot outline keeps all its fields, a file that is not
 * an object literal is not outlined at all (and src/data/catalog.js then
 * treats it as already complete).
 */
import { parseAst } from 'rollup/parseAst';

/** Page fields an outline keeps. */
export const OUTLINE_PAGE_KEYS = ['id', 'type', 'name', 'nameJp', 'kicker', 'photo'];
/** List fields of a page an outline keeps, and the keys kept in each entry. */
export const OUTLINE_LIST_KEYS = { items: ['photo'] };

const QUERY = /[?&]outline(?:&|$)/;

function keyName(prop) {
  if (!prop || prop.type !== 'Property' || prop.computed || prop.kind !== 'init') return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

/** `{ … }` keeping only `keys` (and outlined `lists`), or null when the node can't be outlined safely. */
function pick(code, node, keys, lists = {}) {
  if (!node || node.type !== 'ObjectExpression') return null;
  const parts = [];
  for (const prop of node.properties) {
    const key = keyName(prop);
    if (key === null) return null; // a spread, getter or computed key: keep the page whole
    if (keys.includes(key)) {
      parts.push(code.slice(prop.start, prop.end));
    } else if (lists[key]) {
      if (prop.value.type !== 'ArrayExpression') return null;
      const entries = prop.value.elements.map((el) => pick(code, el, lists[key]));
      if (entries.some((e) => e === null)) return null;
      parts.push(`${JSON.stringify(key)}: [${entries.join(', ')}]`);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * The outline of one brochure module's source, or null when the source is
 * not an `export default { … }` object literal with a `pages` array.
 */
export function outlineBrochureSource(code, stem) {
  let ast;
  try {
    ast = parseAst(code);
  } catch {
    return null;
  }
  const decl = ast.body.find((node) => node.type === 'ExportDefaultDeclaration');
  const object = decl?.declaration;
  if (!object || object.type !== 'ObjectExpression') return null;
  const pagesProp = object.properties.find((prop) => keyName(prop) === 'pages');
  if (!pagesProp || pagesProp.value.type !== 'ArrayExpression') return null;
  const pages = pagesProp.value;
  const stubs = pages.elements.map((el) => (el ? (pick(code, el, OUTLINE_PAGE_KEYS, OUTLINE_LIST_KEYS) ?? code.slice(el.start, el.end)) : 'null'));
  // Splice the later position first so the earlier offset stays valid.
  const withPages = `${code.slice(0, pages.start)}[\n${stubs.join(',\n')}\n]${code.slice(pages.end)}`;
  const at = object.start + 1;
  return `${withPages.slice(0, at)} outline: ${JSON.stringify(stem)},${withPages.slice(at)}`;
}

/** The brochure index with each relative `.js` import pointing at its outline. */
export function outlineIndexSource(code) {
  return code.replace(/(\bfrom\s*)(['"])(\.\/[^'"?]+\.js)\2/g, '$1$2$3?outline$2');
}

/**
 * Vite plugin: serves `?outline` imports of src/data/brochures/*.js. The
 * real file stays the module graph's dependency, so editing a brochure
 * updates both its outline and its full chunk.
 */
export function brochureOutlines() {
  const file = /[\\/]src[\\/]data[\\/]brochures[\\/]([^\\/]+)\.js$/;
  return {
    name: 'tabi-brochure-outlines',
    enforce: 'pre',
    transform(code, id) {
      const [path, query = ''] = id.split('?');
      if (!QUERY.test(`?${query}`)) return null;
      const match = file.exec(path);
      if (!match) return null;
      const stem = match[1];
      const out = stem === 'index' ? outlineIndexSource(code) : outlineBrochureSource(code, stem);
      return out === null ? null : { code: out, map: null };
    },
  };
}
