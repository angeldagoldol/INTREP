import { useId } from 'react';
import styles from './PanelSection.module.css';

/**
 * A titled group inside a Studio panel: mono label, Japanese gloss and an
 * optional right-hand note, over a hairline.
 *   <PanelSection title="Palette" jp="配色" note="Shu & Kinari">…</PanelSection>
 */
export function PanelSection({ title, jp, note, children }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <header className={styles.head}>
        <h3 id={id} className={styles.title}>
          {title}
          {jp && (
            <span lang="ja" className={styles.jp}>
              {jp}
            </span>
          )}
        </h3>
        {note && <span className={styles.note}>{note}</span>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
