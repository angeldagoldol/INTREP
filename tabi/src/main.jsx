import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { BrochureProvider } from './context/BrochureContext.jsx';
import App from './App.jsx';
import { BUILTINS, preloadBrochure } from './data/catalog.js';
import { findBySlug } from './pages/Viewer/findBySlug.js';
import { removeStorage } from './lib/storage.js';
import './styles/tokens.css';
import './styles/base.css';

// A link straight into a built-in brochure: fetch its pages (a lazy chunk)
// alongside the reader's own chunk instead of after it.
try {
  const deepLink = /^#\/brochures\/([^/?#]+)/.exec(window.location.hash);
  if (deepLink) preloadBrochure(findBySlug(BUILTINS, decodeURIComponent(deepLink[1])));
} catch {
  // A malformed address: the router shows its not-found page.
}

// The old "Seasonal letters" sign-up kept an email address under
// tabi:newsletter. Nothing was ever sent and the sign-up is gone; so is the address.
removeStorage('newsletter');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* reducedMotion="user": honour the OS "reduce motion" setting everywhere. */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <BrochureProvider>
            <App />
          </BrochureProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
