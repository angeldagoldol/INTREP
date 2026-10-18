import { lazy } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import { AppShell } from './AppShell.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { RouteErrorBoundary } from './RouteErrorBoundary.jsx';
import { CHUNK_RELOAD_KEY } from './chunkError.js';

function Boom() {
  throw new TypeError("Cannot read properties of undefined (reading 'pages')");
}

const chunkFailure = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Studio-x.js'));

function renderShell(url, element) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <BrochureProvider>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="broken" element={element} />
                <Route path="brochures" element={<h1>The library</h1>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </BrochureProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('route error boundary', () => {
  let consoleError;
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });
  beforeEach(() => {
    // React reports caught errors to the console; keep the test output clean.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
    window.sessionStorage.clear();
  });

  it('shows the torn page in place of a crashing route, keeps the navbar, and resets on navigation', async () => {
    const user = userEvent.setup();
    renderShell('/broken', <Boom />);
    expect(await screen.findByRole('heading', { level: 1, name: 'This page tore' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText(/reading 'pages'/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to the library' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The library' })).toBeInTheDocument();
    expect(screen.queryByText('This page tore')).toBeNull();
  });

  it('explains a chunk that did not download once the automatic reload was spent', async () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    const Missing = lazy(chunkFailure);
    renderShell('/broken', <Missing />);
    expect(await screen.findByRole('heading', { level: 1, name: 'This page didn’t arrive' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('reloads once by itself when a chunk fails to download', async () => {
    const reload = vi.fn();
    const Missing = lazy(chunkFailure);
    render(
      <MemoryRouter>
        <RouteErrorBoundary onReload={reload}>
          <Missing />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Updating Tabi');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY))).toBeGreaterThan(0);
  });

  it('a standalone boundary renders its own <main> and recovers when the path changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <RouteErrorBoundary standalone>
          <Routes>
            <Route path="broken" element={<Boom />} />
            <Route path="brochures" element={<h1>The library</h1>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'This page tore' }));
    await user.click(screen.getByRole('link', { name: 'Back to the library' }));
    expect(screen.getByRole('heading', { level: 1, name: 'The library' })).toBeInTheDocument();
  });
});

describe('<ErrorBoundary>', () => {
  it('renders nothing without a fallback and reports the error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const { container } = render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError), expect.anything());
    consoleError.mockRestore();
  });
});
