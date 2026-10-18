import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { readStorage, writeStorage } from '../lib/storage.js';

const ThemeContext = createContext(null);
const THEME_COLORS = { light: '#f3eee4', dark: '#0d0c0a' };
const STORAGE_KEY = 'theme';
const PREFERENCES = ['light', 'dark', 'system'];

/** A stored or requested preference, or 'system' for anything unexpected. */
export function normalizePreference(value) {
  return PREFERENCES.includes(value) ? value : 'system';
}

const readPreference = () => normalizePreference(readStorage(STORAGE_KEY, 'system'));

/**
 * Light / dark / system theme. The resolved theme is written to
 * <html data-theme="…"> so CSS tokens in tokens.css switch instantly.
 * index.html applies the saved value before React boots (no flash), and a
 * change made in another tab is picked up here (the `storage` event), like
 * favourites and brochures.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLORS[theme]);
    });
  }, [theme]);

  // Another tab changed (or cleared) the preference.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === null || event.key === `tabi:${STORAGE_KEY}`) setPreferenceState(readPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next) => {
    const value = normalizePreference(next);
    setPreferenceState(value);
    writeStorage(STORAGE_KEY, value);
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setPreference]);

  const value = useMemo(() => ({ theme, preference, setPreference, toggle }), [theme, preference, setPreference, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** { theme: 'light'|'dark', preference: 'light'|'dark'|'system', setPreference, toggle } */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
