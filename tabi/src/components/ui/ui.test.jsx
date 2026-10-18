import { render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { Field, Input } from './Field.jsx';
import { Drawer, Modal } from './Overlay.jsx';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

/** Every id an element's aria-describedby names, resolved (null when missing). */
function describedByTargets(element) {
  const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id));
}

describe('<Field>', () => {
  it('describes the control with its hint', () => {
    render(
      <Field label="Email" hint="We never share it">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('points only at the error once it replaces the hint (regression)', () => {
    render(
      <Field label="Email" hint="We never share it" error="Enter a valid email">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    const targets = describedByTargets(input);
    expect(targets).toHaveLength(1);
    expect(targets).not.toContain(null);
    expect(input).toHaveAccessibleDescription('Enter a valid email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });

  it('sets no aria-describedby when there is nothing to describe', () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });
});

describe('<Modal> and <Drawer>', () => {
  it('add no banner or contentinfo landmark next to the page’s own (regression)', () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Publish" description="Check it first" footer={<button type="button">Publish</button>}>
          <p>Body</p>
        </Modal>
        <Drawer open onClose={() => {}} title="Plan this trip" footer={<button type="button">Send</button>}>
          <p>Form</p>
        </Drawer>
      </>,
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(document.querySelector('header, footer')).toBeNull();
    // Title, description and footer still render.
    expect(screen.getByRole('dialog', { name: 'Publish' })).toHaveAccessibleDescription('Check it first');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
