import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { livePhotosEnabled, setLivePhotosEnabled } from '../../data/photos/liveSetting.js';
import { LivePhotosToggle } from './LivePhotosToggle.jsx';

describe('"Load photos from Wikimedia Commons"', () => {
  it('is on by default and remembers being switched off', () => {
    act(() => setLivePhotosEnabled(true));
    render(<LivePhotosToggle />);
    const toggle = screen.getByRole('switch', { name: 'Load photos from Wikimedia Commons' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/fetches the photographs from Wikimedia’s servers/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(livePhotosEnabled()).toBe(false);
    expect(window.localStorage.getItem('tabi:live-photos-enabled')).toBe('false');
    expect(screen.getByText(/nothing is requested from Wikimedia/)).toBeInTheDocument();
    act(() => setLivePhotosEnabled(true));
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('follows a change made in another tab', () => {
    act(() => setLivePhotosEnabled(true));
    render(<LivePhotosToggle note={false} />);
    window.localStorage.setItem('tabi:live-photos-enabled', 'false');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'tabi:live-photos-enabled' }));
    });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    act(() => setLivePhotosEnabled(true));
  });
});
