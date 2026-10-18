import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { BrochureProvider } from './context/BrochureContext.jsx';
import { BROCHURES } from './data/brochures.js';
import App from './App.jsx';

/**
 * Smoke test across slices: every route renders inside the real shell
 * (navbar, footer, route transition, lazy pages) with exactly one <h1>.
 */
async function renderAt(hash) {
  window.location.hash = hash;
  let view;
  // Awaited: lazy routes and a built-in's pages (src/data/catalog.js) suspend.
  await act(async () => {
    view = render(
      <ThemeProvider>
        <ToastProvider>
          <BrochureProvider>
            <App />
          </BrochureProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  return view;
}

const darkPaper = BROCHURES.find((b) => b.slug === 'tokyo-after-dark');

const ROUTES = [
  ['#/', /Japan/i],
  ['#/brochures', /brochure/i],
  [`#/brochures/${BROCHURES[0].slug}`, new RegExp(BROCHURES[0].title.split(':')[0], 'i')],
  [`#/brochures/${darkPaper.slug}?p=3`, /Tokyo/i],
  ['#/brochures/no-such-brochure', /.+/],
  ['#/studio', /.+/],
  ['#/credits', /Credits/],
  ['#/nope', /.+/],
];

describe('<App> routes', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
    window.location.hash = '';
  });

  it.each(ROUTES)('renders %s with one h1', async (hash, heading) => {
    const errors = vi.spyOn(console, 'error');
    await renderAt(hash);
    const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
    expect(h1).toHaveTextContent(heading);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('opens a brochure from a filtered Library that has the visitor’s own shelf', async () => {
    // Regression: the outgoing Library used to re-render for the new URL
    // (no ?q=), remount "Your brochures" mid-exit, and the route curtain then
    // waited forever on those freshly mounted cards.
    const own = { ...BROCHURES[0], id: 'b_own', slug: 'my-own-kyoto', title: 'My own Kyoto', source: 'user', featured: false };
    window.localStorage.setItem('tabi:brochures', JSON.stringify([own]));
    const osaka = BROCHURES.find((b) => b.slug === 'osaka-kuidaore');
    await renderAt('#/brochures?q=osaka');
    await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
    await waitFor(() => expect(document.querySelector(`main a[href="#/brochures/${osaka.slug}"]`)).not.toBeNull(), { timeout: 4000 });
    fireEvent.click(document.querySelector(`main a[href="#/brochures/${osaka.slug}"]`));
    expect(await screen.findByRole('region', { name: 'Brochure reader' }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Osaka/);
  });

  it('remembers the page the reader is on, for the Library’s “Continue reading”', async () => {
    await renderAt(`#/brochures/${darkPaper.slug}?p=3`);
    await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('tabi:progress'))).toEqual({ [darkPaper.id]: 3 }));
  });
});
