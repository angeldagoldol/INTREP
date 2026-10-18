/**
 * Print character shared by every cover: halftone screens, paper flecks and
 * a misregistered second ink — the small imperfections of a real print run.
 */
import { H, W, el, g, r1 } from './svg.js';

const FADES = {
  top: { x1: 0, y1: 0, x2: 0, y2: 1 },
  bottom: { x1: 0, y1: 1, x2: 0, y2: 0 },
  left: { x1: 0, y1: 0, x2: 1, y2: 0 },
  right: { x1: 1, y1: 0, x2: 0, y2: 0 },
  topLeft: { x1: 0, y1: 0, x2: 0.8, y2: 0.8 },
  bottomRight: { x1: 1, y1: 1, x2: 0.2, y2: 0.2 },
};

/**
 * A 45° halftone dot screen that fades out from one edge.
 * Returns { defs, layer }.
 */
export function halftone(ctx, { color, from = 'bottom', opacity = 0.18, cell = 5, dot = 1.15, reach = 0.6 }) {
  const dots = ctx.id('ht-dots');
  const fade = ctx.id('ht-fade');
  const mask = ctx.id('ht-mask');
  return {
    defs: [
      el('pattern', { id: dots, width: cell, height: cell, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
        el('circle', { cx: cell / 2, cy: cell / 2, r: dot, fill: color }),
      ]),
      // Mask gradients are luminance, not colour: white = visible.
      el('linearGradient', { id: fade, ...(FADES[from] ?? FADES.bottom) }, [
        el('stop', { offset: 0, stopColor: '#fff' }),
        el('stop', { offset: reach, stopColor: '#fff', stopOpacity: 0 }),
      ]),
      el('mask', { id: mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, [
        el('rect', { width: W, height: H, fill: `url(#${fade})` }),
      ]),
    ],
    layer: el('rect', { width: W, height: H, fill: `url(#${dots})`, mask: `url(#${mask})`, opacity }),
  };
}

/** Tiny ink flecks, like fibres caught in handmade washi. */
export function flecks(ctx, { color, count = 14, opacity = 0.35 }) {
  const { rng } = ctx;
  return g(
    { fill: color, opacity },
    Array.from({ length: count }, () =>
      el('circle', { cx: r1(rng.range(6, W - 6)), cy: r1(rng.range(6, H - 6)), r: r1(rng.range(0.35, 1.1)) }),
    ),
  );
}

/** Deep-copy a node tree, repainting every solid fill/stroke with `color`. */
function repaint(node, color) {
  const a = { ...node.a };
  for (const key of ['fill', 'stroke']) {
    if (a[key] && a[key] !== 'none' && !String(a[key]).startsWith('url(')) a[key] = color;
  }
  delete a.anim;
  delete a.vars;
  delete a.id;
  return node.c ? { t: node.t, a, c: node.c.map((child) => repaint(child, color)) } : { t: node.t, a };
}

/**
 * The shape with a second ink printed beneath it, slightly off register, so
 * a thin fringe of the other colour shows along one edge. Returns a group of
 * [offset copy, original]. Multiply on light paper, screen on dark paper.
 */
export function misregister(ctx, node, { color, dx = 2.4, dy = 1.6, opacity = 0.7 }) {
  return g({}, [
    g({ transform: `translate(${r1(dx)} ${r1(dy)})`, opacity, style: { mixBlendMode: ctx.pal.blend } }, [repaint(node, color)]),
    node,
  ]);
}
