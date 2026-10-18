import { Link } from 'react-router-dom';
import { CoverArt } from '../../../components/brochure/CoverArt.jsx';
import { Photo } from '../../../components/photo/Photo.jsx';
import { Hanko } from '../../../components/ui/index.js';
import { resumePath } from '../../../lib/progress.js';
import styles from './Spine.module.css';

/**
 * A brochure seen from its spine, standing on a shelf: a slice of the cover
 * photograph (the cover art until it is downloaded), the Japanese and
 * English titles set vertically, a seal at the foot.
 * Height and thickness follow the page count, so the shelf looks lived-in.
 * `page`: where the visitor left off; the link reopens the brochure there.
 */
export function Spine({ brochure, page = 0 }) {
  const theme = brochure.theme ?? {};
  const pages = Array.isArray(brochure.pages) ? brochure.pages.length : 6;
  const titleJp = String(brochure.titleJp ?? '').trim() || '旅';
  const title = String(brochure.title ?? '').trim() || 'Untitled brochure';
  const seal = Array.from(titleJp.replace(/[・\s]/g, '') || '旅')[0];
  const cover = brochure.cover ?? {};
  const photo = typeof cover.photo === 'string' ? cover.photo.trim() : '';
  const art = <CoverArt style={cover.art} seed={cover.seed} theme={theme} />;

  return (
    <Link
      to={resumePath(brochure, page)}
      className={styles.spine}
      style={{
        '--b-paper': theme.paper || 'var(--page-paper)',
        '--b-ink': theme.ink || 'var(--wa-sumi)',
        '--b-accent': theme.accent || 'var(--wa-shu)',
        '--h': `${17 + (pages % 5) * 0.5}rem`,
        '--w': `${3.3 + Math.min(pages, 14) * 0.04}rem`,
      }}
    >
      <span className={styles.art} aria-hidden="true">
        {photo ? <Photo id={photo} brochure={brochure} alt="" sizes="64px" credit="none" fallback={art} /> : art}
      </span>
      <span className={styles.titles}>
        <span lang="ja" className={styles.jp}>
          {titleJp}
        </span>
        <span className={styles.en}>{title}</span>
      </span>
      <Hanko text={seal} size={22} className={styles.seal} />
      <span className="sr-only"> — continue reading{page > 0 ? ` at page ${page + 1}` : ''}</span>
    </Link>
  );
}
