import { memo } from 'react';
import { BrochurePage } from '../brochure/index.js';
import { Hanko, VerticalText } from '../ui/index.js';
import { sealText } from './pageMeta.js';
import { BLANK } from './spreads.js';
import styles from './Flipbook.module.css';

/**
 * Patterned endpaper (見返し, mikaeshi): the blank sheet a booklet with an
 * odd page count needs before its back cover. Seigaiha waves in the
 * brochure's own accent, with its seal.
 */
function Endpaper({ brochure }) {
  return (
    <div className={styles.endpaper} aria-hidden="true">
      <span className={styles.endpaperCard}>
        <VerticalText className={styles.endpaperJp}>見返し</VerticalText>
        <Hanko text={sealText(brochure)} size={34} className={styles.endpaperSeal} />
      </span>
    </div>
  );
}

/**
 * What is printed on one face of a leaf.
 * - `face`: page index, BLANK (endpaper) or null (plain paper).
 * - `mounted`: false renders bare paper (leaf far from the reader).
 * - `rich`: render the full page (motion-ready) rather than the cheap static
 *   one. Faces near the reader stay rich, so a turn only toggles `live`
 *   instead of remounting pages; leaves just riffling past stay static.
 * - `live`: the face is on show at the current spread: it plays its
 *   entrance and is interactive; every other face is inert and hidden from
 *   assistive tech.
 * - `facing`: the book shows two pages at a time, so a double-page photo
 *   spread draws its halves (BrochurePage `facing`).
 */
export const PageFace = memo(function PageFace({ brochure, face, mounted, rich = true, live, onCta, facing = false }) {
  if (!mounted || face === null || face === undefined) return <div className={styles.paper} aria-hidden="true" />;
  if (face === BLANK) return <Endpaper brochure={brochure} />;
  const pages = brochure.pages ?? [];
  return (
    <div className={styles.content} inert={!live} aria-hidden={live ? undefined : true}>
      <BrochurePage
        brochure={brochure}
        page={pages[face]}
        index={face}
        total={pages.length}
        active={live}
        isStatic={!rich}
        onCta={live ? onCta : undefined}
        facing={facing}
      />
    </div>
  );
});
