import styles from './OptionArt.module.css';

/** Two blank sheets with crop marks and a ghosted 白紙 ("blank paper"). */
export function BlankArt() {
  return (
    <div className={styles.blank}>
      <span className={styles.sheetBack} />
      <span className={styles.sheetFront}>
        <span className={styles.guides} />
        <span lang="ja" className={styles.ghost}>
          白紙
        </span>
      </span>
    </div>
  );
}
