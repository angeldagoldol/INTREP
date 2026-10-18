import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { BROCHURES } from '../../data/brochures.js';
import { PrintPages } from './PrintPages.jsx';
import { imagesSettled, requestPrint } from './printBrochure.js';

const kyoto = BROCHURES.find((b) => b.slug === 'kyoto-thousand-gates');
// The same brochure with a photo of its own on every photo page (so there are <img>s to print).
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const withPhotos = {
  ...kyoto,
  userPhotos: { snap: { src: PIXEL, alt: 'A test photograph', width: 1, height: 1, credit: { author: 'Tester', license: 'CC0' } } },
  pages: kyoto.pages.map((page) => (page.type === 'photo' ? { ...page, photo: 'user:snap' } : page)),
};

afterEach(() => vi.restoreAllMocks());

describe('<PrintPages>', () => {
  it('exists only while printing', () => {
    const { container } = render(<PrintPages brochure={kyoto} />);
    expect(container.querySelectorAll('article')).toHaveLength(0);
    act(() => window.dispatchEvent(new Event('beforeprint')));
    expect(container.querySelectorAll('article')).toHaveLength(kyoto.pages.length);
    act(() => window.dispatchEvent(new Event('afterprint')));
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });

  it('draws every page with eager photos, waits for them, then opens the print dialog (the Print button)', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container } = render(<PrintPages brochure={withPhotos} />);
    // jsdom never loads images: they stay incomplete until the test says they have arrived.
    let arrived = false;
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(() => arrived);
    act(() => requestPrint());
    expect(container.querySelectorAll('article')).toHaveLength(kyoto.pages.length);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(print).not.toHaveBeenCalled(); // still waiting for the photographs
    arrived = true;
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    // Nothing in the print edition may wait to be scrolled into view: it is never on screen.
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThanOrEqual(3);
    for (const img of images) {
      expect(img).toHaveAttribute('loading', 'eager');
      expect(img).not.toHaveAttribute('srcset'); // the paper must not pick another, unloaded file
    }
  });

  it('takes over ⌘/Ctrl+P so the browser’s print gets the photographs too', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<PrintPages brochure={kyoto} />);
    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    // Other shortcuts are left alone.
    const shifted = new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    fireEvent(window, shifted);
    expect(shifted.defaultPrevented).toBe(false);
  });
});

describe('imagesSettled', () => {
  it('waits for images still loading, and gives up after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement('div');
      const img = document.createElement('img');
      let complete = false;
      Object.defineProperty(img, 'complete', { get: () => complete });
      root.append(img);
      let done = false;
      imagesSettled(root, 1000, { interval: 50 }).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(done).toBe(false);
      complete = true;
      await vi.advanceTimersByTimeAsync(60);
      expect(done).toBe(true);

      let late = false;
      complete = false;
      imagesSettled(root, 300, { interval: 50 }).then(() => {
        late = true;
      });
      await vi.advanceTimersByTimeAsync(400);
      expect(late).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
