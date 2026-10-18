import styles from './PageChrome.module.css';

/** Crop marks at the trim corners plus a registration target — a print proof's small print. */
export function PrintMarks({ recto }) {
  const t = 3;
  const w = 100;
  const h = 141.4;
  const ticks = [
    [t, 0, t, t - 1], [0, t, t - 1, t],
    [w - t, 0, w - t, t - 1], [w, t, w - t + 1, t],
    [t, h, t, h - t + 1], [0, h - t, t - 1, h - t],
    [w - t, h, w - t, h - t + 1], [w, h - t, w - t + 1, h - t],
  ];
  const rx = recto ? w - 1.6 : 1.6;
  const ry = h / 2;
  return (
    <svg className={styles.marks} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {ticks.map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
      <circle cx={rx} cy={ry} r={0.85} />
      <line x1={rx - 1.3} y1={ry} x2={rx + 1.3} y2={ry} />
      <line x1={rx} y1={ry - 1.3} x2={rx} y2={ry + 1.3} />
    </svg>
  );
}
