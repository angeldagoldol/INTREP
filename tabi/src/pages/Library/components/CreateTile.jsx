import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { VerticalText } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import styles from './CreateTile.module.css';

/**
 * Dashed "blank brochure" tile that starts a new one in the Studio.
 * - `span` grid cells it fills (end of the library grid). From 2 it opens
 *   into a blank spread at the height of one cover (the host sets `--col`,
 *   one column's width), and from 3 the text moves beside the spread.
 */
export function CreateTile({ span = 1, className, style }) {
  const spread = span > 1;
  return (
    <Link to="/studio" className={cn(styles.tile, className)} data-span={spread ? Math.min(span, 3) : undefined} style={style}>
      <span className={styles.art}>
        {spread && (
          <span className={cn(styles.page, styles.verso)} aria-hidden="true">
            <span className={styles.folio}>00</span>
          </span>
        )}
        <span className={styles.page}>
          <span className={styles.plus} aria-hidden="true">
            <Plus />
          </span>
          <VerticalText className={styles.jp} aria-hidden="true">
            新しい旅
          </VerticalText>
        </span>
      </span>
      <span className={styles.meta}>
        <span className={styles.title}>{spread ? 'Fold your own' : 'Create new'}</span>
        <span className={styles.text}>Start blank, or remix any brochure in the Studio.</span>
      </span>
    </Link>
  );
}
