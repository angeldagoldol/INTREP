import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { CommandPalette } from './CommandPalette.jsx';

// The panel chunk is broken (as when it cannot be downloaded or fails to render).
vi.mock('./PalettePanel.jsx', () => ({
  default: function BrokenPanel() {
    throw new Error('Failed to fetch dynamically imported module: /assets/PalettePanel-x.js');
  },
}));

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open search
      </button>
      <p>{open ? 'palette open' : 'palette closed'}</p>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe('<CommandPalette>', () => {
  it('closes with a toast instead of unmounting the app when the panel fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open search' }));
    expect(await screen.findByText('Search didn’t load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByText('palette closed')).toBeInTheDocument();
    // The app is still alive and the palette can be asked for again.
    await user.click(screen.getByRole('button', { name: 'Open search' }));
    expect(await screen.findByText('palette closed')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
