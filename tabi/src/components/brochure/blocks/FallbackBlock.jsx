import { isRetiredPageType } from '../../../data/sanitize.js';
import { text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './FallbackBlock.module.css';
import type from './type.module.css';

/**
 * Shown for page types this renderer does not know: a calm 空 ("empty")
 * instead of a crash. A page of a retired type (an old map page that reached
 * the renderer without going through data/sanitize.js) says what became of it.
 */
export function FallbackBlock({ page }) {
  const heading = text(page.heading) || text(page.title) || 'Untitled page';
  const kind = text(page.type);

  return (
    <div className={styles.fallback}>
      <span className={`${styles.glyph} ${type.jp}`} lang="ja" aria-hidden="true">
        空
      </span>
      <Reveal as="h2" className={`${type.heading} ${type.clamp} ${styles.heading}`} style={{ '--fs': '5.4cqw', '--lines': 3 }}>
        {heading}
      </Reveal>
      <Reveal as="p" className={styles.note}>
        {isRetiredPageType(kind)
          ? `This ${kind} page is from an earlier edition: Tabi now shows photographs of the places instead.`
          : kind
            ? `This “${kind}” page can’t be shown in this edition yet.`
            : 'This page has no content yet.'}
      </Reveal>
    </div>
  );
}
