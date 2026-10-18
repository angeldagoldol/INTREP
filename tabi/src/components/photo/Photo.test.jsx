import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createPhotoRegistry } from '../../data/photos/registry.js';
import { Photo } from './Photo.jsx';
import { PhotoContext, usePhotoRecord } from './photoContext.js';
import { PhotoCredit } from './PhotoCredit.jsx';
import { renderedWidth } from './renderedWidth.js';

const registry = createPhotoRegistry(
  {
    m: [
      { id: 'test-gate', alt: 'A tunnel of vermilion gates', caption: 'Senbon Torii', focus: '40% 30%' },
      { id: 'test-pending', alt: 'Not downloaded yet' },
      { id: 'test-pd', alt: 'An old print' },
      { id: 'test-no-alt', caption: 'Kiyomizu-dera in autumn' },
    ],
  },
  {
    'test-gate': {
      width: 1600,
      height: 1067,
      widths: [480, 960, 1600],
      lqip: 'data:image/webp;base64,UklGRg==',
      color: '#8a3b22',
      author: 'Example Photographer',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Example',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      attributionRequired: true,
    },
    'test-pd': { width: 960, height: 640, widths: [480, 960], author: 'Unknown author', license: 'Public domain', licenseUrl: '', sourceUrl: 'javascript:alert(1)' },
    'test-no-alt': { width: 1600, height: 1067, widths: [480, 960, 1600], author: 'A', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  },
);
const gate = { ...registry.getPhoto('test-gate'), credit: { ...registry.getPhoto('test-gate').credit, title: 'Senbon Torii at dawn' } };
const Art = () => <svg data-testid="art" />;

describe('<Photo>', () => {
  it('renders a responsive, lazy, sized image with the manifest alt text', () => {
    const { container } = render(<Photo photo={gate} sizes="50vw" />);
    const img = screen.getByRole('img', { name: 'A tunnel of vermilion gates' });
    expect(img).toHaveAttribute('srcset', 'photos/test-gate-480.webp 480w, photos/test-gate-960.webp 960w, photos/test-gate-1600.webp 1600w');
    expect(img).toHaveAttribute('src', 'photos/test-gate-960.webp');
    expect(img).toHaveAttribute('sizes', '50vw');
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '1067');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('fetchpriority');
    const root = container.firstChild;
    expect(root).toHaveAttribute('data-state', 'loading');
    expect(root.style.getPropertyValue('--photo-focus')).toBe('40% 30%');
    expect(root.style.getPropertyValue('--photo-color')).toBe('#8a3b22');
    expect(container.querySelector('[aria-hidden="true"]').style.backgroundImage).toContain('data:image/webp;base64');
  });

  it('loads eagerly with high priority for heroes, and takes focus/alt overrides', () => {
    const { container } = render(<Photo photo={gate} priority focus="50% 80%" alt="" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('alt', '');
    expect(container.firstChild.style.getPropertyValue('--photo-focus')).toBe('50% 80%');
  });

  it('sharpens in once loaded, and falls back if the file fails', () => {
    const { container } = render(<Photo photo={gate} fallback={<Art />} />);
    const img = container.querySelector('img');
    fireEvent.load(img);
    expect(container.firstChild).toHaveAttribute('data-state', 'loaded');
    fireEvent.error(img);
    expect(container.firstChild).toHaveAttribute('data-state', 'fallback');
    expect(screen.getByTestId('art')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the fallback for unknown ids and photos not downloaded yet', () => {
    render(<Photo id="no-such-photo" fallback={<Art />} />);
    expect(screen.getByTestId('art')).toBeInTheDocument();
    const pending = render(<Photo photo={registry.getPhoto('test-pending')} credit="overlay" fallback={<Art />} />);
    expect(pending.container.firstChild).toHaveAttribute('data-state', 'fallback');
    expect(pending.container.textContent).not.toMatch(/Photo:/);
    expect(() => render(<Photo />)).not.toThrow();
  });

  it('credits the photographer in a chip that opens the source and licence in a new tab', () => {
    render(<Photo photo={gate} credit="overlay" />);
    const source = screen.getByRole('link', { name: /Example Photographer/ });
    expect(source).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Example.jpg');
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /CC BY-SA 4\.0/ })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0');
  });

  it('prints the credit as plain text when links are off, and never links unsafe URLs', () => {
    const { container } = render(<Photo photo={gate} credit="caption" creditLinks={false} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent).toContain('Photo: Example Photographer · CC BY-SA 4.0');
    const pd = render(<Photo photo={registry.getPhoto('test-pd')} credit="overlay" />);
    expect(pd.container.querySelectorAll('a')).toHaveLength(0);
    expect(pd.container.textContent).toContain('Unknown author · Public domain');
  });

  it('keeps the licence whole and lets only the author’s name shorten; the tooltip has the full credit', () => {
    const { container } = render(<Photo photo={gate} credit="overlay" />);
    const chip = container.querySelector('small');
    expect(chip).toHaveAttribute('title', '“Senbon Torii at dawn” by Example Photographer · CC BY-SA 4.0');
    const [label, author, sep, license] = chip.children;
    expect(label.textContent).toBe('Photo:');
    expect(author.textContent).toBe('Example Photographer');
    expect(sep).toHaveAttribute('aria-hidden', 'true');
    expect(license.textContent).toBe('CC BY-SA 4.0');
    expect(author.className).not.toBe(license.className);
  });

  it('falls back to the caption when the manifest has no alt text', () => {
    render(<Photo id={undefined} photo={registry.getPhoto('test-no-alt')} />);
    expect(screen.getByRole('img', { name: 'Kiyomizu-dera in autumn' })).toBeInTheDocument();
  });

  it('draws no credit when asked for none', () => {
    const { container } = render(<Photo photo={gate} />);
    expect(container.textContent).toBe('');
  });

  it('switches cleanly to another photo', () => {
    const { container, rerender } = render(<Photo photo={gate} fallback={<Art />} />);
    fireEvent.load(container.querySelector('img'));
    rerender(<Photo photo={registry.getPhoto('test-pd')} fallback={<Art />} />);
    expect(container.firstChild).toHaveAttribute('data-state', 'loading');
    expect(container.querySelector('img')).toHaveAttribute('src', 'photos/test-pd-960.webp');
  });
});

describe('<Photo> sizes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('measures its frame and asks for the width the picture is really drawn at', () => {
    // A 320×480 portrait frame and a 3:2 landscape photo: cover crops it, so it is drawn 720px wide.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
    const { container, rerender } = render(<Photo photo={gate} sizes="100vw" />);
    expect(container.querySelector('img')).toHaveAttribute('sizes', '720px');
    rerender(<Photo photo={gate} sizes="100vw" fit="contain" />);
    expect(container.querySelector('img')).toHaveAttribute('sizes', '320px');
  });

  it('keeps the given sizes until the frame has a size', () => {
    const { container } = render(<Photo photo={gate} sizes="(min-width: 900px) 50vw, 100vw" />);
    expect(container.querySelector('img')).toHaveAttribute('sizes', '(min-width: 900px) 50vw, 100vw');
  });

  it('renderedWidth covers, contains and rounds up', () => {
    expect(renderedWidth(320, 480, 1.5)).toBe(720);
    expect(renderedWidth(320, 480, 1.5, 'contain')).toBe(320);
    expect(renderedWidth(600, 200, 0.75)).toBe(600);
    expect(renderedWidth(39, 55, 1.5)).toBe(120);
    expect(renderedWidth(300, 0, 1.5)).toBe(320);
    expect(renderedWidth(0, 400, 1.5)).toBeNull();
  });
});

describe('<Photo> with a brochure’s own photos ("user:<key>")', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const brochure = {
    userPhotos: {
      dusk: { src: PNG, alt: 'The gate at dusk', width: 1200, height: 800, focus: '20% 70%', credit: { author: 'Aiko', license: 'CC BY 4.0' } },
      remote: { src: 'https://example.com/x.jpg', alt: 'Hotlink' },
    },
  };

  it('renders an upload from the surrounding PhotoContext, with a plain src and its credit', () => {
    const { container } = render(
      <PhotoContext.Provider value={brochure}>
        <Photo id="user:dusk" credit="overlay" fallback={<Art />} />
      </PhotoContext.Provider>,
    );
    const img = screen.getByRole('img', { name: 'The gate at dusk' });
    expect(img).toHaveAttribute('src', PNG);
    expect(img).not.toHaveAttribute('srcset');
    expect(img).not.toHaveAttribute('sizes');
    expect(container.firstChild.style.getPropertyValue('--photo-focus')).toBe('20% 70%');
    expect(container.textContent).toContain('Photo: Aiko · CC BY 4.0');
  });

  it('takes the brochure as a prop, and falls back for hotlinks or missing keys', () => {
    render(<Photo id="user:dusk" brochure={brochure} />);
    expect(screen.getByRole('img', { name: 'The gate at dusk' })).toBeInTheDocument();
    const remote = render(<Photo id="user:remote" brochure={brochure} fallback={<Art />} />);
    expect(remote.container.querySelector('img')).toBeNull();
    expect(remote.getByTestId('art')).toBeInTheDocument();
    const missing = render(<Photo id="user:dusk" fallback={<Art />} />);
    expect(missing.container.firstChild).toHaveAttribute('data-state', 'fallback');
  });

  it('usePhotoRecord resolves ids in context', () => {
    function Probe() {
      const record = usePhotoRecord('user:dusk');
      return <output>{`${record?.id} ${record?.available} ${record?.user}`}</output>;
    }
    render(
      <PhotoContext.Provider value={brochure}>
        <Probe />
      </PhotoContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('user:dusk true true');
  });

  it('<PhotoCredit> takes a creditsFor() entry and can drop its label', () => {
    const { container } = render(<PhotoCredit credit={{ author: 'Aiko', license: 'CC0' }} label="" links={false} />);
    expect(container.textContent).toBe('Aiko · CC0');
    expect(render(<PhotoCredit credit={{}} />).container.textContent).toBe('');
  });
});

describe('<Photo> with a live photo from Wikimedia Commons', () => {
  afterEach(() => vi.useRealTimers());
  const base = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Torii_path_at_dawn.jpg/';
  const image = {
    file: 'File:Torii path at dawn.jpg',
    width: 4000,
    height: 2667,
    widths: [500, 960, 1280, 1920],
    srcSet: [500, 960, 1280, 1920].map((w) => `${base}${w}px-Torii_path_at_dawn.jpg ${w}w`).join(', '),
    src: (w) => `${base}${[500, 960, 1280, 1920].find((s) => s >= w) ?? 1920}px-Torii_path_at_dawn.jpg`,
    credit: { title: 'Torii path at dawn', author: 'Jane', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Torii_path_at_dawn.jpg' },
    attributionRequired: true,
    via: 'candidate',
  };
  const liveRegistry = createPhotoRegistry({ m: [{ id: 'test-live', alt: 'Vermilion gates', focus: '50% 60%' }] }, {}, { live: { get: () => image } });
  const record = liveRegistry.getPhoto('test-live');

  it('draws Commons thumbnails on the standard steps, sized to avoid layout shift', () => {
    const { container } = render(<Photo photo={record} sizes="50vw" fallback={<Art />} />);
    const img = screen.getByRole('img', { name: 'Vermilion gates' });
    expect(img).toHaveAttribute('srcset', image.srcSet);
    expect(img).toHaveAttribute('src', `${base}960px-Torii_path_at_dawn.jpg`);
    expect(img).toHaveAttribute('width', '4000');
    expect(img).toHaveAttribute('height', '2667');
    expect(container.firstChild).toHaveAttribute('data-live', 'true');
    expect(container.firstChild.style.getPropertyValue('--photo-focus')).toBe('50% 60%');
  });

  it('keeps the art under the picture while it travels, then sharpens in and lets the art go', () => {
    vi.useFakeTimers();
    const { container } = render(<Photo photo={record} fallback={<Art />} />);
    expect(container.querySelector('[data-photo-underlay]')).not.toBeNull();
    expect(screen.getByTestId('art')).toBeInTheDocument();
    fireEvent.load(container.querySelector('img'));
    expect(container.firstChild).toHaveAttribute('data-state', 'loaded');
    expect(container.querySelector('[data-photo-underlay]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector('[data-photo-underlay]')).toBeNull();
  });

  it('credits it with links to the Commons file page and the licence deed', () => {
    render(<Photo photo={record} credit="overlay" />);
    expect(screen.getByRole('link', { name: /Jane/ })).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Torii_path_at_dawn.jpg');
    expect(screen.getByRole('link', { name: /CC BY-SA 4\.0/ })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0');
  });

  it('falls back to the art if the picture fails to load', () => {
    const { container } = render(<Photo photo={record} fallback={<Art />} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.firstChild).toHaveAttribute('data-state', 'fallback');
    expect(container.querySelector('img')).toBeNull();
  });

  it('asks nothing of Wikimedia in tests (no network), so slots keep their art', () => {
    render(<Photo id="kyoto-senbon-torii" fallback={<Art />} />);
    expect(screen.getByTestId('art')).toBeInTheDocument();
  });
});
