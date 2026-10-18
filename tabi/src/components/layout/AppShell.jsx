import { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_LocationContext as LocationContext, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useHotkey } from '../../hooks/useHotkey.js';
import { PaletteContext } from './palette.js';
import { isImmersivePath } from './navItems.js';
import { Navbar } from './Navbar.jsx';
import { Footer } from './Footer.jsx';
import { PageLoader } from './PageLoader.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { RoutePage } from './RouteTransition.jsx';
import { RouteErrorBoundary } from './RouteErrorBoundary.jsx';
import styles from './AppShell.module.css';

// The photo notice needs the photo registry (the cover-art chunk), so it loads late and on its own;
// a chunk that fails to load just means no notice.
const PhotoNotice = lazy(() => import('../photo/PhotoNotice.jsx').catch(() => ({ default: () => null })));
/** The notice is only about photos that failed to arrive: nothing to say in the first seconds. */
const PHOTO_NOTICE_DELAY_MS = 2500;

/**
 * Persistent chrome (navbar, footer, command palette, grain) around animated
 * route content.
 *
 * The outlet is captured per render, so AnimatePresence keeps rendering the
 * *old* page while it animates out. Routes animate when their pathname
 * changes, except "bookkeeping" URL updates that pass
 * `state: { shellTransition: false }` and keep the page mounted (the viewer
 * correcting a slug's letter case in place).
 *
 * Each page is also pinned to the location it was rendered at. React Router's
 * hooks read the *current* URL, so without the pin a page that is animating
 * out re-renders for the next URL: the Library, losing its ?q=, would remount
 * its "Your brochures" shelf mid-exit, and those freshly mounted exit-animated
 * cards kept the curtain waiting forever. The exiting element AnimatePresence
 * holds on to carries the location context it last rendered with.
 *
 * Each route renders inside its own error boundary: a page that crashes, or
 * whose chunk cannot be downloaded, shows <RouteError> while the navbar,
 * footer and palette keep working, and navigating away clears it.
 *
 * A few seconds in, the shell also mounts <PhotoNotice> (lazy), which explains
 * placeholder art when the real photographs could not load.
 */
export function AppShell() {
  const location = useLocation();
  const locationContext = useContext(LocationContext);
  const outlet = useOutlet();
  const mainRef = useRef(null);
  const immersive = isImmersivePath(location.pathname);

  // Derived during render (React's "adjust state on prop change" pattern).
  const [route, setRoute] = useState({ pathname: location.pathname, key: location.pathname });
  if (route.pathname !== location.pathname) {
    const keep = location.state?.shellTransition === false;
    setRoute({ pathname: location.pathname, key: keep ? route.key : location.pathname });
  }

  // The palette, like the mobile menu, belongs to the location it opened on.
  const [paletteAt, setPaletteAt] = useState(null);
  const paletteOpen = paletteAt !== null && paletteAt === location.key;
  const openPalette = useCallback(() => setPaletteAt(location.key), [location.key]);
  const closePalette = useCallback(() => setPaletteAt(null), []);
  const togglePalette = useCallback(
    () => setPaletteAt((at) => (at === location.key ? null : location.key)),
    [location.key],
  );
  const palette = useMemo(
    () => ({ isOpen: paletteOpen, open: openPalette, close: closePalette, toggle: togglePalette }),
    [paletteOpen, openPalette, closePalette, togglePalette],
  );

  useHotkey('mod+k', togglePalette, { allowInInputs: true });

  const [photoNotice, setPhotoNotice] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPhotoNotice(true), PHOTO_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Runs while the curtain fully covers the screen.
  const onExitComplete = () => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  };

  return (
    <PaletteContext.Provider value={palette}>
      <div className={styles.shell} data-immersive={immersive || undefined}>
        <a
          href="#main"
          className="skip-link"
          onClick={(event) => {
            event.preventDefault();
            mainRef.current?.focus();
          }}
        >
          Skip to content
        </a>
        <Navbar immersive={immersive} />
        <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
          <AnimatePresence mode="wait" initial={false} onExitComplete={onExitComplete}>
            <RoutePage key={route.key}>
              <LocationContext.Provider value={locationContext}>
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
                </RouteErrorBoundary>
              </LocationContext.Provider>
            </RoutePage>
          </AnimatePresence>
        </main>
        {!immersive && <Footer />}
        <CommandPalette open={paletteOpen} onClose={closePalette} />
        {photoNotice && (
          <Suspense fallback={null}>
            <PhotoNotice />
          </Suspense>
        )}
        <div className="grain" aria-hidden="true" />
      </div>
    </PaletteContext.Provider>
  );
}
