import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { ANNOUNCE_MS, ToastProvider, useToast } from './ToastContext.jsx';

// Exit animations would keep dismissed toasts in the DOM for a moment.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

function Trigger({ options }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      Notify
    </button>
  );
}

/** The visible stack (the announcer repeats a toast's text for a moment). */
const stack = () => within(screen.getByRole('list'));

function renderWith(options) {
  return render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
}

describe('ToastContext', () => {
  it('announces a toast in a labelled live region', async () => {
    const user = userEvent.setup();
    renderWith({ title: 'Saved', description: 'Your brochure is live.', tone: 'success' });
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveTextContent('Saved');
    expect(region).toHaveTextContent('Your brochure is live.');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role="alert" for errors', async () => {
    const user = userEvent.setup();
    renderWith({ title: 'Could not save', tone: 'error' });
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces each toast once, with no live region inside another (regression)', async () => {
    const user = userEvent.setup();
    renderWith({ title: 'Page deleted', description: '“Counter Japanese” was removed.', action: { label: 'Undo', onClick() {} } });
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const live = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')];
    for (const region of live) expect(region.parentElement.closest('[aria-live], [role="status"], [role="alert"], [role="log"]')).toBeNull();
    expect(live.filter((region) => region.textContent.includes('Page deleted'))).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Page deleted. “Counter Japanese” was removed.');
    // The toast itself stays reachable in the landmark, action included.
    const item = stack().getByText('Page deleted').closest('li');
    expect(item).not.toHaveAttribute('role');
    expect(within(item).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('clears the announcer shortly after, while the toast stays', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderWith({ title: 'Saved', duration: 0 });
      act(() => screen.getByRole('button', { name: 'Notify' }).click());
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
      act(() => vi.advanceTimersByTime(ANNOUNCE_MS + 10));
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(stack().getByText('Saved')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs the action and dismisses the toast', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWith({ title: 'Page deleted', action: { label: 'Undo', onClick }, duration: 0 });
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument());
  });

  it('dismisses on its own after the duration', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderWith({ title: 'Copied', duration: 1000 });
      act(() => screen.getByRole('button', { name: 'Notify' }).click());
      expect(stack().getByText('Copied')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1100));
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.queryByText('Copied')).not.toBeInTheDocument());
  });

  it('pauses while hovered or focused, then resumes (regression: WCAG 2.2.1)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderWith({ title: 'Page deleted', duration: 1000, action: { label: 'Undo', onClick: () => {} } });
      act(() => screen.getByRole('button', { name: 'Notify' }).click());
      const item = stack().getByText('Page deleted').closest('li');
      fireEvent.pointerEnter(item);
      act(() => vi.advanceTimersByTime(5000));
      expect(stack().getByText('Page deleted')).toBeInTheDocument();
      // Focus inside keeps it paused even after the pointer leaves.
      act(() => screen.getByRole('button', { name: 'Undo' }).focus());
      fireEvent.pointerLeave(item);
      act(() => vi.advanceTimersByTime(5000));
      expect(stack().getByText('Page deleted')).toBeInTheDocument();
      act(() => screen.getByRole('button', { name: 'Undo' }).blur());
      act(() => vi.advanceTimersByTime(1100));
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.queryByText('Page deleted')).not.toBeInTheDocument());
  });

  it('gives toasts with an action longer by default', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderWith({ title: 'Imported', action: { label: 'Undo', onClick: () => {} } });
      act(() => screen.getByRole('button', { name: 'Notify' }).click());
      act(() => vi.advanceTimersByTime(4300));
      expect(screen.getByText('Imported')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(6000));
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.queryByText('Imported')).not.toBeInTheDocument());
  });

  it('keeps at most four toasts on screen', async () => {
    const user = userEvent.setup();
    renderWith({ title: 'Ping', duration: 0 });
    const button = screen.getByRole('button', { name: 'Notify' });
    for (let i = 0; i < 6; i += 1) await user.click(button);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(4));
  });
});
