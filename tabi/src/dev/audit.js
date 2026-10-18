/**
 * Dev-only layout audit for rendered brochure pages (the playground's
 * "Audit" section, and window.__tabiAudit for scripted checks): finds text
 * that is clipped by a box, cut off with an ellipsis or line clamp, pushed off
 * the page, or left in a fit region that could not shrink enough.
 *
 * Decorative type that is meant to bleed (pale watermarks) is skipped by its
 * opacity; screen-reader-only text and the generative art are skipped too.
 */

const TOLERANCE = 1.5;

/**
 * Does any of `rects` reach outside `box`? Sideways by more than 1.5px;
 * up or down by more than `slack` (a text line's box is taller than its
 * glyphs when the line-height is tight, so 0.3em of it is not clipping).
 */
export function escapes(rects, box, slack = TOLERANCE) {
  return rects.some(
    (r) =>
      r.width > 0 &&
      r.height > 0 &&
      (r.left < box.left - TOLERANCE || r.right > box.right + TOLERANCE || r.top < box.top - slack || r.bottom > box.bottom + slack),
  );
}

const clips = (style) => style.overflowX !== 'visible' || style.overflowY !== 'visible';

/** Opacity of an element and its ancestors up to `root`, multiplied. */
function opacityWithin(el, root) {
  let opacity = 1;
  for (let node = el; node && node !== root.parentElement; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity) || 0;
  return opacity;
}

const intersects = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

/**
 * Issues on one page <article>: [{ kind: 'clipped'|'off-page'|'ellipsis'|'clamped'|'overlap'|'fit', text, where }].
 * `where` is the page's aria-label, so a report reads "Page 4 of 14: Kiyomizu-dera".
 */
export function auditPage(article) {
  const where = article.getAttribute('aria-label') ?? '';
  const issues = [];
  const pageBox = article.getBoundingClientRect();
  if (!pageBox.width) return issues;
  const add = (kind, el, text) => issues.push({ kind, where, text: (text ?? el.textContent ?? '').trim().slice(0, 80) });

  for (const el of article.querySelectorAll('[data-overflow]')) add('fit', el);

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  const done = new Set();
  const placed = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!el || !node.textContent.trim() || done.has(el)) continue;
    done.add(el);
    if (el.closest('.sr-only, svg[data-art], [data-audit-skip]')) continue;
    if (opacityWithin(el, article) < 0.25) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    if (!rects.length) continue;

    // Text running into other text (a cell overflowing into the next one).
    // (Vertical type is left out: its line boxes are wider than the glyphs, so columns set
    // solid at line-height 1 always "touch".)
    if (!getComputedStyle(el).writingMode.startsWith('vertical') && !el.closest('svg')) {
      const hit = placed.find((other) => !other.el.contains(el) && !el.contains(other.el) && other.rects.some((a) => rects.some((b) => intersects(a, b))));
      if (hit) add('overlap', el, `${node.textContent.trim().slice(0, 40)} ⟷ ${hit.text.slice(0, 30)}`);
      placed.push({ el, rects, text: node.textContent.trim() });
    }

    const style = getComputedStyle(el);
    const slack = Math.max(TOLERANCE, Number.parseFloat(style.fontSize) * 0.3);
    if (escapes(rects, pageBox, slack)) {
      add('off-page', el, node.textContent);
      continue;
    }
    if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      add('ellipsis', el, node.textContent);
      continue;
    }
    if (style.webkitLineClamp && style.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) {
      add('clamped', el, node.textContent);
      continue;
    }
    for (let box = el; box && box !== article; box = box.parentElement) {
      if (!clips(getComputedStyle(box))) continue;
      if (escapes(rects, box.getBoundingClientRect(), slack)) {
        add('clipped', el, node.textContent);
        break;
      }
    }
  }
  return issues;
}

/** Every issue on every page article inside `root`. */
export function auditAll(root = document) {
  return [...root.querySelectorAll('article[data-type]')].flatMap((article) => auditPage(article));
}
