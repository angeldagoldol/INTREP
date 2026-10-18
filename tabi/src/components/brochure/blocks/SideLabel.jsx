import { VerticalText } from '../../ui/index.js';
import { SECTION_JP } from './pageUtils.js';
import styles from './PageChrome.module.css';

/** Vertical Japanese section name in the outer margin (縦書き). */
export function SideLabel({ type, recto }) {
  const label = SECTION_JP[type];
  if (!label) return null;
  return (
    <div className={styles.side} data-recto={recto || undefined} aria-hidden="true">
      <span className={styles.sideDot} />
      <VerticalText className={styles.sideText}>{label}</VerticalText>
    </div>
  );
}
