/** Polar → cartesian around (0, 0), rounded for compact SVG. */
function point(radius, degrees) {
  const a = (degrees * Math.PI) / 180;
  return { x: Number((Math.cos(a) * radius).toFixed(2)), y: Number((Math.sin(a) * radius).toFixed(2)) };
}

/** Polar point as an "x y" path coordinate. */
function polar(radius, degrees) {
  const { x, y } = point(radius, degrees);
  return `${x} ${y}`;
}

/** 桜 Five notched cherry petals. */
function Sakura() {
  const petal = 'M0 -6C-15 -18 -17 -40 -6 -52L0 -45 6 -52C17 -40 15 -18 0 -6Z';
  return (
    <g>
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={r} d={petal} transform={`rotate(${r})`} />
      ))}
      <circle r="6" opacity="0.5" />
      {[0, 72, 144, 216, 288].map((r) => (
        <circle key={r} r="2.2" transform={`rotate(${r + 36}) translate(0 -15)`} opacity="0.55" />
      ))}
    </g>
  );
}

/** 花火 A firework burst: rays with sparks at their tips. */
function Hanabi() {
  const rays = Array.from({ length: 28 }, (_, i) => (i * 360) / 28);
  return (
    <g strokeLinecap="round">
      {rays.map((deg, i) => {
        const inner = i % 2 ? 14 : 8;
        const outer = i % 2 ? 44 : 56;
        const spark = point(outer + 5, deg);
        return (
          <g key={deg}>
            <path d={`M${polar(inner, deg)} L${polar(outer, deg)}`} stroke="currentColor" strokeWidth="1.6" fill="none" />
            <circle cx={spark.x} cy={spark.y} r={i % 2 ? 1.6 : 2.4} />
          </g>
        );
      })}
    </g>
  );
}

/** 紅葉 A seven-lobed iroha-momiji leaf: lens-shaped lobes round a short stem. */
const MAPLE_LOBES = [
  { deg: -214, len: 26 },
  { deg: -174, len: 44 },
  { deg: -132, len: 52 },
  { deg: -90, len: 57 },
  { deg: -48, len: 52 },
  { deg: -6, len: 44 },
  { deg: 34, len: 26 },
];

function mapleLeafPath() {
  const parts = [`M${polar(9, -245)}`];
  MAPLE_LOBES.forEach((lobe, i) => {
    const next = MAPLE_LOBES[i + 1];
    parts.push(`Q${polar(lobe.len * 0.62, lobe.deg - 14)} ${polar(lobe.len, lobe.deg)}`);
    const valley = next ? polar(15, (lobe.deg + next.deg) / 2) : polar(9, 65);
    parts.push(`Q${polar(lobe.len * 0.62, lobe.deg + 14)} ${valley}`);
  });
  return `${parts.join(' ')}Z`;
}

const MAPLE = mapleLeafPath();

function Momiji() {
  return (
    <g>
      <path d={MAPLE} />
      <path d="M0 6 L5 44" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** 雪 A six-armed snow crystal. */
function Yuki() {
  return (
    <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <path d="M0 0 V-54" />
          <path d="M0 -22 L-11 -33 M0 -22 L11 -33" />
          <path d="M0 -38 L-8 -46 M0 -38 L8 -46" />
        </g>
      ))}
      <circle r="7" />
    </g>
  );
}

const MOTIFS = { spring: Sakura, summer: Hanabi, autumn: Momiji, winter: Yuki };

/**
 * Decorative season emblem drawn in `currentColor`: sakura (spring),
 * hanabi fireworks (summer), momiji maple (autumn), a snow crystal (winter).
 */
export function SeasonMotif({ season, className }) {
  const Motif = MOTIFS[season] ?? Sakura;
  return (
    <svg className={className} viewBox="-64 -64 128 128" fill="currentColor" aria-hidden="true" focusable="false">
      <Motif />
    </svg>
  );
}
