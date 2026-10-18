import { CoverArt } from '../../../components/brochure/index.js';
import styles from './OptionArt.module.css';

/** Three library covers fanned like a hand of cards. */
export function RemixArt({ brochures }) {
  return (
    <div className={styles.remix}>
      {brochures.slice(0, 3).map((b, i) => (
        <span key={b.id} className={styles.card} data-i={i}>
          <CoverArt style={b.cover?.art} seed={b.cover?.seed} theme={b.theme} />
        </span>
      ))}
    </div>
  );
}
