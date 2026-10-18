import { memo } from 'react';
import { BrochurePage } from '../brochure/index.js';
import { pad } from '../../lib/format.js';
import { pageHeading } from '../brochure/blocks/pageUtils.js';
import styles from './PageThumb.module.css';

/**
 * A static miniature of one page with its number, used in the page strip.
 * Memoised: typing on one page only redraws that page's thumbnail.
 * `partner`: the other half when the page is half of a placed photo spread
 * (the strip draws each page on its own, so a half shows as a whole page).
 */
export const PageThumb = memo(function PageThumb({ brochure, page, partner = null, index, total, selected, onSelect }) {
  return (
    <button
      type="button"
      className={styles.thumb}
      aria-current={selected ? 'page' : undefined}
      aria-label={`Page ${index + 1}: ${pageHeading(page, brochure)}`}
      onClick={() => onSelect(page.id)}
      data-thumb={page.id}
    >
      <span className={styles.sheet}>
        <BrochurePage brochure={brochure} page={page} index={index} total={total} isStatic partner={partner} />
      </span>
      <span className={styles.number} aria-hidden="true">
        {pad(index + 1)}
      </span>
    </button>
  );
});
