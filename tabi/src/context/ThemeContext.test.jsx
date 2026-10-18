import { act, renderHook } from '@testing-library/react';
import { ThemeProvider, normalizePreference, useTheme } from './ThemeContext.jsx';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

function mockSystemDark(dark) {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return () => {
    window.matchMedia = original;
  };
}

describe('ThemeContext', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('follows the system by default and writes data-theme on <html>', () => {
    const restore = mockSystemDark(true);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    restore();
  });

  it('remembers an explicit choice and toggles between light and dark', () => {
    const restore = mockSystemDark(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    act(() => result.current.setPreference('dark'));
    expect(result.current.theme).toBe('dark');
    expect(JSON.parse(window.localStorage.getItem('tabi:theme'))).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => result.current.toggle());
    expect(result.current.preference).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    restore();
  });

  it('starts from the saved preference', () => {
    window.localStorage.setItem('tabi:theme', JSON.stringify('dark'));
    const restore = mockSystemDark(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe('dark');
    expect(result.current.theme).toBe('dark');
    restore();
  });

  it('follows a theme change made in another tab, and a cleared storage back to the system', () => {
    const restore = mockSystemDark(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    // Another tab toggled to dark: storage holds the new value and a storage event fires here.
    window.localStorage.setItem('tabi:theme', JSON.stringify('dark'));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'tabi:theme', newValue: '"dark"', storageArea: window.localStorage }));
    });
    expect(result.current.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    // Unrelated keys are ignored; clearing all storage (key null) means "follow the system".
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'tabi:favorites', newValue: '[]', storageArea: window.localStorage }));
    });
    expect(result.current.preference).toBe('dark');
    window.localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: window.localStorage }));
    });
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('light');
    restore();
  });

  it('can go back to following the system after a toggle', () => {
    const restore = mockSystemDark(true);
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggle());
    expect(result.current.preference).toBe('light');
    act(() => result.current.setPreference('system'));
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('dark');
    expect(JSON.parse(window.localStorage.getItem('tabi:theme'))).toBe('system');
    restore();
  });

  it('treats an unknown stored preference as "system"', () => {
    window.localStorage.setItem('tabi:theme', JSON.stringify('sepia'));
    const restore = mockSystemDark(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('light');
    expect(normalizePreference('dark')).toBe('dark');
    expect(normalizePreference({})).toBe('system');
    restore();
  });
});
