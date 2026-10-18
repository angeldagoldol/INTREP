import { describe, expect, it } from 'vitest';
import { shortFactsChecked } from './factsChecked.js';

describe('shortFactsChecked', () => {
  it('abbreviates "<Month> <year>"', () => {
    expect(shortFactsChecked('October 2026')).toBe('Oct 2026');
    expect(shortFactsChecked(' september   2026 ')).toBe('Sep 2026');
    expect(shortFactsChecked('Sept. 2026')).toBe('Sep 2026');
    expect(shortFactsChecked('May 2027')).toBe('May 2027');
  });

  it('keeps other wording and drops blanks', () => {
    expect(shortFactsChecked('Spring 2026')).toBe('Spring 2026');
    expect(shortFactsChecked('2026-10-01')).toBe('2026-10-01');
    expect(shortFactsChecked('')).toBe('');
    expect(shortFactsChecked(undefined)).toBe('');
    expect(shortFactsChecked(42)).toBe('');
  });
});
