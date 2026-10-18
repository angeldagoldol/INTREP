import { memo } from 'react';
import { BrochurePage } from '../brochure/index.js';
import { BLANK } from './spreads.js';
import styles from './MiniPage.module.css';

/**
 * A small, static rendering of one face for thumbnails and previews:
 * the page itself, a tinted endpaper for BLANK, nothing for null.
 * Decorative — the surrounding control carries the accessible name.
 * `facing`: drawn beside its facing page (a spread thumbnail), so a
 * double-page photo spread shows its halves.
 */
export const MiniPage = memo(function MiniPage({ brochure, face, className, facing = false }) {
  if (face === null || face === undefined) return null;
  const pages = brochure.pages ?? [];
  return (
    <span className={`${styles.mini} ${className ?? ''}`} aria-hidden="true">
      {face === BLANK ? (
        <span className={styles.blank} style={{ '--b-paper': brochure.theme?.paper, '--b-accent': brochure.theme?.accent }} />
      ) : (
        <BrochurePage brochure={brochure} page={pages[face]} index={face} total={pages.length} isStatic facing={facing} />
      )}
    </span>
  );
});
