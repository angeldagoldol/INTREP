import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../../context/BrochureContext.jsx';
import { ToastProvider } from '../../../context/ToastContext.jsx';
import { BUILTINS } from '../../../data/catalog.js';
import { REGIONS } from '../../../data/regions.js';
import { Regions } from './Regions.jsx';

function renderRegions() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <BrochureProvider>
          <Regions />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<Regions> — a photograph per region, no map', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  it('links each of the eight regions, north to south, to the Library filtered to it', () => {
    renderRegions();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(REGIONS.length);
    links.forEach((link, i) => {
      expect(link).toHaveAttribute('href', `/brochures?region=${REGIONS[i].id}`);
      expect(link).toHaveTextContent(REGIONS[i].label);
      expect(link.querySelector('[lang="ja"]')).toHaveTextContent(REGIONS[i].jp);
    });
  });

  it('names each region in a heading and says how many brochures it has', () => {
    const { container } = renderRegions();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(REGIONS.map((r) => `${r.label}${r.jp}`));
    const kansai = BUILTINS.filter((b) => b.region === 'kansai').length;
    const tile = screen.getByRole('link', { name: /Kansai/ }).closest('li');
    expect(tile).toHaveTextContent(kansai === 1 ? '1 brochure' : `${kansai} brochures`);
    // A photograph (or its art) in every tile, and no map anywhere.
    expect(container.querySelectorAll('li [data-state]')).toHaveLength(REGIONS.length);
    expect(screen.queryByRole('img', { name: /map/i })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is keyboard accessible: Tab moves through the regions in reading order', async () => {
    const user = userEvent.setup();
    renderRegions();
    await user.tab();
    expect(document.activeElement).toHaveAttribute('href', `/brochures?region=${REGIONS[0].id}`);
    await user.tab();
    expect(document.activeElement).toHaveAttribute('href', `/brochures?region=${REGIONS[1].id}`);
  });
});
