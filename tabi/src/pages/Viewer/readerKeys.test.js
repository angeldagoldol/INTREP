import { describe, expect, it } from 'vitest';
import { matchesHotkey } from '../../hooks/useHotkey.js';
import { isMostlyVisible, ownsPageKeys, READER_KEYS } from './readerKeys.js';

const press = (init) => new KeyboardEvent('keydown', init);
const matchesAny = (event, combos) => combos.some((combo) => matchesHotkey(event, combo, false));

describe('READER_KEYS zoom bindings', () => {
  it('zoom in on the "+" character whatever key produces it', () => {
    expect(matchesAny(press({ key: '+', code: 'Equal', shiftKey: true }), READER_KEYS.zoomIn)).toBe(true); // US
    expect(matchesAny(press({ key: '+', code: 'Semicolon', shiftKey: true }), READER_KEYS.zoomIn)).toBe(true); // JIS
    expect(matchesAny(press({ key: '+', code: 'BracketRight' }), READER_KEYS.zoomIn)).toBe(true); // German
    expect(matchesAny(press({ key: '+', code: 'NumpadAdd' }), READER_KEYS.zoomIn)).toBe(true);
    expect(matchesAny(press({ key: '=', code: 'Equal' }), READER_KEYS.zoomIn)).toBe(true); // unshifted US
  });

  it('ignore the character that merely sits on the US "=" key elsewhere', () => {
    expect(matchesAny(press({ key: '^', code: 'Equal' }), READER_KEYS.zoomIn)).toBe(false); // JIS
    expect(matchesAny(press({ key: '´', code: 'Equal' }), READER_KEYS.zoomIn)).toBe(false); // German
    expect(matchesAny(press({ key: 'ß', code: 'Minus' }), READER_KEYS.zoomOut)).toBe(false);
  });

  it('zoom out and reset on "-" and "0", including the number pad', () => {
    expect(matchesAny(press({ key: '-', code: 'Minus' }), READER_KEYS.zoomOut)).toBe(true);
    expect(matchesAny(press({ key: '-', code: 'NumpadSubtract' }), READER_KEYS.zoomOut)).toBe(true);
    expect(matchesAny(press({ key: '0', code: 'Digit0' }), READER_KEYS.zoomReset)).toBe(true);
    expect(matchesAny(press({ key: '0', code: 'Numpad0' }), READER_KEYS.zoomReset)).toBe(true);
    expect(matchesAny(press({ key: 'à', code: 'Digit0' }), READER_KEYS.zoomReset)).toBe(false); // AZERTY, unshifted
  });

  it('leave browser zoom (Ctrl/⌘ with + − 0) alone', () => {
    expect(matchesAny(press({ key: '+', code: 'Equal', ctrlKey: true }), READER_KEYS.zoomIn)).toBe(false);
    expect(matchesAny(press({ key: '0', code: 'Digit0', ctrlKey: true }), READER_KEYS.zoomReset)).toBe(false);
  });
});

describe('isMostlyVisible', () => {
  it('needs half of a reader that fits the viewport', () => {
    expect(isMostlyVisible({ visible: 420, height: 840, viewport: 900 })).toBe(true);
    expect(isMostlyVisible({ visible: 300, height: 840, viewport: 900 })).toBe(false);
  });

  it('needs half of the viewport when the reader is taller', () => {
    expect(isMostlyVisible({ visible: 330, height: 540, viewport: 390 })).toBe(true);
    expect(isMostlyVisible({ visible: 150, height: 540, viewport: 390 })).toBe(false);
  });

  it('is false once the reader has left the screen', () => {
    expect(isMostlyVisible({ visible: 0, height: 840, viewport: 900 })).toBe(false);
    expect(isMostlyVisible({ visible: Number.NaN, height: 840, viewport: 900 })).toBe(false);
  });
});

describe('ownsPageKeys', () => {
  const page = document.createElement('main');
  const reader = document.createElement('section');
  const button = document.createElement('button');
  const about = document.createElement('a');
  reader.append(button);
  page.append(reader, about);
  document.body.append(page);

  it('takes the keys from the page itself and from inside the reader', () => {
    expect(ownsPageKeys(document.body, reader)).toBe(true);
    expect(ownsPageKeys(page, reader)).toBe(true);
    expect(ownsPageKeys(button, reader)).toBe(true);
  });

  it('leaves them to the document when focus is elsewhere', () => {
    expect(ownsPageKeys(about, reader)).toBe(false);
    expect(ownsPageKeys(null, reader)).toBe(false);
    expect(ownsPageKeys(button, null)).toBe(false);
  });
});
