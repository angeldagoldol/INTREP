import { formatNumber } from '../../../lib/format.js';
import { Counter } from '../../ui/index.js';
import { usePage } from './pageContext.js';
import { fitSize, kanjiNumeral, list, text, toNumber } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './StatsBlock.module.css';
import type from './type.module.css';

/** Figures set large; they count up each time the page becomes the active page. */
export function StatsBlock({ page }) {
  const { isStatic, active } = usePage();
  const heading = text(page.heading);
  const body = text(page.body);
  const items = list(page.items, 4)
    .map((item) => ({ ...item, number: toNumber(item.value), prefix: text(item.prefix), suffix: text(item.suffix) }))
    .filter((item) => item.number !== null || text(item.label));
  const shown = items.map((item) => `${item.prefix}${item.number === null ? '—' : formatNumber(item.number)}${item.suffix}`);
  const longest = shown.reduce((a, b) => (b.length > a.length ? b : a), '');
  // The prefix (~, +, ≈…) is set small and raised, like an editor's "c.", so
  // it qualifies the figure instead of reading as a stray full-size glyph.
  const figures = items.map((item) => (item.number === null ? '—' : `${formatNumber(item.number)}${item.suffix}`));
  const size = fitSize(longest, { max: items.length > 3 ? 11 : 13, min: 6, ideal: 5 });

  return (
    <div className={styles.stats}>
      <span className={type.watermark} lang="ja" aria-hidden="true">
        数
      </span>
      <header className={type.header}>
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 6.8, min: 4.2, ideal: 26 })}cqw` }}>
            {heading}
          </Reveal>
        )}
        {body && (
          <Reveal as="p" className={type.lede}>
            {body}
          </Reveal>
        )}
      </header>

      {items.length > 0 && (
        <ul className={styles.list} style={{ '--fs': `${size}cqw` }} data-fit="">
          {items.map((item, i) => (
            <Reveal as="li" key={i} className={styles.item}>
              <span className={styles.value}>
                {item.prefix && item.number !== null && <span className={styles.affix}>{item.prefix}</span>}
                {item.number !== null && active && !isStatic ? (
                  <Counter value={item.number} suffix={item.suffix} duration={1.6} />
                ) : (
                  figures[i]
                )}
              </span>
              <span className={styles.label}>
                <span className={`${styles.index} ${type.jp}`} lang="ja" aria-hidden="true">
                  {kanjiNumeral(i + 1)}
                </span>
                <span>{text(item.label)}</span>
              </span>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
