import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { BROCHURES } from '../../data/brochures.js';
import Library from './Library.jsx';

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.search}</output>
      <output data-testid="path">{location.pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
    </>
  );
}

function renderLibrary(url = '/brochures', entries = [url]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <ToastProvider>
        <BrochureProvider>
          <Routes>
            <Route path="/brochures" element={<Library />} />
            <Route path="/" element={<h1>Home page</h1>} />
          </Routes>
          <LocationProbe />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const cards = () => screen.getAllByRole('article');

describe('<Library>', () => {
  it('lists every built-in brochure as one named link per card', () => {
    renderLibrary();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every brochure, unfolded.');
    // The masthead leads with a photograph of a nostalgic place (its art until it arrives).
    expect(screen.getByRole('complementary', { name: 'Tabi no shiori' }).querySelector('[data-state]')).not.toBeNull();
    expect(cards()).toHaveLength(BROCHURES.length);
    expect(screen.getByRole('link', { name: 'Kyoto: A Thousand Gates' })).toHaveAttribute('href', '/brochures/kyoto-thousand-gates');
  });

  it('keeps the favourite button outside the card link', () => {
    renderLibrary();
    for (const card of cards()) {
      const button = within(card).getByRole('button', { name: /to favourites/ });
      expect(button.closest('a')).toBeNull();
    }
  });

  it('applies filters from the URL and announces the count', () => {
    renderLibrary('/brochures?category=food');
    expect(cards()).toHaveLength(1);
    const live = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(live).toHaveTextContent(`1 brochure of ${BROCHURES.length}`);
    expect(screen.getByRole('button', { name: /Remove category filter: Food & Drink/ })).toBeInTheDocument();
  });

  it('shows the empty state with a way out', async () => {
    const user = userEvent.setup();
    renderLibrary('/brochures?q=zzzz');
    expect(screen.getByRole('heading', { name: 'No brochures match' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/);
    expect(cards()).toHaveLength(BROCHURES.length);
  });

  it('toggles seasons and the favourites-only filter through the URL', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('button', { name: /^Winter,/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('?season=winter');
    await user.click(within(cards()[0]).getByRole('button', { name: /to favourites/ }));
    await user.click(screen.getByRole('button', { name: /^Saved only/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('?season=winter&fav=1');
    // Cards that no longer match animate out before they unmount.
    await waitFor(() => expect(cards()).toHaveLength(1));
  });

  it('keeps one history entry per search, so Back returns to the unfiltered library', async () => {
    const user = userEvent.setup();
    renderLibrary('/brochures', ['/', '/brochures']);
    const box = screen.getByRole('searchbox', { name: 'Search brochures' });
    await user.type(box, 'kyoto');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?q=kyoto'));
    await user.clear(box);
    await user.type(box, 'osaka');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?q=osaka'));

    await user.click(screen.getByRole('button', { name: 'History back' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/brochures');
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/);
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('“Continue reading” and the spine reopen the page where the reader left off', () => {
    window.localStorage.setItem('tabi:recent', JSON.stringify(['b_osaka-kuidaore', 'b_kyoto-thousand-gates']));
    window.localStorage.setItem('tabi:progress', JSON.stringify({ 'b_osaka-kuidaore': 3 }));
    renderLibrary();
    const resume = screen.getByRole('link', { name: 'Continue reading Osaka: Eat Until You Drop at page 4' });
    expect(resume).toHaveAttribute('href', '/brochures/osaka-kuidaore?p=3');
    expect(screen.getByText(/^Page 04/)).toBeInTheDocument();
    const spines = screen.getByRole('list', { name: 'Newest first' });
    expect(within(spines).getByRole('link', { name: /Osaka.*continue reading at page 4/ })).toHaveAttribute('href', '/brochures/osaka-kuidaore?p=3');
    // No saved page: the spine opens the cover.
    expect(within(spines).getByRole('link', { name: /Kyoto.*continue reading$/ })).toHaveAttribute('href', '/brochures/kyoto-thousand-gates');
  });

  it('names region options in English for screen readers, kanji staying visible', () => {
    renderLibrary();
    const option = screen.getByRole('option', { name: 'Hokkaidō, 1 brochure' });
    expect(option).toHaveTextContent('Hokkaidō 北海道 · 1');
  });

  it('drops prototype-named filters from a hand-edited URL instead of showing an empty mystery state', () => {
    renderLibrary('/brochures?category=constructor&region=toString&season=__proto__');
    expect(cards()).toHaveLength(BROCHURES.length);
    expect(screen.queryByRole('button', { name: /Remove .* filter/ })).toBeNull();
  });
});
