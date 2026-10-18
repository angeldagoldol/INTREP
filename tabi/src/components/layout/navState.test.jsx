import { act, renderHook } from '@testing-library/react';
import { setNavHidden, useNavHidden } from './navState.js';

describe('navState', () => {
  afterEach(() => act(() => setNavHidden(false)));

  it('shares the navbar visibility with subscribers', () => {
    const { result } = renderHook(() => useNavHidden());
    expect(result.current).toBe(false);
    act(() => setNavHidden(true));
    expect(result.current).toBe(true);
    act(() => setNavHidden(0));
    expect(result.current).toBe(false);
  });
});
