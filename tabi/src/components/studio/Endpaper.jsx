import { Hanko, VerticalText } from '../ui/index.js';
import { cn } from '../../lib/cn.js';
import { paperVars, sealText } from '../viewer/pageMeta.js';
import styles from './Endpaper.module.css';

/**
 * The blank endpaper (見返し, mikaeshi) a booklet with an odd page count
 * gets before its back cover, drawn as the reader draws it: seigaiha waves
 * in the brochure's accent around a vertical 見返し and its seal. It is not
 * a page, so it is decorative and never editable.
 *   <Endpaper brochure={shell} className={…} data-side="right" />
 */
export function Endpaper({ brochure, className, ...rest }) {
  return (
    <div className={cn(styles.endpaper, className)} style={paperVars(brochure?.theme)} aria-hidden="true" data-blank="" {...rest}>
      <span className={styles.card}>
        <VerticalText className={styles.jp}>見返し</VerticalText>
        <Hanko text={sealText(brochure)} size={34} className={styles.seal} />
      </span>
    </div>
  );
}
