import { text } from './pageUtils.js';
import styles from './PageChrome.module.css';

/**
 * Running header: brochure title — hairline — Japanese title. Decorative (the
 * page label carries it for AT). Always rendered, even untitled, so it holds
 * the first row of the page grid.
 */
export function RunningHead({ brochure }) {
  const title = text(brochure?.title);
  const titleJp = text(brochure?.titleJp);
  return (
    <div className={styles.head} aria-hidden="true">
      {title && <span className={styles.headTitle}>{title}</span>}
      <span className={styles.headRule} />
      {titleJp && (
        <span className={styles.headJp} lang="ja">
          {titleJp}
        </span>
      )}
    </div>
  );
}
