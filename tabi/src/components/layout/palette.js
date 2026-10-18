import { createContext, useContext } from 'react';

const noop = () => {};

/** Provided by <AppShell>; lets any page open the ⌘K command palette. */
export const PaletteContext = createContext({ isOpen: false, open: noop, close: noop, toggle: noop });

/**
 * Control the command palette from anywhere inside the shell:
 *   const { open } = usePalette();  <button onClick={open}>Search</button>
 */
export function usePalette() {
  return useContext(PaletteContext);
}
