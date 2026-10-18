import { useBrochures } from '../../context/BrochureContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRequestLivePhotos } from '../../components/photo/useLivePhotos.js';
import { listPhotos } from '../../data/photos/index.js';
import { homePhotoIds } from './homeContent.js';
import { useMotionPaused } from './homeMotion.js';
import { CtaBand } from './sections/CtaBand.jsx';
import { Featured } from './sections/Featured.jsx';
import { Haiku } from './sections/Haiku.jsx';
import { Hero } from './sections/Hero.jsx';
import { HowItWorks } from './sections/HowItWorks.jsx';
import { Nostalgic } from './sections/Nostalgic.jsx';
import { Numbers } from './sections/Numbers.jsx';
import { Regions } from './sections/Regions.jsx';
import { Seasons } from './sections/Seasons.jsx';
import { WordMarquee } from './sections/WordMarquee.jsx';
import styles from './Home.module.css';

/**
 * Home — the magazine cover of Tabi, then a tour of what is inside:
 * 01 hero · 02 words · 03 Nostalgic Japan (懐かしい日本, a photo mosaic) ·
 * 04 featured · 05 seasons · 06 regions (a photo per region) ·
 * 07 how it works · 08 numbers · 09 haiku · 10 studio.
 * Real places, photographs (data/photos manifests `home.json` and the
 * Nostalgic Japan brochure's `nostalgic-…` photos) and facts
 * (docs/research/home.md) throughout; nothing on the page is invented.
 *
 * `data-motion="paused"` (the hero's "Pause motion" control, homeMotion.js)
 * lets the sections' CSS loops hold still via `:global([data-motion='paused'])`.
 */
/** Every photograph the page shows: asked for together, so the live ones arrive in one batch. */
const HOME_PHOTO_IDS = homePhotoIds(listPhotos());

export default function Home() {
  useDocumentTitle(null);
  useRequestLivePhotos(HOME_PHOTO_IDS);
  const { brochures } = useBrochures();
  const motionPaused = useMotionPaused();

  return (
    <div className={styles.home} data-motion={motionPaused ? 'paused' : undefined}>
      <Hero brochureCount={brochures.length} />
      <WordMarquee />
      <Nostalgic />
      <Featured />
      <Seasons />
      <Regions />
      <HowItWorks />
      <Numbers />
      <Haiku />
      <CtaBand />
    </div>
  );
}
