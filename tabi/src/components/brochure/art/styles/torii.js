import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, pts, r1, ridgePath } from '../svg.js';

/**
 * A myōjin-style torii in local units (origin at ground centre, ~126 wide,
 * ~115 tall): tapered pillars with black bases, tie beam, strut and an
 * upswept black-topped lintel.
 */
function gate({ body, dark }) {
  return [
    el('polygon', { points: pts([[-38, 0], [-28, 0], [-29.5, -97], [-36.5, -97]]), fill: body }),
    el('polygon', { points: pts([[28, 0], [38, 0], [36.5, -97], [29.5, -97]]), fill: body }),
    el('rect', { x: -39, y: -9, width: 12, height: 9, fill: dark }),
    el('rect', { x: 27, y: -9, width: 12, height: 9, fill: dark }),
    el('rect', { x: -49, y: -79, width: 98, height: 6.5, fill: body }),
    el('rect', { x: -3.3, y: -93, width: 6.6, height: 15, fill: body }),
    el('rect', { x: -53, y: -98, width: 106, height: 7, fill: body }),
    el('path', { d: 'M-62 -112 Q0 -101 62 -112 L60 -103 Q0 -94 -60 -103 Z', fill: body }),
    el('path', { d: 'M-64 -116 Q0 -104.5 64 -116 L62 -111 Q0 -100.5 -62 -111 Z', fill: dark }),
  ];
}

/** 鳥居 Torii — a vermilion tunnel receding to the light, or a great gate standing in the sea. */
export function torii(ctx) {
  const { rng, pal, id } = ctx;
  const defs = [];
  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const dark = pal.dark ? pal.tint(pal.ink, 0.25) : pal.ink;

  if (rng.chance(0.62)) {
    // Senbon torii: gates receding up a hillside path toward the light.
    const side = rng.pick([-1, 0, 1]);
    const vx = W / 2 + side * rng.range(46, 78) + rng.range(-12, 12);
    const vy = rng.range(188, 228);
    const s0 = rng.range(2.2, 3.3);
    const cx0 = W / 2 - side * rng.range(18, 50);
    const by0 = rng.range(392, 446);
    const k = rng.range(0.6, 0.74);
    const n = rng.int(6, 9);
    const glow = pal.tint(pal.accent, 0.22);
    const light = pal.dark ? pal.tint(pal.ink, 0.85) : pal.paper;

    layers.push(
      el('path', { d: ridgePath(rng, { y: vy - rng.range(8, 30), amp: 18, step: rng.pick([60, 80]) }), fill: pal.tint(pal.accent2, 0.16) }),
      el('path', { d: `M${r1(vx)} ${r1(vy)} L${r1(cx0 + 150)} ${H + 10} L${r1(cx0 - 150)} ${H + 10} Z`, fill: pal.tint(pal.ink, 0.08) }),
      // The light at the end of the path.
      g({ anim: 'pulse', vars: { '--to': 0.55, '--dur': '5s' } }, [
        el('circle', { cx: r1(vx), cy: r1(vy - 12), r: 58, fill: glow, opacity: 0.55 }),
        el('circle', { cx: r1(vx), cy: r1(vy - 12), r: 32, fill: glow }),
        el('circle', { cx: r1(vx), cy: r1(vy - 12), r: 14, fill: light }),
      ]),
    );

    const gates = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const f = k ** i;
      const depth = 1 - f;
      const cx = vx + (cx0 - vx) * f;
      const by = vy + (by0 - vy) * f;
      const scale = r1(s0 * f * 100) / 100;
      const colours = { body: pal.tint(pal.accent, 1 - depth * 0.7), dark: pal.tint(dark, 1 - depth * 0.7) };
      gates.push(
        el('rect', { x: -70, y: -1, width: 140, height: 1.6, fill: pal.ink, opacity: 0.22, transform: `translate(${r1(cx)} ${r1(by)}) scale(${scale})` }),
        g({ transform: `translate(${r1(cx)} ${r1(by)}) scale(${scale})` }, gate(colours)),
      );
    }
    const front = gates.pop();
    layers.push(
      g({ anim: 'breathe', vars: { '--ox': `${r1(vx)}px`, '--oy': `${r1(vy)}px`, '--s': 1.03, '--dur': '9s' } }, [
        ...gates,
        misregister(ctx, front, { color: pal.accent2, opacity: 0.55 }),
      ]),
    );
  } else {
    // A single great gate standing in the sea, as at Itsukushima.
    const horizon = rng.range(246, 282);
    const s = rng.range(1.45, 1.8);
    const cx = W / 2 + rng.range(-26, 26);
    const by = horizon + rng.range(52, 80);
    defs.push(el('clipPath', { id: id('sea') }, [el('rect', { x: 0, y: horizon, width: W, height: H - horizon })]));
    const sun = el('circle', { cx: r1(cx + rng.range(-70, 70)), cy: r1(rng.range(92, 150)), r: r1(rng.range(28, 44)), fill: pal.tint(pal.accent, 0.5) });
    const isle = ridgePath(rng, { y: horizon - rng.range(18, 34), amp: 16, step: rng.pick([60, 75]), bottom: horizon + 1 });
    const theGate = g({ transform: `translate(${r1(cx)} ${r1(by)}) scale(${r1(s * 100) / 100})` }, gate({ body: pal.accent, dark }));
    const ripples = Array.from({ length: 12 }, (_, i) =>
      el('rect', { x: r1(rng.range(-30, 220)), y: r1(by + 4 + i * 7), width: r1(rng.range(40, 140)), height: 1.3, fill: pal.paper, opacity: 0.75 }),
    );
    layers.push(
      g({ anim: 'float', vars: { '--dy': '-6px', '--dur': '11s' } }, [sun]),
      el('path', { d: isle, fill: pal.tint(pal.accent2, 0.42) }),
      el('rect', { x: 0, y: r1(horizon), width: W, height: r1(H - horizon), fill: pal.tint(pal.accent2, 0.26) }),
      g({ clipPath: `url(#${id('sea')})` }, [
        g({ transform: `translate(${r1(cx)} ${r1(by)}) scale(${r1(s * 100) / 100} ${r1(-s * 100) / 100})`, opacity: 0.32 }, gate({ body: pal.accent, dark })),
        g({ anim: 'drift', vars: { '--dx': '14px', '--dur': '8s' } }, ripples),
      ]),
      el('rect', { x: 0, y: r1(horizon), width: W, height: 1, fill: pal.ink, opacity: 0.45 }),
      misregister(ctx, theGate, { color: pal.accent2, opacity: 0.55 }),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['top', 'left', 'right']), opacity: 0.13 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
