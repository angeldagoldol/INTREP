import { fireEvent, render, renderHook } from '@testing-library/react';
import { matchesHotkey, parseCombo, useHotkey } from './useHotkey.js';

const key = (init) => ({ key: '', code: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init });

describe('parseCombo', () => {
  it('splits modifiers from the key', () => {
    expect(parseCombo('mod+shift+K')).toEqual({ mods: ['mod', 'shift'], key: 'k' });
    expect(parseCombo('ArrowRight')).toEqual({ mods: [], key: 'arrowright' });
  });

  it('reads a trailing "+" as the plus key', () => {
    expect(parseCombo('+')).toEqual({ mods: [], key: '+' });
    expect(parseCombo('mod++')).toEqual({ mods: ['mod'], key: '+' });
  });
});

describe('matchesHotkey', () => {
  it('maps "mod" to ⌘ on Mac and Ctrl elsewhere', () => {
    expect(matchesHotkey(key({ key: 'k', metaKey: true }), 'mod+k', true)).toBe(true);
    expect(matchesHotkey(key({ key: 'k', ctrlKey: true }), 'mod+k', true)).toBe(false);
    expect(matchesHotkey(key({ key: 'k', ctrlKey: true }), 'mod+k', false)).toBe(true);
    expect(matchesHotkey(key({ key: 'k' }), 'mod+k', false)).toBe(false);
  });

  it('only enforces shift for named keys', () => {
    expect(matchesHotkey(key({ key: '?', shiftKey: true }), '?')).toBe(true);
    expect(matchesHotkey(key({ key: '+', shiftKey: true, code: 'Equal' }), '+')).toBe(true);
    expect(matchesHotkey(key({ key: 'ArrowLeft', shiftKey: true }), 'ArrowLeft')).toBe(false);
    expect(matchesHotkey(key({ key: 'ArrowLeft', shiftKey: true }), 'shift+ArrowLeft')).toBe(true);
  });

  it('matches by key or physical code', () => {
    expect(matchesHotkey(key({ key: '=', code: 'Equal' }), 'Equal')).toBe(true);
    expect(matchesHotkey(key({ key: 'z', altKey: true }), 'z')).toBe(false);
  });
});

describe('useHotkey', () => {
  it('fires on the bound key and ignores typing in fields', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['/', 'ArrowRight'], handler));
    const { getByRole } = render(<input aria-label="Search" />);

    fireEvent.keyDown(window, { key: '/' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(getByRole('textbox'), { key: '/' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('still fires modifier shortcuts inside fields when allowed', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+k', handler, { allowInInputs: true }));
    const { getByRole } = render(<input aria-label="Search" />);
    fireEvent.keyDown(getByRole('textbox'), { key: 'k', ctrlKey: true, metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('Escape', handler, { enabled: false }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });
});
