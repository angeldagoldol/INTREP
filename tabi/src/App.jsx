import { lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.jsx';
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary.jsx';

// Route-level code splitting: each page ships as its own chunk.
const Home = lazy(() => import('./pages/Home/Home.jsx'));
const Library = lazy(() => import('./pages/Library/Library.jsx'));
const Viewer = lazy(() => import('./pages/Viewer/Viewer.jsx'));
const Studio = lazy(() => import('./pages/Studio/Studio.jsx'));
const Credits = lazy(() => import('./pages/Credits/Credits.jsx'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound.jsx'));

/**
 * Hash routing (#/brochures/kyoto-thousand-gates) so the built site works on
 * any static host with zero server rewrites.
 *
 * Two error boundaries: <AppShell> wraps each route's content, so a broken
 * page keeps the navbar; this outer one is the last resort for the shell
 * itself (navbar, footer, palette) and brings its own masthead.
 */
export default function App() {
  return (
    <HashRouter>
      <RouteErrorBoundary standalone>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="brochures" element={<Library />} />
            <Route path="brochures/:slug" element={<Viewer />} />
            <Route path="studio" element={<Studio />} />
            <Route path="studio/:id" element={<Studio />} />
            <Route path="credits" element={<Credits />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </RouteErrorBoundary>
    </HashRouter>
  );
}
