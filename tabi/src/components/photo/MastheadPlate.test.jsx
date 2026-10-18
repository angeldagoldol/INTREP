import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';

/** Stand-in registry records (no network, nothing written anywhere). */
const credit = { title: 'File', author: 'Aiko Tanaka', authorUrl: '', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' };
const record = (id, caption, place, available) => ({
  id,
  use: 'full',
  caption,
  place,
  alt: `A photograph of ${place}`,
  focus: '',
  available,
  user: false,
  credit: available ? credit : { title: '', author: '', authorUrl: '', license: '', licenseUrl: '', sourceUrl: '' },
  width: available ? 1600 : 0,
  height: available ? 2000 : 0,
  widths: available ? [960, 1600] : [],
  lqip: '',
  color: '',
  token: available ? 'test' : 'none',
  src: () => (available ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : null),
  srcSet: available ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw= 960w' : '',
});
const photos = {
  list: [
    record('nostalgic-street', 'Yasaka-dōri, Kyoto — street lanterns at dawn', 'Yasaka Pagoda, Kyoto', true),
    record('nostalgic-inn', 'Ginzan Onsen, Yamagata — wooden inns in the snow', 'Ginzan Onsen, Yamagata', false),
  ],
};

vi.mock('../../data/photos/index.js', async (importOriginal) => {
  const real = await importOriginal();
  const find = (id) => photos.list.find((p) => p.id === id) ?? null;
  return {
    ...real,
    getPhoto: (id) => find(id) ?? real.getPhoto(id),
    resolvePhoto: (id, brochure) => find(id) ?? real.resolvePhoto(id, brochure),
  };
});

const { MastheadPlate } = await import('./MastheadPlate.jsx');

const plate = (ids) =>
  render(
    <MastheadPlate ids={ids} jp="旅のしおり" seal="資料" label="Tabi no shiori">
      <em>Tabi no shiori</em> — the little booklet handed out before every school trip.
    </MastheadPlate>,
  );

describe('<MastheadPlate> — a masthead led by a photograph', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  it('shows the first photograph the registry knows, names the place and credits the photographer', () => {
    plate(['nostalgic-gone', 'nostalgic-street', 'nostalgic-inn']);
    const aside = screen.getByRole('complementary', { name: 'Tabi no shiori' });
    expect(within(aside).getByRole('img', { name: 'A photograph of Yasaka Pagoda, Kyoto' })).toBeInTheDocument();
    expect(within(aside).getByText('Yasaka-dōri, Kyoto')).toBeInTheDocument();
    expect(aside.textContent).toContain('Aiko Tanaka');
    expect(within(aside).getByRole('link', { name: /Licence CC BY-SA 4.0/ })).toHaveAttribute('rel', 'noopener noreferrer');
    // The page's word hangs on its slip, in Japanese; the note keeps its words.
    expect(within(aside).getByText('旅のしおり')).toHaveAttribute('lang', 'ja');
    expect(aside.textContent).toContain('the little booklet handed out');
  });

  it('holds the place with art, uncredited, until a photograph is found', () => {
    plate(['nostalgic-inn']);
    const aside = screen.getByRole('complementary', { name: 'Tabi no shiori' });
    expect(within(aside).getByText('Ginzan Onsen, Yamagata')).toBeInTheDocument();
    expect(aside.querySelector('[data-state]')).not.toBeNull();
    expect(aside.textContent).not.toContain('Photo:');
  });

  it('still draws the plate (art, slip, seal, note) when no photograph is known at all', () => {
    plate(['nostalgic-gone']);
    const aside = screen.getByRole('complementary', { name: 'Tabi no shiori' });
    expect(within(aside).getByText('旅のしおり')).toBeInTheDocument();
    expect(within(aside).queryByRole('link')).toBeNull();
    expect(aside.textContent).toContain('Tabi no shiori');
  });
});
