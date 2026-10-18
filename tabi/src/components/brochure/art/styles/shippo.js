import { flecks, halftone, misregister } from '../print.js';
import { H, W, el, g, r1 } from '../svg.js';

/**
 * Shippō-tsunagi tile (2r × 2r): a grid of touching circles plus a second
 * grid offset by half a cell, so every ring overlaps four neighbours.
 */
function shippoPattern(id, r, { stroke, width, fill = 'none', fillOpacity = 1, rotate = 0 }) {
  const centres = [[0, 0], [2 * r, 0], [0, 2 * r], [2 * r, 2 * r], [r, r]];
  return el('pattern', { id, width: 2 * r, height: 2 * r, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rotate})` },
    centres.map(([cx, cy]) => el('circle', { cx, cy, r, fill, fillOpacity, stroke, strokeWidth: width })),
  );
}

/** 七宝 Shippō — interlocking rings: the seven-treasure flower, a turning medallion, or kimono stripes. */
export function shippo(ctx) {
  const { rng, pal, id } = ctx;
  const r = rng.pick([14, 16, 18, 21]);
  const field = id('field');
  const defs = [shippoPattern(field, r, { stroke: pal.ink, width: 0.7 })];
  const layers = [el('rect', { width: W, height: H, fill: pal.paper })];
  const mode = rng.pick(['seven', 'medallion', 'stripes']);

  if (mode === 'seven') {
    // Seven rings: one centre ring and six around it, each through the centre.
    const R = rng.range(44, 58);
    const cx = r1(W / 2 + rng.range(-16, 16));
    const cy = r1(rng.range(186, 230));
    const colours = [pal.accent, pal.accent2, pal.dark ? pal.ink : pal.tint(pal.ink, 0.85)];
    const sw = r1(rng.range(5, 8));
    const start = rng.range(0, Math.PI / 3);
    const rings = [el('circle', { cx, cy, r: r1(R), fill: 'none', stroke: colours[0], strokeWidth: sw })];
    for (let i = 0; i < 6; i += 1) {
      const a = start + (Math.PI / 3) * i;
      rings.push(
        el('circle', {
          cx: r1(cx + R * Math.cos(a)),
          cy: r1(cy + R * Math.sin(a)),
          r: r1(R),
          fill: 'none',
          stroke: colours[(i % 2) + (i === 5 ? 1 : 0)],
          strokeWidth: sw,
          style: { mixBlendMode: pal.blend },
        }),
      );
    }
    const flower = g({}, rings);
    layers.push(
      el('rect', { width: W, height: H, fill: `url(#${field})`, opacity: 0.22 }),
      el('circle', { cx, cy, r: r1(R * 2 + 14), fill: pal.paper }),
      el('circle', { cx, cy, r: r1(R * 2 + 14), fill: 'none', stroke: pal.ink, strokeWidth: 0.8 }),
      el('circle', { cx, cy, r: r1(R * 0.38), fill: pal.tint(pal.accent, 0.35) }),
      g({ anim: 'spin', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--dur': '120s' } }, [
        misregister(ctx, flower, { color: pal.accent2, opacity: 0.45 }),
      ]),
    );
  } else if (mode === 'medallion') {
    const R = rng.range(100, 126);
    const cx = r1(W / 2 + rng.range(-24, 24));
    const cy = r1(rng.range(180, 236));
    const tint = id('tint');
    defs.push(
      shippoPattern(tint, r * 1.4, { stroke: pal.paper, width: 1.2, fill: pal.accent, fillOpacity: 0.32, rotate: 45 }),
      el('clipPath', { id: id('disc') }, [el('circle', { cx, cy, r: r1(R) })]),
    );
    const disc = el('circle', { cx, cy, r: r1(R), fill: pal.accent2 });
    layers.push(
      el('rect', { width: W, height: H, fill: `url(#${field})`, opacity: 0.3 }),
      el('circle', { cx, cy, r: r1(R + 10), fill: pal.paper, stroke: pal.accent, strokeWidth: 1.4 }),
      disc,
      misregister(ctx, disc, { color: pal.accent }),
      g({ clipPath: `url(#${id('disc')})` }, [
        g({ anim: 'spin', vars: { '--ox': `${cx}px`, '--oy': `${cy}px`, '--dur': '150s' } }, [
          el('rect', { x: r1(cx - R * 1.5), y: r1(cy - R * 1.5), width: r1(R * 3), height: r1(R * 3), fill: `url(#${tint})` }),
        ]),
      ]),
      el('circle', { cx, cy, r: r1(R * 0.22), fill: pal.paper }),
      el('circle', { cx, cy, r: r1(R * 0.12), fill: pal.accent }),
    );
  } else {
    // Kimono stripes: patterned columns between plain ones.
    const cols = rng.int(3, 4);
    const cw = W / cols;
    const bold = id('bold');
    defs.push(shippoPattern(bold, r, { stroke: pal.paper, width: 1.4, fill: pal.accent, fillOpacity: 0.28 }));
    for (let i = 0; i < cols; i += 1) {
      const x = r1(i * cw);
      const patterned = i % 2 === 0;
      layers.push(
        el('rect', { x, y: 0, width: r1(cw + 0.5), height: H, fill: patterned ? pal.accent2 : pal.paper }),
        patterned
          ? g({ anim: 'drift', vars: { '--dx': '0px', '--dy': `${2 * r}px`, '--dur': `${r1(rng.range(14, 22))}s` } }, [
              el('rect', { x, y: -2 * r, width: r1(cw + 0.5), height: H + 4 * r, fill: `url(#${bold})` }),
            ])
          : el('rect', { x, y: 0, width: r1(cw + 0.5), height: H, fill: `url(#${field})`, opacity: 0.35 }),
      );
    }
    const R = rng.range(48, 70);
    const sun = el('circle', { cx: r1(rng.range(80, 220)), cy: r1(rng.range(130, 250)), r: r1(R), fill: pal.accent });
    layers.push(
      el('circle', { cx: sun.a.cx, cy: sun.a.cy, r: r1(R + 9), fill: pal.paper }),
      sun,
      misregister(ctx, sun, { color: pal.accent2 }),
    );
  }

  const screen = halftone(ctx, { color: pal.ink, from: rng.pick(['bottom', 'top', 'bottomRight']), opacity: 0.13 });
  defs.push(...screen.defs);
  layers.push(screen.layer, flecks(ctx, { color: pal.ink }));
  return { defs, layers };
}
