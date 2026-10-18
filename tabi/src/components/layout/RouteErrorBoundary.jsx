import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { PageLoader } from './PageLoader.jsx';
import { RouteError } from './RouteError.jsx';
import { reloadForChunk, shouldAutoReload } from './chunkError.js';

const reloadPage = () => window.location.reload();

/**
 * Error boundary for route content (and, with `standalone`, for the whole
 * shell). A render error shows <RouteError> in the page's place while the
 * navbar and footer keep working. A lazy chunk that failed to download
 * (usually a tab left open across a deploy) reloads the page once by itself;
 * it shows the error page if that happens again within 30 s or offline.
 * Inside <AppShell> it is mounted per route, so navigating away resets it;
 * a standalone boundary resets when the pathname changes.
 * Props: children, standalone, onReload (tests).
 */
export function RouteErrorBoundary({ children, standalone = false, onReload = reloadPage }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      resetKey={standalone ? pathname : undefined}
      onError={(error) => {
        if (shouldAutoReload(error)) reloadForChunk({ reload: onReload });
      }}
      fallback={({ error }) =>
        // About to reload: keep showing the loader rather than flash an error.
        shouldAutoReload(error) ? (
          <PageLoader label="Updating Tabi" />
        ) : (
          <RouteError error={error} onReload={onReload} standalone={standalone} />
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
