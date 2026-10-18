import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext.jsx';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import PalettePanel from './PalettePanel.jsx';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

describe('<PalettePanel>', () => {
  it('adds no contentinfo landmark next to the site footer (regression)', async () => {
    render(
      <ThemeProvider>
        <BrochureProvider>
          <MemoryRouter>
            <PalettePanel onClose={() => {}} />
          </MemoryRouter>
        </BrochureProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(document.querySelector('footer')).toBeNull();
  });
});
