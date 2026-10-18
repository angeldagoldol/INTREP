import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { BROCHURES } from '../../data/brochures.js';
import { TripPlanner } from './TripPlanner.jsx';

const kyoto = BROCHURES.find((b) => b.slug === 'kyoto-thousand-gates');
const other = BROCHURES.find((b) => b.slug === 'tokyo-after-dark');

function renderPlanner(brochure = kyoto) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <BrochureProvider>
          <TripPlanner open onClose={() => {}} brochure={brochure} />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const stored = () => JSON.parse(window.localStorage.getItem('tabi:trips') ?? 'null');

describe('<TripPlanner>', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });
  afterEach(() => window.localStorage.clear());

  it('says plainly that nothing is sent and asks for no contact details', () => {
    renderPlanner();
    const dialog = screen.getByRole('dialog', { name: 'Plan this trip' });
    expect(dialog).toHaveAccessibleDescription(/kept in this browser\. Nothing is sent and no one will contact you/);
    expect(within(dialog).queryByLabelText(/email/i)).toBeNull();
    expect(within(dialog).queryByLabelText(/name/i)).toBeNull();
    expect(dialog).not.toHaveTextContent(/inquiry|reply|get back to you/i);
  });

  it('saves a plan to this device and lists it, ready to edit', async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.type(screen.getByLabelText('Notes'), 'Fushimi Inari at dawn');
    await user.click(screen.getByRole('button', { name: 'One more traveller' }));
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    const [plan] = stored();
    expect(plan).toMatchObject({ brochureId: kyoto.id, travellers: 3, notes: 'Fushimi Inari at dawn', start: '', end: '' });
    const saved = screen.getByRole('region', { name: /Saved on this device/ });
    expect(within(saved).getByText('Fushimi Inari at dawn')).toBeInTheDocument();
    expect(within(saved).getByText('Dates open')).toBeInTheDocument();

    await user.click(within(saved).getByRole('button', { name: 'Edit plan: Dates open' }));
    expect(screen.getByLabelText('Notes')).toHaveValue('Fushimi Inari at dawn');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('flags an end date without a start and saves nothing', async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.type(screen.getByLabelText('Last day'), '2030-01-02');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));
    expect(screen.getByText('Add the day you arrive first.')).toBeInTheDocument();
    expect(stored()).toBeNull();
  });

  it('deletes a plan and lists plans for other brochures as links', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'tabi:trips',
      JSON.stringify([
        { id: 'trip_a', brochureId: kyoto.id, brochureSlug: kyoto.slug, brochureTitle: kyoto.title, start: '', end: '', travellers: 2, interests: [], notes: '', createdAt: '2026-10-01T00:00:00Z' },
        { id: 'trip_b', brochureId: other.id, brochureSlug: other.slug, brochureTitle: other.title, start: '', end: '', travellers: 1, interests: [], notes: '', createdAt: '2026-10-01T00:00:00Z' },
      ]),
    );
    renderPlanner();
    expect(screen.getByRole('link', { name: new RegExp(other.title) })).toHaveAttribute('href', `/brochures/${other.slug}`);
    await user.click(screen.getByRole('button', { name: 'Delete plan: Dates open' }));
    expect(stored().map((p) => p.id)).toEqual(['trip_b']);
  });

  it('turns old inquiries into plans and forgets their contact details', () => {
    window.localStorage.setItem(
      'tabi:inquiries',
      JSON.stringify([{ id: 'inq_1', brochureId: kyoto.id, brochureSlug: kyoto.slug, name: 'Aiko', email: 'aiko@example.com', month: '2027-04', travellers: 2, interests: [], message: '' }]),
    );
    renderPlanner();
    expect(window.localStorage.getItem('tabi:inquiries')).toBeNull();
    expect(JSON.stringify(stored())).not.toMatch(/aiko/i);
    expect(screen.getByText('Travel month: April 2027')).toBeInTheDocument();
  });

  it('links to the official sites in a new tab', () => {
    renderPlanner();
    const links = within(screen.getByRole('region', { name: /Check before you go/ })).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    }
  });
});
