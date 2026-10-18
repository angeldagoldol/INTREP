import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useClipboard } from './useClipboard.js';
import { useDocumentTitle } from './useDocumentTitle.js';
import { useFocusTrap } from './useFocusTrap.js';
import { useLockBodyScroll } from './useLockBodyScroll.js';
import { useMediaQuery } from './useMediaQuery.js';
import { useMinuteClock } from './useMinuteClock.js';

describe('useDocumentTitle', () => {
  it('sets a page title and restores the previous one', () => {
    document.title = 'Before';
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), { initialProps: { title: 'Library' } });
    expect(document.title).toBe('Library — Tabi');
    rerender({ title: null });
    expect(document.title).toBe('Tabi — Japan, folded into pages');
    unmount();
    expect(document.title).toBe('Before');
  });
});

describe('useLockBodyScroll', () => {
  it('reference-counts stacked overlays', () => {
    const a = renderHook(({ on }) => useLockBodyScroll(on), { initialProps: { on: true } });
    const b = renderHook(({ on }) => useLockBodyScroll(on), { initialProps: { on: true } });
    expect(document.body.style.overflow).toBe('hidden');
    a.rerender({ on: false });
    expect(document.body.style.overflow).toBe('hidden');
    b.unmount();
    expect(document.body.style.overflow).toBe('');
    a.unmount();
  });
});

describe('useMediaQuery', () => {
  it('returns false without a matching media query', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 99999px)'));
    expect(result.current).toBe(false);
  });
});

describe('useClipboard', () => {
  it('copies text and flips `copied`', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { result } = renderHook(() => useClipboard(50));
    let ok;
    await act(async () => {
      ok = await result.current.copy('https://tabi.example/#/brochures/kyoto');
    });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://tabi.example/#/brochures/kyoto');
    expect(result.current.copied).toBe(true);
    delete navigator.clipboard;
  });

  it('reports failure instead of throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    const { result } = renderHook(() => useClipboard());
    let ok;
    await act(async () => {
      ok = await result.current.copy('x');
    });
    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
    delete navigator.clipboard;
  });

  it('falls back to execCommand when the Clipboard API refuses, and gives focus back', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Write permission denied')) },
      configurable: true,
    });
    let copiedText = null;
    document.execCommand = vi.fn(() => {
      copiedText = document.querySelector('textarea')?.value ?? null;
      return true;
    });
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const { result } = renderHook(() => useClipboard());
    let ok;
    await act(async () => {
      ok = await result.current.copy('https://tabi.example/#/brochures/hakone?p=9');
    });
    expect(ok).toBe(true);
    expect(copiedText).toBe('https://tabi.example/#/brochures/hakone?p=9');
    expect(result.current.copied).toBe(true);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(button);
    button.remove();
    delete document.execCommand;
    delete navigator.clipboard;
  });

  it('reports failure when execCommand copies nothing', async () => {
    document.execCommand = vi.fn(() => false);
    const { result } = renderHook(() => useClipboard());
    let ok;
    await act(async () => {
      ok = await result.current.copy('x');
    });
    expect(ok).toBe(false);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    delete document.execCommand;
  });
});

function Trap({ active }) {
  const ref = useRef(null);
  useFocusTrap(ref, active);
  return (
    <div ref={ref}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('wraps Tab inside the container and restores focus on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    // jsdom has no layout, so give the buttons an offsetParent.
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    const { rerender } = render(<Trap active />);
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    rerender(<Trap active={false} />);
    expect(document.activeElement).toBe(opener);
    spy.mockRestore();
    opener.remove();
  });
});

describe('useMinuteClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks on each minute boundary without drifting, and on returning to the tab', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T12:04:59.250Z'));
    const { result, unmount } = renderHook(() => useMinuteClock());
    expect(result.current.toISOString()).toBe('2026-10-17T12:04:59.250Z');
    act(() => vi.advanceTimersByTime(750));
    expect(result.current.toISOString()).toBe('2026-10-17T12:05:00.000Z');
    act(() => vi.advanceTimersByTime(60_000 * 3));
    expect(result.current.toISOString()).toBe('2026-10-17T12:08:00.000Z');
    // A throttled background tab catches up as soon as it is visible again.
    vi.setSystemTime(new Date('2026-10-17T12:30:10.000Z'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.toISOString()).toBe('2026-10-17T12:30:10.000Z');
    act(() => vi.advanceTimersByTime(50_000));
    expect(result.current.toISOString()).toBe('2026-10-17T12:31:00.000Z');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
