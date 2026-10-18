import { ArrowUpRight } from 'lucide-react';
import { FONTS, OFL } from './creditsContent.js';
import styles from './Credits.module.css';

/**
 * The typefaces, each set in itself like a foundry specimen: a line of
 * sample text, the family name, its designers, what Tabi uses it for, and
 * links to Google Fonts (which serves it) and the Open Font License.
 */
export function TypeSpecimens() {
  return (
    <ul className={styles.specimens}>
      {FONTS.map((font) => (
        <li key={font.id} className={styles.specimen}>
          <p
            className={styles.specimenSample}
            lang={font.lang}
            style={{ fontFamily: font.family, fontStyle: font.italic ? 'italic' : undefined }}
            data-jp={font.lang === 'ja' || undefined}
            aria-hidden="true"
          >
            {font.sample}
          </p>
          <h3 className={styles.specimenName} style={{ fontFamily: font.family }}>
            {font.name}
          </h3>
          <p className={styles.specimenBy}>
            by {font.by}
            <span className={styles.specimenRole}>{font.role}</span>
          </p>
          <p className={styles.specimenLinks}>
            <a href={font.url} target="_blank" rel="noopener noreferrer" className={styles.ext}>
              Google Fonts
              <ArrowUpRight aria-hidden="true" focusable="false" />
              <span className="sr-only"> — {font.name} (opens in a new tab)</span>
            </a>
            <a href={OFL.url} target="_blank" rel="noopener noreferrer" className={styles.ext}>
              OFL 1.1
              <ArrowUpRight aria-hidden="true" focusable="false" />
              <span className="sr-only"> — {OFL.label} (opens in a new tab)</span>
            </a>
          </p>
        </li>
      ))}
    </ul>
  );
}
