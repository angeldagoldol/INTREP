import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node-environment suites (the build scripts' tests, `// @vitest-environment node`) have no window.
const browser = typeof window !== 'undefined';

afterEach(() => {
  cleanup();
  if (browser) window.localStorage.clear();
});

// jsdom lacks these browser APIs; framer-motion and our hooks rely on them.
if (browser && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

class MockObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (browser) {
  window.IntersectionObserver ??= MockObserver;
  window.ResizeObserver ??= MockObserver;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.scrollTo ??= function scrollTo() {};
  Element.prototype.scrollBy ??= function scrollBy() {};
  window.scrollBy ??= vi.fn();
}
