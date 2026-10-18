import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, linePath, polar, pts, r1 } from '../svg.js';

/** Stepped mist band (suyari-gasumi): overlapping capsules of one colour. */
function band(rng, { y, color }) {
  const h = rng.range(15, 26);
  const length = rng.range(150, 290);
  const x = rng.chance() ? rng.range(-60, 20) : rng.range(W - length - 20, W - length + 60);
  const parts = [el('rect', { x: r1(x), y: r1(y), width: r1(length), height: r1(h), rx: r1(h / 2) })];
  for (let i = rng.int(1, 2); i > 0; i -= 1) {
    const w = length * rng.range(0.3, 0.55);
    parts.push(el('rect', { x: r1(x + rng.range(0.1, 0.6) * length), y: r1(y - h * rng.range(0.35, 0.6)), width: r1(w), height: r1(h), rx: r1(h / 2) }));
  }
  return g({ fill: color }, parts);
}

/** Archimedean curl from the centre outward. */
function spiral(cx, cy, radius, turns, start) {
  const steps = 22;
  return linePath(
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      return polar(cx, cy, radius * t, start + t * turns * Math.PI * 2);
    }),
  );
}

/** Auspicious cloud (瑞雲): puffs with a single outline and curled hearts. */
function cloud(rng, { x, y, s, fill, line }) {
  const puffs = [[-1.55, 0.25, 0.7], [-0.6, -0.35, 1], [0.55, -0.12, 0.86], [1.45, 0.3, 0.6]].map(([dx, dy, r]) => [x + dx * 15 * s, y + dy * 15 * s, r * 15 * s]);
  const width = r1(1.5 * s);
  return g({}, [
    // Outlines first, fills on top: the union reads as one cloud.
    ...puffs.map(([cx, cy, r]) => el('circle', { cx: r1(cx), cy: r1(cy), r: r1(r + width / 2), fill: line })),
    ...puffs.map(([cx, cy, r]) => el('circle', { cx: r1(cx), cy: r1(cy), r: r1(r - width / 2), fill })),
    ...puffs.map(([cx, cy, r]) =>
      el('path', { d: spiral(cx, cy, r * 0.62, 1.4, rng.range(0, Math.PI * 2)), fill: 'none', stroke: line, strokeWidth: width, strokeLinecap: 'round' }),
    ),
  ]);
}

/** 雲 Kumo — layered mist bands and scrolling clouds, sometimes a sea of clouds with peaks. */
export function kumo(ctx) {
  const { rng, pal, id } = ctx;
  const sky = id('sky');
  const defs = [
    el('linearGradient', { id: sky, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      el('stop', { offset: 0, stopColor: pal.tint(pal.accent2, pal.dark ? 0.34 : 0.26) }),
      el('stop', { offset: 0.85, stopColor: pal.paper }),
    ]),
  ];
  const layers = [el('rect', { width: W, height: H, fill: `url(#${sky})` })];

  // A vermilion sun, or a pale moon behind the mist.
  const moon = rng.chance(0.4);
  const sr = rng.range(40, 66);
  const disc = moon ? (pal.dark ? pal.tint(pal.ink, 0.85) : pal.paper) : pal.accent;
  const sun = el('circle', { cx: r1(rng.range(70, 230)), cy: r1(rng.range(120, 200)), r: r1(sr), fill: disc });
  layers.push(
    g({ anim: 'float', vars: { '--dy': '-5px', '--dur': '12s' } }, [
      moon ? misregister(ctx, sun, { color: pal.accent2, opacity: 0.4, dx: 3, dy: 2 }) : misregister(ctx, sun, { color: pal.accent2 }),
    ]),
  );

  if (rng.chance(0.4)) {
    // Unkai: peaks rising above a sea of clouds.
    const peaks = Array.from({ length: rng.int(2, 3) }, (_, i) => {
      const px = rng.range(30, 270);
      const top = rng.range(190, 240);
      const half = rng.range(70, 120);
      const fill = pal.tint(pal.accent2, 0.55 + i * 0.18);
      return el('polygon', { points: pts([[px - half, 330], [px - half * 0.22, top + 12], [px, top], [px + half * 0.3, top + 16], [px + half, 330]]), fill });
    });
    layers.push(...peaks);
  }

  const tones = [pal.accent2, pal.tint(pal.accent2, 0.55), pal.tint(pal.accent, 0.35), pal.paper];
  const count = rng.int(4, 6);
  for (let i = 0; i < count; i += 1) {
    const y = 236 + i * ((H - 230) / count) + rng.range(-8, 8);
    layers.push(
      g({ anim: 'drift', vars: { '--dx': `${r1(rng.range(10, 24) * (i % 2 ? -1 : 1))}px`, '--dur': `${r1(rng.range(16, 30))}s` } }, [
        band(rng, { y, color: tones[(i + rng.int(0, 3)) % tones.length] }),
      ]),
    );
  }

  const line = pal.dark ? pal.ink : pal.tint(pal.ink, 0.9);
  const cloudFill = pal.dark ? pal.tint(pal.accent2, 0.22) : pal.paper;
  for (let i = rng.int(1, 2); i > 0; i -= 1) {
    const top = i % 2 === 0;
    layers.push(
      g({ anim: 'float', vars: { '--dy': `${r1(rng.range(-8, -4))}px`, '--dur': `${r1(rng.range(7, 11))}s`, '--delay': `${r1(-rng.range(0, 6))}s` } }, [
        cloud(rng, { x: rng.range(70, 230), y: top ? rng.range(84, 130) : rng.range(250, 330), s: rng.range(1.25, 1.8), fill: cloudFill, line }),
      ]),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['bottom', 'right', 'topLeft']), opacity: 0.12 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
