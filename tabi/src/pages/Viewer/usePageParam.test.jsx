import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { usePageParam } from './usePageParam.js';

function Probe({ count }) {
  const [page, setPage] = usePageParam(count);
  return (
    <>
      <output data-testid="page">{page}</output>
      <button type="button" onClick={() => setPage(7)}>
        Turn to 7
      </button>
    </>
  );
}

function renderAt(hash, count = 11) {
  window.history.replaceState(null, '', hash);
  return render(
    <HashRouter>
      <Routes>
        <Route path="/brochures/:slug" element={<Probe count={count} />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </HashRouter>,
  );
}

const shown = () => Number(screen.getByTestId('page').textContent);

function typeHash(hash) {
  // What the address bar does: a new fragment, then hashchange.
  act(() => {
    window.history.pushState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

const turnTo7 = () => fireEvent.click(screen.getByRole('button', { name: 'Turn to 7' }));

afterEach(() => {
  window.history.replaceState(null, '', '#/');
});

describe('usePageParam', () => {
  it('opens the page named by ?p=', () => {
    renderAt('#/brochures/kyoto?p=4');
    expect(shown()).toBe(4);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=4');
  });

  it('rewrites an out-of-range ?p= to the page shown', () => {
    renderAt('#/brochures/kyoto?p=99');
    expect(shown()).toBe(10);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=10');
  });

  it('drops a malformed, negative or zero ?p=', () => {
    for (const p of ['abc', '-2', '0']) {
      const view = renderAt(`#/brochures/kyoto?p=${p}`);
      expect(shown()).toBe(0);
      expect(window.location.hash).toBe('#/brochures/kyoto');
      view.unmount();
    }
  });

  it('turns pages without a router navigation', () => {
    renderAt('#/brochures/kyoto?p=2');
    turnTo7();
    expect(shown()).toBe(7);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=7');
  });

  it('follows the original deep link when it is entered again', () => {
    renderAt('#/brochures/kyoto?p=2');
    turnTo7();
    typeHash('#/brochures/kyoto?p=2');
    expect(shown()).toBe(2);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=2');
  });

  it('canonicalises a new URL even when the page stays the same', () => {
    renderAt('#/brochures/kyoto?p=-2');
    expect(window.location.hash).toBe('#/brochures/kyoto');
    act(() => {
      window.history.pushState(null, '', '#/brochures/kyoto?p=abc');
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(shown()).toBe(0);
    expect(window.location.hash).toBe('#/brochures/kyoto');
  });

  it('clamps a typed page too, and ignores hashes of other routes', () => {
    renderAt('#/brochures/kyoto?p=3');
    typeHash('#/brochures/kyoto?p=42');
    expect(shown()).toBe(10);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=10');
    typeHash('#/brochures/tokyo?p=1');
    expect(shown()).toBe(10);
  });
});
