import { flecks, halftone } from '../print.js';
import { H, W, el, g, pts, r1 } from '../svg.js';

/** Horizontal gradient that runs accent → accent2 → accent, reflected. */
function neon(id, pal) {
  return el('linearGradient', { id, x1: 0, y1: 0, x2: W, y2: 0, gradientUnits: 'userSpaceOnUse', spreadMethod: 'reflect' }, [
    el('stop', { offset: 0, stopColor: pal.accent }),
    el('stop', { offset: 0.5, stopColor: pal.accent2 }),
    el('stop', { offset: 1, stopColor: pal.accent }),
  ]);
}

/** The gradient slides beneath a static mask, so the checks shimmer. */
function shimmer(mask, fill, { y = 0, height = H } = {}) {
  return g({ mask: `url(#${mask})` }, [
    g({ anim: 'drift', vars: { '--dx': `${-W}px`, '--dur': '18s' } }, [el('rect', { x: -W, y, width: W * 3, height, fill })]),
  ]);
}

/** 市松 Ichimatsu — the checkerboard with a neon twist: perspective floor, flat field or op-art warp. */
export function ichimatsu(ctx) {
  const { rng, pal, id, url } = ctx;
  const glow = id('neon');
  const mask = id('checks');
  const defs = [neon(glow, pal)];
  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mode = rng.pick(['floor', 'flat', 'warp']);

  if (mode === 'floor') {
    // Checks in one-point perspective, fading toward the horizon.
    const hz = rng.range(204, 244);
    const vx = W / 2 + rng.range(-30, 30);
    const wb = rng.range(46, 62);
    const q = rng.range(1.35, 1.55);
    const depth = H - hz + 36;
    const fade = id('fade');
    const tiles = [];
    for (let j = 0; j < 9; j += 1) {
      const y0 = hz + depth / q ** j;
      const y1 = hz + depth / q ** (j + 1);
      for (let c = -7; c < 7; c += 1) {
        if ((c + j) % 2 !== 0) continue;
        const x = (col, row) => vx + (col * wb) / q ** row;
        tiles.push(el('polygon', { points: pts([[x(c, j), y0], [x(c + 1, j), y0], [x(c + 1, j + 1), y1], [x(c, j + 1), y1]]) }));
      }
    }
    defs.push(
      el('linearGradient', { id: fade, x1: 0, y1: hz, x2: 0, y2: H, gradientUnits: 'userSpaceOnUse' }, [
        el('stop', { offset: 0, stopColor: '#fff', stopOpacity: 0 }),
        el('stop', { offset: 0.5, stopColor: '#fff' }),
      ]),
      el('mask', { id: mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, [g({ fill: `url(#${fade})` }, tiles)]),
      el('clipPath', { id: id('sun') }, [el('rect', { x: 0, y: 0, width: W, height: r1(hz) })]),
    );
    const r = rng.range(62, 88);
    const cy = hz - r * rng.range(0.25, 0.55);
    const cuts = Array.from({ length: 6 }, (_, i) => el('rect', { x: 0, y: r1(cy + i * r * 0.14), width: W, height: r1(1 + i * 1.6), fill: pal.paper }));
    layers.push(
      g({ clipPath: url('sun') }, [
        el('circle', { cx: r1(vx), cy: r1(cy), r: r1(r), fill: `url(#${glow})` }),
        g({ anim: 'float', vars: { '--dy': '5px', '--dur': '6s' } }, cuts),
      ]),
      shimmer(mask, `url(#${glow})`, { y: hz, height: H - hz }),
      el('rect', { x: 0, y: r1(hz - 1), width: W, height: 4, fill: pal.accent, opacity: 0.25 }),
      el('rect', { x: 0, y: r1(hz), width: W, height: 1.2, fill: pal.accent }),
    );
  } else if (mode === 'flat') {
    const c = rng.pick([18, 22, 26, 30]);
    const tile = id('tile');
    defs.push(
      el('pattern', { id: tile, width: 2 * c, height: 2 * c, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rng.pick([0, 45])})` }, [
        el('rect', { width: c, height: c, fill: '#fff' }),
        el('rect', { x: c, y: c, width: c, height: c, fill: '#fff' }),
      ]),
      el('mask', { id: mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, [el('rect', { width: W, height: H, fill: `url(#${tile})` })]),
    );
    // An arched window (katōmado) cut out of the checks, with a sun inside.
    const aw = rng.range(78, 104);
    const ax = W / 2 + rng.range(-30, 30);
    const top = rng.range(96, 140);
    const bottom = top + rng.range(170, 210);
    const arch = `M${r1(ax - aw)} ${r1(bottom)} L${r1(ax - aw)} ${r1(top + aw)} A${r1(aw)} ${r1(aw)} 0 0 1 ${r1(ax + aw)} ${r1(top + aw)} L${r1(ax + aw)} ${r1(bottom)} Z`;
    layers.push(
      shimmer(mask, `url(#${glow})`),
      el('path', { d: arch, fill: pal.paper, stroke: pal.ink, strokeWidth: 1.4 }),
      el('circle', { cx: r1(ax), cy: r1(top + aw * rng.range(0.9, 1.3)), r: r1(aw * 0.5), fill: pal.accent }),
      el('rect', { x: r1(ax - aw), y: r1(bottom - 28), width: r1(aw * 2), height: 1, fill: pal.ink, opacity: 0.6 }),
      el('rect', { x: r1(ax - aw * 0.7), y: r1(bottom - 18), width: r1(aw * 1.4), height: 4, rx: 2, fill: pal.accent2 }),
    );
  } else {
    // Op-art: rows and columns squeezed through a lens.
    const cols = 8;
    const rows = 11;
    const ka = rng.range(0.5, 0.85);
    const kb = rng.range(0.4, 0.8);
    const phase = rng.range(0, 1);
    const lens = (t, k) => t + (k * Math.sin(2 * Math.PI * (t + phase))) / (2 * Math.PI);
    const xs = Array.from({ length: cols + 1 }, (_, i) => r1(lens(i / cols, ka) * W));
    const ys = Array.from({ length: rows + 1 }, (_, i) => r1(lens(i / rows, kb) * H));
    const cells = [];
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i + j) % 2) continue;
        cells.push(el('rect', { x: xs[i], y: ys[j], width: r1(xs[i + 1] - xs[i] + 0.3), height: r1(ys[j + 1] - ys[j] + 0.3) }));
      }
    }
    defs.push(el('mask', { id: mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, [g({ fill: '#fff' }, cells)]));
    const r = rng.range(50, 74);
    layers.push(
      shimmer(mask, `url(#${glow})`),
      el('circle', { cx: r1(W / 2 + rng.range(-40, 40)), cy: r1(rng.range(150, 260)), r: r1(r), fill: pal.paper, stroke: pal.ink, strokeWidth: 1.2 }),
    );
  }

  const screen = halftone(ctx, { color: pal.dark ? pal.accent2 : pal.ink, from: rng.pick(['top', 'topLeft']), opacity: 0.16, reach: 0.4 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink, count: 10 }));
  return { defs, layers };
}
