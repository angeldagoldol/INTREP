import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { BROCHURES } from '../../data/brochures.js';
import Credits from './Credits.jsx';

function renderCredits() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <BrochureProvider>
          <Credits />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<Credits>', () => {
  it('has one h1 and a numbered section for each kind of credit', () => {
    renderCredits();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of ['Photographs', 'Facts & sources', 'Typefaces', 'Also']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    // Tabi draws no maps any more: no map section, no map data credit.
    expect(screen.queryByRole('region', { name: 'Map data' })).toBeNull();
    // The masthead leads with a photograph of a nostalgic place (its art until it arrives).
    expect(screen.getByRole('complementary', { name: 'Okuzuke' }).querySelector('[data-state]')).not.toBeNull();
  });

  it('groups photographs by the Home page and every built-in brochure', () => {
    renderCredits();
    const photos = screen.getByRole('region', { name: 'Photographs' });
    expect(within(photos).getByRole('heading', { level: 3, name: /Home page/ })).toBeInTheDocument();
    for (const b of BROCHURES) {
      expect(within(photos).getByRole('heading', { level: 3, name: new RegExp(b.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
    }
  });

  it('lists each brochure’s fact check and credits the fonts, with no map credit', () => {
    renderCredits();
    const facts = screen.getByRole('table', { name: 'Fact checks of the built-in brochures' });
    expect(within(facts).getAllByRole('row')).toHaveLength(BROCHURES.length + 1);
    expect(screen.queryByRole('link', { name: /Natural Earth/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Natural Earth|map is drawn/);
    expect(screen.getAllByRole('link', { name: /SIL Open Font License/ }).length).toBe(5);
  });

  it('opens every outside link in a new tab without an opener', () => {
    renderCredits();
    const outside = screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank');
    expect(outside.length).toBeGreaterThan(10);
    for (const a of outside) expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
