import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, polar, r1 } from '../svg.js';

/** Hairline rays as one path — a woodblock-print glow, not a flag. */
function raysPath(cx, cy, from, to, count) {
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const [x1, y1] = polar(cx, cy, from, angle);
    const [x2, y2] = polar(cx, cy, to, angle);
    d += `M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`;
  }
  return d;
}

/** 日の丸 Hinomaru — the rising-sun disc: minimal poster, striped sunset over the sea, or a ray-lit sun. */
export function hinomaru(ctx) {
  const { rng, pal, id } = ctx;
  const defs = [];
  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mode = rng.pick(['disc', 'sunset', 'rays']);

  if (mode === 'disc') {
    const r = rng.range(74, 104);
    const cx = r1(W / 2 + rng.range(-22, 22));
    const cy = r1(rng.range(170, 230));
    const disc = el('circle', { cx, cy, r: r1(r), fill: pal.accent });
    const halo = Array.from({ length: rng.int(3, 5) }, (_, i) =>
      el('circle', { cx, cy, r: r1(r + 14 + i * rng.range(9, 14)), fill: 'none', stroke: pal.ink, strokeWidth: 0.6, opacity: r1(0.4 - i * 0.07) }),
    );
    const bandX = r1(rng.pick([rng.range(26, 70), rng.range(230, 274)]));
    layers.push(
      el('rect', { x: bandX, y: 0, width: r1(rng.range(5, 12)), height: H, fill: pal.accent2 }),
      el('rect', { x: 0, y: r1(cy + r + rng.range(30, 60)), width: W, height: 1, fill: pal.ink, opacity: 0.5 }),
      g({ anim: 'breathe', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--s': 1.05, '--dur': '7s' } }, halo),
      g({ anim: 'float', vars: { '--dy': '-5px', '--dur': '9s' } }, [misregister(ctx, disc, { color: pal.accent2 })]),
    );
  } else if (mode === 'sunset') {
    const horizon = rng.range(232, 270);
    const r = rng.range(80, 112);
    const cx = r1(W / 2 + rng.range(-28, 28));
    const cy = r1(horizon - r * rng.range(0.3, 0.6));
    defs.push(el('clipPath', { id: id('sun') }, [el('circle', { cx, cy, r: r1(r) })]));
    const disc = el('circle', { cx, cy, r: r1(r), fill: pal.accent });
    // Paper stripes cut through the lower half of the sun, thickening downward.
    const stripes = Array.from({ length: 6 }, (_, i) =>
      el('rect', { x: cx - r, y: r1(cy + i * r * 0.15), width: r1(r * 2), height: r1(1.2 + i * 1.7), fill: pal.paper }),
    );
    const glints = Array.from({ length: rng.int(6, 9) }, (_, i) => {
      const w = r * (1.5 - i * 0.14) * rng.range(0.7, 1);
      return el('rect', { x: r1(cx - w / 2 + rng.range(-8, 8)), y: r1(horizon + 12 + i * 15), width: r1(Math.max(8, w)), height: 3, rx: 1.5, fill: pal.accent, opacity: r1(0.9 - i * 0.07) });
    });
    layers.push(
      disc,
      misregister(ctx, disc, { color: pal.accent2 }),
      g({ clipPath: `url(#${id('sun')})` }, [g({ anim: 'float', vars: { '--dy': '6px', '--dur': '8s' } }, stripes)]),
      el('rect', { x: 0, y: r1(horizon), width: W, height: r1(H - horizon), fill: pal.accent2 }),
      g({ anim: 'drift', vars: { '--dx': '10px', '--dur': '7s' } }, glints),
      el('rect', { x: 0, y: r1(horizon), width: W, height: 1.2, fill: pal.ink, opacity: 0.6 }),
    );
  } else {
    const cx = r1(W / 2 + rng.range(-34, 34));
    const cy = r1(rng.range(150, 230));
    const r = rng.range(44, 68);
    const disc = el('circle', { cx, cy, r: r1(r), fill: pal.accent });
    const bands = Array.from({ length: 3 }, (_, i) =>
      el('rect', { x: 0, y: r1(H - 52 + i * 18), width: W, height: r1(18 - i * 4), fill: pal.tint(pal.accent2, 0.45 + i * 0.25) }),
    );
    layers.push(
      g({ anim: 'spin', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--dur': '140s' } }, [
        el('path', { d: raysPath(cx, cy, r + 10, 380, rng.pick([48, 60, 72])), stroke: pal.accent, strokeWidth: 0.8, opacity: 0.55 }),
      ]),
      el('circle', { cx, cy, r: r1(r + 6), fill: pal.paper }),
      el('circle', { cx, cy, r: r1(r + 6), fill: 'none', stroke: pal.accent2, strokeWidth: 0.9, strokeDasharray: '2 3' }),
      disc,
      misregister(ctx, disc, { color: pal.accent2 }),
      ...bands,
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['bottom', 'topLeft', 'right']), opacity: 0.12 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
