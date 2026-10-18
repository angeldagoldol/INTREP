import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, r1, ridgePath, sampleCubic } from '../svg.js';

/** One notched cherry petal pointing up from the origin (~11 units long). */
const PETAL = 'M0 0 C-5.8 -2.2 -7.6 -8.6 -3.8 -11.3 Q-1.7 -12.2 0 -10.2 Q1.7 -12.2 3.8 -11.3 C7.6 -8.6 5.8 -2.2 0 0 Z';

/**
 * A brush stroke along a cubic curve: consecutive round-capped segments that
 * thin out toward the tip.
 */
function brush(points, from, to, color) {
  return points.slice(1).map((p, i) => {
    const t = i / (points.length - 1);
    const q = points[i];
    return el('line', { x1: r1(q[0]), y1: r1(q[1]), x2: r1(p[0]), y2: r1(p[1]), stroke: color, strokeWidth: r1(from + (to - from) * t), strokeLinecap: 'round' });
  });
}

/** 桜 Sakura — a blossoming branch, falling petals and a pale moon. */
export function sakura(ctx) {
  const { rng, pal, id } = ctx;
  const blossom = id('blossom');
  const petal = id('petal');
  const heart = pal.dark ? pal.paper : pal.ink;
  const defs = [
    el('g', { id: blossom }, [
      ...Array.from({ length: 5 }, (_, i) => el('path', { d: PETAL, transform: `rotate(${i * 72})` })),
      el('circle', { r: 2.4, fill: pal.accent2 }),
      el('circle', { r: 0.9, fill: heart }),
    ]),
    el('path', { id: petal, d: PETAL, transform: 'translate(0 5)' }),
  ];

  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mr = rng.range(70, 108);
  const moon = el('circle', { cx: r1(rng.range(90, 210)), cy: r1(rng.range(150, 250)), r: r1(mr), fill: pal.tint(pal.accent2, pal.dark ? 0.3 : 0.18) });
  layers.push(g({ anim: 'float', vars: { '--dy': '-6px', '--dur': '12s' } }, [moon]));
  if (rng.chance(0.45)) {
    layers.push(
      el('path', { d: ridgePath(rng, { y: 352, amp: 26, step: 70 }), fill: pal.tint(pal.accent2, 0.3) }),
      el('path', { d: ridgePath(rng, { y: 384, amp: 16, step: 50 }), fill: pal.tint(pal.accent2, 0.5) }),
    );
  }

  // Main branch enters from one side and arcs across the upper half.
  const left = rng.chance();
  const dir = left ? 1 : -1;
  const x0 = left ? -12 : W + 12;
  const y0 = rng.range(70, 150);
  const end = [W / 2 + dir * rng.range(20, 80), y0 + rng.range(60, 140)];
  const branch = sampleCubic(
    [x0, y0],
    [x0 + dir * rng.range(60, 110), y0 - rng.range(10, 40)],
    [end[0] - dir * rng.range(40, 80), end[1] - rng.range(30, 70)],
    end,
    9,
  );
  const wood = pal.dark ? pal.tint(pal.ink, 0.75) : pal.ink;
  const strokes = brush(branch, rng.range(9, 12), 2, wood);
  const tips = [end];
  for (let k = 0; k < 3; k += 1) {
    const base = branch[rng.int(3, 7)];
    const tip = [base[0] + dir * rng.range(10, 60), base[1] + rng.sign() * rng.range(30, 70)];
    strokes.push(...brush(sampleCubic(base, [base[0] + dir * 10, base[1]], [tip[0], tip[1] - 10], tip, 4), 4, 1.2, wood));
    tips.push(tip);
  }
  const branchGroup = g({}, strokes);
  layers.push(misregister(ctx, branchGroup, { color: pal.accent2, opacity: 0.5, dx: 1.8, dy: 1.3 }));

  // Blossoms cluster around the tips and along the branch.
  const colours = [pal.accent, pal.tint(pal.accent, 0.55), pal.tint(pal.accent, 0.78)];
  const flowers = [];
  const anchors = [...tips, ...[3, 5, 7].map((i) => branch[i])];
  for (const [ax, ay] of anchors) {
    for (let n = rng.int(1, 3); n > 0; n -= 1) {
      const s = rng.range(0.85, 1.75);
      flowers.push(
        el('use', {
          href: `#${blossom}`,
          transform: `translate(${r1(ax + rng.range(-18, 18))} ${r1(ay + rng.range(-16, 16))}) rotate(${r1(rng.range(0, 72))}) scale(${r1(s)})`,
          fill: rng.pick(colours),
        }),
      );
    }
  }
  layers.push(g({ anim: 'breathe', vars: { '--ox': `${r1(end[0])}px`, '--oy': `${r1(end[1])}px`, '--s': 1.025, '--dur': '6s' } }, flowers));

  // Drifting petals, each with its own sway.
  const petals = Array.from({ length: rng.int(14, 22) }, () =>
    g(
      {
        anim: 'sway',
        vars: {
          '--dx': `${r1(rng.range(8, 22))}px`,
          '--dy': `${r1(rng.range(10, 26))}px`,
          '--rot': `${r1(rng.range(40, 140) * rng.sign())}deg`,
          '--dur': `${r1(rng.range(7, 13))}s`,
          '--delay': `${r1(-rng.range(0, 10))}s`,
        },
      },
      [
        el('use', {
          href: `#${petal}`,
          transform: `translate(${r1(rng.range(16, W - 16))} ${r1(rng.range(150, H - 20))}) rotate(${r1(rng.range(0, 360))}) scale(${r1(rng.range(0.7, 1.3))})`,
          fill: rng.pick(colours),
        }),
      ],
    ),
  );
  layers.push(...petals);

  const screen = halftone(ctx, { color: pal.accent, from: rng.pick(['bottom', 'bottomRight']), opacity: 0.16 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink, count: 10 }));
  return { defs, layers };
}
