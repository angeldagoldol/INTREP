import { flecks, halftone } from '../print.js';
import { H, W, el, g, linePath, polar, r1 } from '../svg.js';

/** Brush pressure along the stroke: a loaded start, a steady body, a dry tapering tail. */
function pressure(t) {
  const attack = t < 0.06 ? 0.55 + t * 7.5 : 1;
  const release = t > 0.58 ? 1 - ((t - 0.58) / 0.42) * 0.86 : 1;
  return attack * release;
}

/** 円相 Ensō — a single zen brush circle with dry-brush streaks, a wash moon and a seal. */
export function enso(ctx) {
  const { rng, pal } = ctx;
  const ink = pal.ink;
  const R = rng.range(84, 106);
  const cx = r1(W / 2 + rng.range(-18, 18));
  const cy = r1(rng.range(190, 222));
  const start = rng.range(0, Math.PI * 2);
  const sweep = rng.range(5.15, 5.85);
  const base = rng.range(13, 20);
  const spiral = rng.range(-7, 7);
  const phase = rng.range(0, Math.PI * 2);

  // Outer and inner edges of the stroke, sampled along its length.
  const N = 64;
  const outer = [];
  const inner = [];
  const centre = [];
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const angle = start + sweep * t;
    const radius = R + Math.sin(t * Math.PI * 2 + phase) * 2.6 + spiral * t;
    const width = base * pressure(t) * (1 + Math.sin(t * 23 + phase) * 0.06);
    outer.push(polar(cx, cy, radius + width / 2, angle));
    inner.push(polar(cx, cy, radius - width / 2, angle));
    centre.push({ angle, radius, width });
  }
  const stroke = el('path', { d: `${linePath(outer)} ${linePath(inner.reverse()).replace('M', 'L')} Z`, fill: ink });

  // Kasure: paper-coloured streaks where the brush runs dry.
  const streaks = Array.from({ length: rng.int(7, 11) }, () => {
    const from = Math.floor(N * rng.range(0.42, 0.7));
    const to = Math.floor(N * rng.range(0.84, 1));
    const offset = rng.range(-0.38, 0.38);
    const path = centre.slice(from, to).map(({ angle, radius, width }) => polar(cx, cy, radius + width * offset, angle));
    return el('path', {
      d: linePath(path),
      fill: 'none',
      stroke: pal.paper,
      strokeWidth: r1(rng.range(0.6, 1.9)),
      strokeLinecap: 'round',
      strokeDasharray: `${r1(rng.range(6, 30))} ${r1(rng.range(2, 9))} ${r1(rng.range(3, 16))} ${r1(rng.range(2, 6))}`,
    });
  });

  const [hx, hy] = polar(cx, cy, R, start);
  const splatter = Array.from({ length: rng.int(3, 6) }, () =>
    el('circle', { cx: r1(hx + rng.range(-22, 22)), cy: r1(hy + rng.range(-22, 22)), r: r1(rng.range(0.6, 2.2)), fill: ink }),
  );

  const wash = el('circle', {
    cx: r1(cx + rng.range(-30, 30)),
    cy: r1(cy + rng.range(-30, 30)),
    r: r1(R * rng.range(0.55, 0.8)),
    fill: rng.chance(0.5) ? pal.accent2 : pal.accent,
    opacity: pal.dark ? 0.3 : 0.16,
  });

  // A hanko-style seal: a vermilion square with 旅 ("journey") carved in paper.
  const size = r1(rng.range(17, 23));
  const side = rng.sign();
  const sx = r1(Math.min(W - 40, Math.max(20, cx + side * R * rng.range(0.55, 0.95) - (side < 0 ? size : 0))));
  const sy = r1(Math.min(352, cy + R * rng.range(0.95, 1.25)));
  const seal = g({ transform: `translate(${sx} ${sy}) rotate(${r1(rng.range(-6, 6))})` }, [
    el('rect', { width: size, height: size, rx: 1.5, fill: pal.accent }),
    el('rect', { x: 1.6, y: 1.6, width: r1(size - 3.2), height: r1(size - 3.2), rx: 1, fill: 'none', stroke: pal.paper, strokeWidth: 0.7 }),
    el('text', {
      x: r1(size / 2),
      y: r1(size / 2),
      textAnchor: 'middle',
      dominantBaseline: 'central',
      fontSize: r1(size * 0.64),
      fill: pal.paper,
      style: { fontFamily: 'var(--font-jp)', fontWeight: 700 },
      children: '旅',
    }),
  ]);

  const layers = [
    el('rect', { width: W, height: H, fill: pal.paper }),
    g({ anim: 'drift', vars: { '--dx': '10px', '--dy': '-8px', '--dur': '14s' } }, [wash]),
    g({ anim: 'breathe', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--s': 1.018, '--dur': '8s' } }, [stroke, ...streaks, ...splatter]),
    el('rect', { x: r1(cx - R - 40), y: r1(cy + R + 46), width: r1(2 * R + 80), height: 0.8, fill: ink, opacity: 0.25 }),
    seal,
  ];

  const screen = halftone(ctx, { color: ink, from: rng.pick(['bottom', 'left', 'topLeft']), opacity: 0.1, reach: 0.5 });
  layers.push(screen.layer, flecks(ctx, { color: ink, count: 18 }));
  return { defs: screen.defs, layers };
}
