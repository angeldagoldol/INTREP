import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, r1, smoothPath } from '../svg.js';

/**
 * One pattern tile (2R × R) of seigaiha scales. Rows are painted top to
 * bottom so each lower row overlaps the one above — the fan-of-waves look.
 */
function scaleTile(R, rings, { base, alt, line }) {
  const sw = r1(R * 0.07);
  const centres = [
    [R, 0],
    [0, R / 2],
    [2 * R, R / 2],
    [R, R],
  ];
  return centres.map(([cx, cy]) =>
    g(
      {},
      Array.from({ length: rings }, (_, k) => {
        const fill = alt ? (k % 2 ? alt : base) : k === 0 ? base : 'none';
        return el('circle', { cx, cy, r: r1(R * (1 - k / rings)), fill, stroke: line, strokeWidth: sw });
      }),
    ),
  );
}

/** Plovers over the waves (nami-chidori), a classic pairing with seigaiha. */
function plovers(rng, color, { yMin, yMax }) {
  const count = rng.int(2, 4);
  const x0 = rng.range(40, 200);
  const y0 = rng.range(yMin, yMax);
  return g(
    { fill: 'none', stroke: color, strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' },
    Array.from({ length: count }, (_, i) => {
      const s = rng.range(0.8, 1.35);
      const x = r1(x0 + i * rng.range(16, 26));
      const y = r1(y0 + rng.range(-12, 12));
      return el('path', { d: 'M-7 0 Q-3.5 -4.5 0 0 Q3.5 -4.5 7 0', transform: `translate(${x} ${y}) scale(${r1(s)})` });
    }),
  );
}

/** 青海波 Seigaiha — overlapping concentric wave scales: sea, fan or moon-window composition. */
export function seigaiha(ctx) {
  const { rng, pal, id } = ctx;
  const R = rng.pick([15, 17, 19, 22, 25]);
  const rings = rng.int(3, 5);
  const scheme = rng.pick(['indigo', 'line', 'vermilion', 'bands']);
  const colours = {
    indigo: { base: pal.accent2, line: pal.paper, sun: pal.accent, off: pal.accent2 },
    line: { base: pal.paper, line: pal.accent2, sun: pal.accent, off: pal.accent2 },
    vermilion: { base: pal.accent, line: pal.paper, sun: pal.accent2, off: pal.accent },
    bands: { base: pal.accent2, alt: pal.tint(pal.accent2, 0.5), line: pal.paper, sun: pal.accent, off: pal.accent2 },
  }[scheme];

  const tile = id('wave');
  const defs = [el('pattern', { id: tile, width: 2 * R, height: R, patternUnits: 'userSpaceOnUse' }, scaleTile(R, rings, colours))];
  // The pattern slides by exactly one tile, so the loop is seamless.
  const waves = (y, height) =>
    g({ anim: 'slide', vars: { '--dx': `${2 * R}px`, '--dur': `${r1(rng.range(18, 28))}s` } }, [
      el('rect', { x: -4 * R, y, width: W + 8 * R, height, fill: `url(#${tile})` }),
    ]);

  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mode = rng.pick(['sea', 'fan', 'window']);
  let sun;

  if (mode === 'sea') {
    const horizon = rng.range(200, 246);
    const crest = [];
    for (let x = -20; x <= W + 20; x += 40) crest.push([x, horizon + rng.range(-10, 10)]);
    const edge = smoothPath(crest);
    defs.push(el('clipPath', { id: id('sea') }, [el('path', { d: `${edge} L${W + 20} ${H + 10} L-20 ${H + 10} Z` })]));
    const sr = rng.range(30, 50);
    sun = el('circle', { cx: r1(rng.range(70, 230)), cy: r1(rng.range(110, horizon - sr * 0.3)), r: r1(sr), fill: colours.sun });
    layers.push(
      g({ anim: 'float', vars: { '--dy': '-5px', '--dur': '9s' } }, [misregister(ctx, sun, { color: colours.off })]),
      g({ clipPath: `url(#${id('sea')})` }, [waves(horizon - 24, H - horizon + 40)]),
      el('path', { d: edge, fill: 'none', stroke: pal.ink, strokeWidth: 1.1, opacity: 0.6 }),
      plovers(rng, pal.ink, { yMin: 78, yMax: horizon - 70 }),
    );
  } else if (mode === 'fan') {
    const fr = rng.range(170, 215);
    const fx = r1(W / 2 + rng.range(-45, 45));
    const fy = r1(H - rng.range(25, 60));
    defs.push(el('clipPath', { id: id('fan') }, [el('circle', { cx: fx, cy: fy, r: r1(fr) })]));
    const sr = rng.range(24, 40);
    sun = el('circle', { cx: r1(rng.range(70, 230)), cy: r1(Math.max(86, fy - fr - sr - rng.range(8, 30))), r: r1(sr), fill: colours.sun });
    layers.push(
      el('circle', { cx: fx, cy: fy, r: r1(fr + 16), fill: 'none', stroke: pal.accent2, strokeWidth: 0.8, opacity: 0.6 }),
      g({ anim: 'float', vars: { '--dy': '-6px', '--dur': '10s' } }, [misregister(ctx, sun, { color: colours.off })]),
      g({ clipPath: `url(#${id('fan')})` }, [waves(fy - fr - R, fr + R * 2)]),
      el('circle', { cx: fx, cy: fy, r: r1(fr), fill: 'none', stroke: pal.ink, strokeWidth: 1.4 }),
      plovers(rng, pal.ink, { yMin: 74, yMax: Math.max(90, fy - fr - 30) }),
    );
  } else {
    const wr = rng.range(78, 102);
    const wx = r1(W / 2 + rng.range(-35, 35));
    const wy = r1(rng.range(160, 230));
    defs.push(el('clipPath', { id: id('moon') }, [el('circle', { cx: wx, cy: wy, r: r1(wr) })]));
    sun = el('circle', { cx: r1(wx + rng.range(-20, 20)), cy: r1(wy - wr * rng.range(0.05, 0.3)), r: r1(wr * 0.42), fill: colours.sun });
    const mist = Array.from({ length: 3 }, (_, i) =>
      el('rect', {
        x: r1(wx - wr + rng.range(-10, 40)),
        y: r1(wy + wr * 0.2 + i * 12),
        width: r1(wr * rng.range(0.9, 1.4)),
        height: 5,
        rx: 2.5,
        fill: pal.tint(pal.accent2, 0.35 + i * 0.15),
      }),
    );
    layers.push(
      waves(-R, H + 2 * R),
      el('circle', { cx: wx, cy: wy, r: r1(wr + 7), fill: pal.paper }),
      el('circle', { cx: wx, cy: wy, r: r1(wr), fill: pal.paper, stroke: pal.ink, strokeWidth: 1.2 }),
      g({ clipPath: `url(#${id('moon')})` }, [
        g({ anim: 'float', vars: { '--dy': '-6px', '--dur': '11s' } }, [misregister(ctx, sun, { color: colours.off })]),
        g({ anim: 'drift', vars: { '--dx': '14px', '--dur': '16s' } }, mist),
      ]),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['top', 'topLeft', 'right']), opacity: 0.14 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
