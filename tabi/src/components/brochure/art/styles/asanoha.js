import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, pts, r1 } from '../svg.js';

/**
 * Asanoha lines for one s × 2h tile: an equilateral triangle lattice with a
 * spoke from every vertex to its triangle's centre — the six-leaf hemp star.
 */
function asanohaPath(s) {
  const h = (s * Math.sqrt(3)) / 2;
  const parts = [];
  const triangle = (a, b, c) => {
    const centre = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    for (const [p, q] of [[a, b], [b, c], [c, a], [a, centre], [b, centre], [c, centre]]) {
      parts.push(`M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`);
    }
  };
  for (let row = 0; row < 2; row += 1) {
    const ox = row ? s / 2 : 0;
    const y0 = row * h;
    const y1 = y0 + h;
    for (let k = -1; k <= 1; k += 1) {
      const x = ox + k * s;
      triangle([x, y1], [x + s, y1], [x + s / 2, y0]);
      triangle([x + s / 2, y0], [x + s * 1.5, y0], [x + s, y1]);
    }
  }
  return { d: parts.join(''), h };
}

function linePattern(id, s, { stroke, width, rotate = 0 }) {
  const { d, h } = asanohaPath(s);
  return el('pattern', { id, width: s, height: r1(2 * h), patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rotate})` }, [
    el('path', { d, fill: 'none', stroke, strokeWidth: width, strokeLinecap: 'round' }),
  ]);
}

/** Regular hexagon around a lattice vertex (its six neighbours). */
function hexagon(cx, cy, s) {
  return Array.from({ length: 6 }, (_, i) => [cx + s * Math.cos((Math.PI / 3) * i), cy + s * Math.sin((Math.PI / 3) * i)]);
}

/** 麻の葉 Asanoha — hemp-leaf star lattice: medallion, split field or scattered coloured stars. */
export function asanoha(ctx) {
  const { rng, pal, id } = ctx;
  const s = rng.pick([22, 26, 30, 34]);
  const field = id('field');
  const defs = [linePattern(field, s, { stroke: pal.ink, width: 0.75 })];
  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mode = rng.pick(['medallion', 'split', 'stars']);

  if (mode === 'medallion') {
    const R = rng.range(96, 122);
    const cx = r1(W / 2 + rng.range(-28, 28));
    const cy = r1(rng.range(178, 236));
    const inner = id('inner');
    defs.push(
      linePattern(inner, s * rng.pick([1.5, 2]), { stroke: pal.paper, width: 1.1, rotate: rng.pick([0, 30, 90]) }),
      el('clipPath', { id: id('disc') }, [el('circle', { cx, cy, r: r1(R) })]),
    );
    const disc = el('circle', { cx, cy, r: r1(R), fill: pal.accent });
    layers.push(
      el('rect', { width: W, height: H, fill: `url(#${field})`, opacity: 0.32 }),
      el('circle', { cx, cy, r: r1(R + 14), fill: pal.paper }),
      el('circle', { cx, cy, r: r1(R + 9), fill: 'none', stroke: pal.accent2, strokeWidth: 1.6 }),
      disc,
      misregister(ctx, disc, { color: pal.accent2 }),
      g({ clipPath: `url(#${id('disc')})` }, [
        g({ anim: 'spin', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--dur': '160s' } }, [
          el('rect', { x: cx - R * 1.5, y: cy - R * 1.5, width: r1(R * 3), height: r1(R * 3), fill: `url(#${inner})` }),
        ]),
      ]),
      el('circle', {
        cx: r1(cx + R * rng.range(0.55, 0.8) * rng.sign()),
        cy: r1(cy - R * rng.range(0.75, 0.95)),
        r: r1(rng.range(12, 18)),
        fill: pal.accent2,
      }),
    );
  } else if (mode === 'split') {
    const y = rng.range(190, 250);
    const tilt = rng.range(-36, 36);
    const top = `M-10 -10 L${W + 10} -10 L${W + 10} ${r1(y - tilt)} L-10 ${r1(y + tilt)} Z`;
    const light = id('light');
    defs.push(linePattern(light, s, { stroke: pal.paper, width: 0.9 }), el('clipPath', { id: id('top') }, [el('path', { d: top })]));
    const sr = rng.range(34, 54);
    const sx = rng.range(80, 220);
    const sun = el('circle', { cx: r1(sx), cy: r1(y + tilt * ((W / 2 - sx) / (W / 2)) * 0.9), r: r1(sr), fill: pal.accent });
    layers.push(
      el('rect', { width: W, height: H, fill: `url(#${field})`, opacity: 0.38 }),
      el('path', { d: top, fill: pal.accent2 }),
      g({ clipPath: `url(#${id('top')})` }, [
        g({ anim: 'drift', vars: { '--dx': `${s}px`, '--dur': '30s' } }, [
          el('rect', { x: -s * 2, y: -10, width: W + s * 4, height: r1(y + 50), fill: `url(#${light})`, opacity: 0.55 }),
        ]),
      ]),
      g({ anim: 'float', vars: { '--dy': '-6px', '--dur': '10s' } }, [misregister(ctx, sun, { color: pal.ink, opacity: 0.45 })]),
    );
  } else {
    // Colour a handful of hexagons on the lattice, then draw the lines over them.
    const h = (s * Math.sqrt(3)) / 2;
    const stars = [];
    const taken = new Set();
    const count = rng.int(9, 14);
    for (let tries = 0; stars.length < count && tries < 80; tries += 1) {
      const row = rng.int(2, Math.floor(H / h) - 2);
      const col = rng.int(0, Math.floor(W / s));
      const key = `${row}:${col}`;
      if (taken.has(key) || taken.has(`${row}:${col - 1}`) || taken.has(`${row - 1}:${col}`)) continue;
      taken.add(key);
      const cx = col * s + (row % 2 ? 0 : s / 2);
      const fill = rng.pick([pal.accent, pal.accent, pal.accent2, pal.tint(pal.accent, 0.5)]);
      stars.push(el('polygon', { points: pts(hexagon(cx, row * h, s)), fill }));
    }
    const sr = rng.range(56, 80);
    const sun = el('circle', { cx: r1(rng.range(90, 210)), cy: r1(rng.range(150, 260)), r: r1(sr), fill: pal.tint(pal.accent2, 0.22) });
    layers.push(
      sun,
      g({ anim: 'pulse', vars: { '--to': 0.55, '--dur': '6s' } }, stars),
      el('rect', { width: W, height: H, fill: `url(#${field})`, opacity: 0.75 }),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['bottom', 'bottomRight', 'left']), opacity: 0.13 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
