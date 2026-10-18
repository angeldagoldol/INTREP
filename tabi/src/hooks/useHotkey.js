import { useEffect, useRef } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** "mod+shift+k" -> { mods: ['mod', 'shift'], key: 'k' }. A trailing "+" is the plus key ("+", "mod++"). */
export function parseCombo(combo) {
  const lower = String(combo).toLowerCase().trim();
  if (lower === '+') return { mods: [], key: '+' };
  if (lower.endsWith('++')) return { mods: lower.slice(0, -2).split('+').map((p) => p.trim()), key: '+' };
  const parts = lower.split('+').map((p) => p.trim());
  const key = parts.pop();
  return { mods: parts, key };
}

/**
 * Does a KeyboardEvent match `combo`? `mod` is ⌘ on Mac and Ctrl elsewhere.
 * Shift is only enforced for named keys ("shift+ArrowLeft"): printable keys
 * like "?" or "+" already encode it in `event.key`.
 */
export function matchesHotkey(event, combo, mac = isMac) {
  const { mods, key } = parseCombo(combo);
  const want = { mod: mods.includes('mod'), shift: mods.includes('shift'), alt: mods.includes('alt') };
  const modPressed = mac ? event.metaKey : event.ctrlKey;
  if (want.mod !== Boolean(modPressed)) return false;
  if (want.shift !== Boolean(event.shiftKey) && key.length > 1) return false;
  if (want.alt !== Boolean(event.altKey)) return false;
  return String(event.key).toLowerCase() === key || String(event.code).toLowerCase() === key;
}

/**
 * Bind a keyboard shortcut.
 *   useHotkey('mod+k', openPalette)          // ⌘K on Mac, Ctrl+K elsewhere
 *   useHotkey(['ArrowRight', 'l'], next)     // several combos
 *   useHotkey('/', focusSearch)              // ignored while typing in a field
 *   useHotkey(['+', '-'], zoom)              // a trailing "+" means the plus key
 * Options: { enabled = true, allowInInputs = false, preventDefault = true }
 */
export function useHotkey(combos, handler, options = {}) {
  const { enabled = true, allowInInputs = false, preventDefault = true } = options;
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  const key = Array.isArray(combos) ? combos.join('|') : combos;

  useEffect(() => {
    if (!enabled) return undefined;
    const list = key.split('|');
    const onKeyDown = (event) => {
      if (event.defaultPrevented && !allowInInputs) return;
      const hasModifier = /mod\+|alt\+/i.test(key);
      if (!allowInInputs && !hasModifier && isTypingTarget(event.target)) return;
      if (list.some((combo) => matchesHotkey(event, combo))) {
        if (preventDefault) event.preventDefault();
        handlerRef.current?.(event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, enabled, allowInInputs, preventDefault]);
}

export const modKeyLabel = isMac ? '⌘' : 'Ctrl';
