import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext.jsx';
import { modKeyLabel } from '../../hooks/useHotkey.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const loadPanel = () => import('./PalettePanel.jsx');

/**
 * ⌘K / Ctrl K command palette, mounted once by <AppShell>. The panel itself
 * (search index, cover thumbnails, icon registry) is a separate chunk that is
 * fetched while the browser is idle, so the first ⌘K still opens instantly.
 * If the panel cannot be downloaded (offline, or a deploy replaced the chunk)
 * or fails to render, the palette closes with a toast offering a reload
 * instead of taking the app down. Props: open, onClose.
 */
export function CommandPalette({ open, onClose }) {
  const toast = useToast();
  // React.lazy remembers a failed import for good; a fresh one lets the next
  // ⌘K try again where the browser does not cache the failure (Chromium does).
  const [PalettePanel, setPalettePanel] = useState(() => lazy(loadPanel));

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      loadPanel().catch(() => {
        /* offline: opening the palette tries again */
      });
    });
    return () => cancel(handle);
  }, []);

  const onPanelError = useCallback(() => {
    setPalettePanel(() => lazy(loadPanel));
    onClose();
    toast({
      title: 'Search didn’t load',
      description: `Check your connection, then reload the page to use ${modKeyLabel} K again.`,
      tone: 'error',
      action: { label: 'Reload', onClick: () => window.location.reload() },
    });
  }, [onClose, toast]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <ErrorBoundary key="palette" onError={onPanelError}>
          <Suspense fallback={null}>
            <PalettePanel onClose={onClose} />
          </Suspense>
        </ErrorBoundary>
      )}
    </AnimatePresence>,
    document.body,
  );
}
