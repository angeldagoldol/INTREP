import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, pts, r1, ridgePath } from '../svg.js';

/** Concave volcano silhouette with a notched crater, peak at (px, py). */
function fujiPath(px, py, bw, baseY) {
  const rise = baseY - py;
  const cw = 13;
  return [
    `M${r1(px - bw)} ${r1(baseY)}`,
    `C${r1(px - bw * 0.42)} ${r1(baseY - rise * 0.16)} ${r1(px - cw * 2.4)} ${r1(py + rise * 0.34)} ${r1(px - cw)} ${r1(py)}`,
    `L${r1(px - cw * 0.45)} ${r1(py + 2.6)} L${r1(px)} ${r1(py + 0.8)} L${r1(px + cw * 0.5)} ${r1(py + 2.8)} L${r1(px + cw)} ${r1(py)}`,
    `C${r1(px + cw * 2.4)} ${r1(py + rise * 0.34)} ${r1(px + bw * 0.42)} ${r1(baseY - rise * 0.16)} ${r1(px + bw)} ${r1(baseY)} Z`,
  ].join(' ');
}

/** Snow cap: a block above the snow line with tongues of snow running down the gullies. */
function snowPoints(rng, px, py, line) {
  const points = [[px - 140, py - 20], [px + 140, py - 20], [px + 140, line]];
  for (let x = px + 140; x > px - 140; x -= rng.range(7, 12)) {
    const tongue = rng.chance(0.3) ? rng.range(10, 22) : rng.range(-4, 6);
    points.push([x, line + tongue]);
  }
  points.push([px - 140, line]);
  return points;
}

/** Soft mist band (suyari-gasumi). */
function mist(rng, y, color) {
  const w = rng.range(110, 190);
  return el('rect', { x: r1(rng.range(-40, W - w + 40)), y: r1(y), width: r1(w), height: r1(rng.range(8, 13)), rx: 6, fill: color, opacity: 0.88 });
}

/** 富士 Fuji — a snow-capped Fuji over layered ridges or a mirror lake, with sun or moon. */
export function fuji(ctx) {
  const { rng, pal, id } = ctx;
  const red = rng.chance(0.3); // Akafuji: the red Fuji of late-summer dawns
  const body = red ? pal.accent : pal.accent2;
  const snow = pal.dark ? pal.ink : pal.paper;
  const sky = id('sky');
  const defs = [
    el('linearGradient', { id: sky, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      el('stop', { offset: 0, stopColor: pal.tint(pal.accent2, pal.dark ? 0.32 : 0.24) }),
      el('stop', { offset: 0.75, stopColor: pal.tint(pal.accent, 0.1) }),
    ]),
  ];

  const px = rng.range(118, 182);
  const py = rng.range(138, 172);
  const baseY = 336;
  const bw = rng.range(160, 215);
  const mountain = fujiPath(px, py, bw, baseY);
  defs.push(el('clipPath', { id: id('peak') }, [el('path', { d: mountain })]));

  const moon = !red && rng.chance(0.4);
  const cr = rng.range(17, 30);
  const cx = r1(Math.min(250, Math.max(50, px + rng.sign() * rng.range(60, 105))));
  const orb = el('circle', { cx, cy: r1(rng.range(84, 128)), r: r1(cr), fill: moon ? snow : red ? pal.accent2 : pal.accent });

  const fujiShape = el('path', { d: mountain, fill: body });
  const layers = [
    el('rect', { width: W, height: H, fill: `url(#${sky})` }),
    g({ anim: 'float', vars: { '--dy': '-5px', '--dur': '10s' } }, [orb]),
    misregister(ctx, fujiShape, { color: red ? pal.accent2 : pal.accent, opacity: 0.5, dx: 3, dy: 1.5 }),
    g({ clipPath: `url(#${id('peak')})` }, [
      el('polygon', { points: pts(snowPoints(rng, px, py, py + (baseY - py) * rng.range(0.24, 0.34))), fill: snow }),
    ]),
  ];

  const deep = pal.dark ? pal.tint(pal.accent2, 0.55) : pal.tint(pal.ink, 0.82);
  if (rng.chance(0.38)) {
    // Mirror lake (Kawaguchiko): reflection broken by ripples.
    const shore = baseY - 2;
    defs.push(el('clipPath', { id: id('lake') }, [el('rect', { x: 0, y: shore, width: W, height: H - shore })]));
    const ripples = Array.from({ length: 9 }, (_, i) =>
      el('rect', { x: r1(rng.range(-20, 200)), y: r1(shore + 10 + i * 9), width: r1(rng.range(60, 160)), height: 1.4, fill: pal.paper, opacity: 0.7 }),
    );
    layers.push(
      el('rect', { x: 0, y: shore, width: W, height: H - shore, fill: pal.tint(pal.accent2, 0.3) }),
      g({ clipPath: `url(#${id('lake')})` }, [
        g({ transform: `translate(0 ${r1(shore * 2)}) scale(1 -1)`, opacity: 0.35 }, [el('path', { d: mountain, fill: body })]),
        g({ anim: 'drift', vars: { '--dx': '16px', '--dur': '9s' } }, ripples),
      ]),
      el('path', { d: ridgePath(rng, { y: H - 26, amp: 14, step: 60 }), fill: deep }),
    );
  } else {
    const n = rng.int(3, 4);
    for (let i = 0; i < n; i += 1) {
      const t = (i + 1) / n;
      layers.push(el('path', { d: ridgePath(rng, { y: 300 + i * (100 / n), amp: 22 - i * 3, step: rng.pick([40, 50, 60]) }), fill: pal.tint(deep, 0.25 + t * 0.75) }));
      if (i === 0) layers.push(g({ anim: 'drift', vars: { '--dx': '18px', '--dur': '22s' } }, [mist(rng, baseY - 34, snow), mist(rng, baseY - 12, snow)]));
    }
  }

  if (rng.chance(0.6)) {
    const bx = rng.range(40, 220);
    const by = rng.range(96, 150);
    layers.push(
      g(
        { fill: 'none', stroke: pal.ink, strokeWidth: 1.1, strokeLinecap: 'round' },
        Array.from({ length: rng.int(2, 3) }, (_, i) =>
          el('path', { d: 'M-5 0 Q-2.5 -3 0 0 Q2.5 -3 5 0', transform: `translate(${r1(bx + i * 13)} ${r1(by + rng.range(-8, 8))})` }),
        ),
      ),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['top', 'topLeft']), opacity: 0.12, reach: 0.45 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
