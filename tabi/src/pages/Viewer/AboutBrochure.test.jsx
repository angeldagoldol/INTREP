import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BROCHURES } from '../../data/brochures.js';
import { AboutBrochure } from './AboutBrochure.jsx';

const kyoto = BROCHURES.find((b) => b.slug === 'kyoto-thousand-gates');

function renderAbout(brochure) {
  return render(
    <MemoryRouter>
      <AboutBrochure brochure={brochure} onPlan={() => {}} />
    </MemoryRouter>,
  );
}

describe('<AboutBrochure>', () => {
  it('shows when a built-in’s facts were checked, and lists its sources in new tabs', () => {
    renderAbout(kyoto);
    expect(screen.getByText(`Facts checked ${kyoto.factsChecked}`)).toBeInTheDocument();
    const sources = screen.getByRole('list', { name: /Sources/ });
    const links = within(sources).getAllByRole('link');
    expect(links.length).toBe(kyoto.sources.length);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getByRole('link', { name: /Every credit in Tabi/ })).toHaveAttribute('href', '/credits');
  });

  it('is honest about photographs that are not downloaded yet', () => {
    renderAbout(kyoto);
    expect(screen.getByText(/listed for this brochure but not downloaded yet/)).toBeInTheDocument();
  });

  it('says a Studio brochure’s facts await a check and never claims Tabi checked them', () => {
    const own = { ...kyoto, id: 'u1', slug: 'mine', source: 'user', organization: 'Me', factsChecked: '', sources: [] };
    renderAbout(own);
    expect(screen.getAllByText(/Facts awaiting check|Awaiting check/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Checked by Tabi Guides/)).toBeNull();
    expect(screen.getByText('No sources are listed for this brochure.')).toBeInTheDocument();
  });
});
