import { memo, useEffect, useRef } from 'react';
import { MiniPage } from './MiniPage.jsx';
import { spreadLabel, spreadName } from './spreads.js';
import styles from './ThumbRail.module.css';

const Thumb = memo(function Thumb({ brochure, spread, double, current, previewed, onSelect }) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.thumb}
        aria-current={current || undefined}
        data-preview={previewed || undefined}
        aria-label={`Go to ${spreadName(spread).toLowerCase()}`}
        onClick={() => onSelect(spread.index)}
      >
        <span
          className={styles.pages}
          data-lone-left={(double && spread.left === null) || undefined}
          data-lone-right={(double && spread.right === null) || undefined}
        >
          <MiniPage brochure={brochure} face={spread.left} facing={double} />
          <MiniPage brochure={brochure} face={spread.right} facing={double} />
        </span>
        <span className={styles.label} aria-hidden="true">
          {spreadLabel(spread)}
        </span>
        <span className={styles.marker} aria-hidden="true" />
      </button>
    </li>
  );
});

/**
 * Strip of spread thumbnails under the book. The current spread is
 * highlighted and kept centred in the strip as the reader turns pages.
 * Props: brochure, book, position, onSelect(position), smooth (scroll
 * behaviour); preview (a spread index or null) marks the spread the reader
 * is pointing at on the scrubber and brings it into view.
 */
export function ThumbRail({ brochure, book, position, onSelect, smooth = true, preview = null }) {
  const listRef = useRef(null);
  const focus = preview ?? position;

  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[focus];
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    const left = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }, [focus, smooth, book]);

  return (
    <nav className={styles.rail} aria-label="Page thumbnails">
      <ol ref={listRef} className={styles.list}>
        {book.spreads.map((spread) => (
          <Thumb
            key={spread.index}
            brochure={brochure}
            spread={spread}
            double={book.mode === 'double'}
            current={spread.index === position}
            previewed={spread.index === preview && preview !== position}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </nav>
  );
}
