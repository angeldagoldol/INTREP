import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { PrintPages, TripPlanner } from '../../components/viewer/index.js';
import { Button } from '../../components/ui/index.js';
import { useRequestLivePhotos } from '../../components/photo/useLivePhotos.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useFullBrochure } from '../../hooks/useFullBrochure.js';
import { photoIdsIn } from '../../data/photos/index.js';
import { AboutBrochure } from './AboutBrochure.jsx';
import { findBySlug } from './findBySlug.js';
import { MoreLikeThis } from './MoreLikeThis.jsx';
import { Reader } from './Reader.jsx';
import { ViewerNotFound } from './ViewerNotFound.jsx';
import styles from './Viewer.module.css';

/**
 * One brochure: the reader, its story (with sources and photo credits),
 * related reading and the private trip planner. Memoised so router-visible ?p= changes (links, back/forward) only
 * re-render the reader, which reads ?p= itself. Page turns never reach the
 * router: they rewrite the URL with history.replaceState.
 */
const BrochureViewer = memo(function BrochureViewer({ brochure }) {
  const [planOpen, setPlanOpen] = useState(false);
  const readerRef = useRef(null);
  const openPlan = useCallback(() => setPlanOpen(true), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  // Every photo the brochure shows goes to Wikimedia Commons in one batch (the pages ask only for what they draw).
  const photoIds = useMemo(() => photoIdsIn(brochure), [brochure]);
  useRequestLivePhotos(photoIds);

  return (
    <div className={styles.viewer}>
      <div ref={readerRef}>
        <Reader brochure={brochure} onPlan={openPlan} planOpen={planOpen} />
      </div>
      <div data-print="hide">
        <AboutBrochure brochure={brochure} onPlan={openPlan} />
        <MoreLikeThis brochure={brochure} />
        <div className={styles.end}>
          <span lang="ja" className={styles.endMark} aria-hidden="true">
            終
          </span>
          <Button
            variant="ghost"
            iconLeft={<ArrowUp />}
            onClick={() => readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Back to the book
          </Button>
        </div>
      </div>
      <TripPlanner open={planOpen} onClose={closePlan} brochure={brochure} />
      <PrintPages brochure={brochure} />
    </div>
  );
});

/**
 * Route #/brochures/:slug — reads a brochure in the flipbook (page in ?p=).
 * Marks it as recently viewed; unknown slugs get a friendly not-found page.
 * A slug typed in another letter case still opens the brochure, and the
 * address bar is corrected to the real slug (no route transition).
 */
export default function Viewer() {
  const { slug = '' } = useParams();
  const { brochures, markViewed } = useBrochures();
  const navigate = useNavigate();
  const { search } = useLocation();
  const brochure = findBySlug(brochures, slug);
  const id = brochure?.id;
  const canonical = brochure && brochure.slug !== slug ? brochure.slug : null;
  useDocumentTitle(brochure ? brochure.title || 'Untitled brochure' : 'Brochure not found');

  useEffect(() => {
    if (id) markViewed(id);
  }, [id, markViewed]);

  useEffect(() => {
    if (!canonical) return;
    // ?p= as the reader last wrote it (turns use replaceState, which the router does not see).
    const at = window.location.hash.indexOf('?');
    const current = at === -1 ? search : window.location.hash.slice(at);
    navigate(`/brochures/${encodeURIComponent(canonical)}${current}`, { replace: true, state: { shellTransition: false } });
  }, [canonical, navigate, search]);

  if (!brochure) return <ViewerNotFound slug={slug} />;
  return <FullBrochureViewer key={brochure.id} brochure={brochure} />;
}

/** Waits (suspends) for a built-in's pages, then shows the viewer. */
function FullBrochureViewer({ brochure }) {
  return <BrochureViewer brochure={useFullBrochure(brochure)} />;
}
