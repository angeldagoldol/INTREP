import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../../context/BrochureContext.jsx';
import { ToastProvider } from '../../../context/ToastContext.jsx';

/** Stand-in records for the Nostalgic Japan manifest (no network, nothing written anywhere). */
const credit = { title: 'File', author: 'Aiko Tanaka', authorUrl: '', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' };
const record = (id, use, caption, place, available = false) => ({
  id,
  use,
  caption,
  place,
  alt: `A photograph of ${place}`,
  focus: '',
  available,
  user: false,
  credit: available ? credit : { title: '', author: '', authorUrl: '', license: '', licenseUrl: '', sourceUrl: '' },
  width: available ? 1600 : 0,
  height: available ? 1067 : 0,
  widths: available ? [960, 1600] : [],
  lqip: '',
  color: '',
  token: available ? 'test' : 'none',
  src: () => (available ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : null),
  srcSet: available ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw= 960w' : '',
});
const NOSTALGIC = [
  record('nostalgic-ginzan', 'cover', 'Ginzan Onsen, Yamagata — wooden inns along the river in the snow · 銀山温泉', 'Ginzan Onsen, Obanazawa, Yamagata', true),
  record('nostalgic-ginzan-night', 'wide', 'Ginzan Onsen, Yamagata — gas lamps after dark', 'Ginzan Onsen, Obanazawa, Yamagata'),
  record('nostalgic-narai', 'wide', 'Narai-juku 奈良井宿 on the Nakasendō', 'Narai-juku, Nagano'),
  record('nostalgic-station', 'any', 'A wooden country station', 'Shimonada Station, Ehime'),
];
const photos = { list: NOSTALGIC };

vi.mock('../../../data/photos/index.js', async (importOriginal) => {
  const real = await importOriginal();
  const find = (id) => photos.list.find((p) => p.id === id) ?? null;
  return {
    ...real,
    listPhotos: () => [...real.listPhotos().filter((p) => !p.id.startsWith('nostalgic-')), ...photos.list],
    getPhoto: (id) => find(id) ?? real.getPhoto(id),
    resolvePhoto: (id, brochure) => find(id) ?? real.resolvePhoto(id, brochure),
  };
});

const { Nostalgic } = await import('./Nostalgic.jsx');

function renderSection() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <BrochureProvider>
          <Nostalgic />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<Nostalgic> — 懐かしい日本 on the Home page', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });
  afterEach(() => {
    photos.list = NOSTALGIC;
  });

  it('shows the nostalgic places as a mosaic of photographs, the cover-shaped one leading, one per place', () => {
    renderSection();
    expect(screen.getByRole('heading', { level: 2, name: /Nostalgic Japan/ })).toBeInTheDocument();
    expect(screen.getByText(/懐かしい/, { selector: 'p' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('data-lead');
    // Every frame holds a photo slot (the photograph, or its art until it arrives).
    for (const item of items) expect(item.querySelector('[data-state]')).not.toBeNull();
  });

  it('captions each photo with the place and its Japanese name, and credits the photographer', () => {
    renderSection();
    // The cover-shaped photo leads; the wide one goes last (the mosaic's wide slot).
    const [lead, station, narai] = screen.getAllByRole('listitem');
    expect(within(lead).getByText('Ginzan Onsen, Yamagata')).toBeInTheDocument();
    expect(within(lead).getByText('wooden inns along the river in the snow')).toBeInTheDocument();
    // The lead sets its Japanese name tall in the corner (decorative); the caption carries it for screen readers.
    expect(lead.querySelector('figcaption [lang="ja"]')).toHaveTextContent('銀山温泉');
    expect(lead.querySelector('[aria-hidden="true"]')).toHaveTextContent('銀山温泉');
    expect(lead.textContent).toContain('Aiko Tanaka');
    expect(within(lead).getByRole('link', { name: /Licence CC BY-SA 4.0/ })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(narai).getByText('奈良井宿')).toHaveAttribute('lang', 'ja');
    expect(within(narai).getByText('Narai-juku on the Nakasendō')).toBeInTheDocument();
    // Not found yet: the art stands in and nothing is credited.
    expect(within(station).getByText('A wooden country station')).toBeInTheDocument();
    // A caption that does not name the place gets the place as a small eyebrow.
    expect(within(station).getByText('Shimonada Station, Ehime')).toBeInTheDocument();
    // …and none when the title already names it.
    expect(within(lead).queryByText('Ginzan Onsen, Obanazawa, Yamagata')).toBeNull();
    expect(station.textContent).not.toContain('Photo:');
  });

  it('links to the Nostalgic Japan brochure once it is in the library', () => {
    renderSection();
    const link = screen.queryByRole('link', { name: /^Read / });
    if (link) expect(link).toHaveAttribute('href', '/brochures/nostalgic-japan');
  });

  it('renders nothing at all while there are no nostalgic photographs', () => {
    photos.list = [];
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });
});
