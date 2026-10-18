import { render, screen } from '@testing-library/react';
import { PublishStamp } from './PublishStamp.jsx';

describe('<PublishStamp>', () => {
  it('stays out of the accessibility tree, so publishing is announced once, by its toast (regression)', () => {
    render(<PublishStamp kind="publish" title="Tokyo in 48 Hours" onDone={() => {}} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-live]')).toBeNull();
    const overlay = document.querySelector('[data-print="hide"]');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).toHaveTextContent('Published');
  });
});
