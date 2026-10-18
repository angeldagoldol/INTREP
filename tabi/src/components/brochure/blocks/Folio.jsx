import { SECTION_EN, folio } from './pageUtils.js';
import styles from './PageChrome.module.css';

/** Folio line: page number on the outer edge (right on recto, left on verso) and the section name. */
export function Folio({ type, number, total, recto }) {
  return (
    <div className={styles.folio} data-recto={recto || undefined} aria-hidden="true">
      <span className={styles.folioNum}>{folio(number, total)}</span>
      <span className={styles.folioLabel}>{SECTION_EN[type] ?? 'Page'}</span>
    </div>
  );
}
