import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NOTICE_SESSION_KEY } from './photoNotice.js';

/** A stand-in live resolver whose health the tests set. */
const store = vi.hoisted(() => {
  const listeners = new Set();
  const state = { health: null, bundled: 0, total: 213 };
  return {
    state,
    listeners,
    set(next) {
      Object.assign(state, next);
      for (const listener of [...listeners]) listener();
    },
    resume: vi.fn(),
  };
});

vi.mock('../../data/photos/index.js', () => ({
  livePhotos: { health: () => store.state.health, resume: store.resume },
  bundledCount: () => ({ bundled: store.state.bundled, total: store.state.total }),
  subscribePhotos: (listener) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
}));

const { default: PhotoNotice } = await import('./PhotoNotice.jsx');

const health = (over = {}) => ({ asked: 12, ready: 0, failed: 0, loading: 0, waiting: 12, enabled: true, online: true, blocked: false, transport: true, ...over });

describe('<PhotoNotice> — explaining placeholder art', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    store.state.bundled = 0;
    store.resume.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says nothing while photos are on their way or have arrived', () => {
    store.state.health = health({ loading: 12, waiting: 0 });
    render(<PhotoNotice />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('complementary')).toBeNull();
    act(() => store.set({ health: health({ ready: 12, waiting: 0 }) }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('appears once Commons is out of reach, explains the art and how to get the photos, and can be dismissed', () => {
    store.state.health = health({ blocked: true });
    render(<PhotoNotice />);
    expect(screen.queryByRole('complementary')).toBeNull(); // not before the reason has held for a moment
    act(() => vi.advanceTimersByTime(1500));
    const notice = screen.getByRole('complementary', { name: 'The photos couldn’t load' });
    expect(notice).toHaveTextContent('placeholder art, not photographs');
    expect(notice).toHaveTextContent('npm run photos:fetch');
    expect(window.sessionStorage.getItem(NOTICE_SESSION_KEY)).toBe('shown');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(store.resume).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the photo notice' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    // The problem coming back does not bring it back.
    act(() => store.set({ health: health({ online: false }) }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows at most once per session', () => {
    window.sessionStorage.setItem(NOTICE_SESSION_KEY, 'shown');
    store.state.health = health({ online: false });
    render(<PhotoNotice />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('goes away by itself when the photos arrive (live, or downloaded and bundled)', () => {
    store.state.health = health({ online: false });
    render(<PhotoNotice />);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('complementary', { name: 'You’re offline' })).toBeInTheDocument();
    // The download bundled every slot on screen: nothing is asked of Commons any more.
    act(() => store.set({ health: health({ asked: 0, waiting: 0, online: false }), bundled: 213 }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('offers to switch live photos back on when they are off', async () => {
    const setting = await import('../../data/photos/liveSetting.js');
    store.state.health = health({ enabled: false });
    render(<PhotoNotice />);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('complementary', { name: 'Photo loading is switched off' })).toBeInTheDocument();
    act(() => setting.setLivePhotosEnabled(false));
    fireEvent.click(screen.getByRole('button', { name: 'Turn photo loading on' }));
    expect(setting.livePhotosEnabled()).toBe(true);
  });
});
