import { afterEach, describe, expect, it } from 'vitest';
import { pageParamFromHash, withHashParam, writePageToHash } from './hashParams.js';

describe('withHashParam', () => {
  it('adds a parameter to a hash route', () => {
    expect(withHashParam('#/brochures/kyoto', 'p', '4')).toBe('#/brochures/kyoto?p=4');
  });

  it('replaces an existing value and keeps the others in order', () => {
    expect(withHashParam('#/brochures/kyoto?ref=home&p=3', 'p', '7')).toBe('#/brochures/kyoto?ref=home&p=7');
  });

  it('removes the parameter (and a now-empty query)', () => {
    expect(withHashParam('#/brochures/kyoto?p=3', 'p', null)).toBe('#/brochures/kyoto');
    expect(withHashParam('#/brochures/kyoto?ref=x&p=3', 'p', null)).toBe('#/brochures/kyoto?ref=x');
  });

  it('copes with an empty hash', () => {
    expect(withHashParam('', 'p', '2')).toBe('#/?p=2');
  });
});

describe('pageParamFromHash', () => {
  it('reads ?p= of the given route', () => {
    expect(pageParamFromHash('#/brochures/kyoto?p=2', '/brochures/kyoto')).toBe('2');
    expect(pageParamFromHash('#/brochures/kyoto?ref=x&p=abc', '/brochures/kyoto')).toBe('abc');
  });

  it('returns null without a page parameter', () => {
    expect(pageParamFromHash('#/brochures/kyoto', '/brochures/kyoto')).toBeNull();
  });

  it('ignores other routes', () => {
    expect(pageParamFromHash('#/brochures/tokyo?p=2', '/brochures/kyoto')).toBeUndefined();
    expect(pageParamFromHash('#/studio?draft=1', '/brochures/kyoto')).toBeUndefined();
  });

  it('matches percent-encoded and decoded paths alike', () => {
    expect(pageParamFromHash('#/brochures/%E4%BA%AC%E9%83%BD?p=3', '/brochures/京都')).toBe('3');
    expect(pageParamFromHash('#/brochures/京都?p=3', '/brochures/%E4%BA%AC%E9%83%BD')).toBe('3');
    expect(pageParamFromHash('#/brochures/%E0%A4?p=1', '/brochures/%E0%A4')).toBe('1');
  });
});

describe('writePageToHash', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/');
  });

  it('rewrites an out-of-range or malformed ?p= to the page shown', () => {
    window.history.replaceState({ idx: 3 }, '', '#/brochures/kyoto?p=99');
    writePageToHash(10);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=10');
    expect(window.history.state).toEqual({ idx: 3 });
  });

  it('drops the parameter on the first page', () => {
    window.history.replaceState(null, '', '#/brochures/kyoto?p=abc');
    writePageToHash(0);
    expect(window.location.hash).toBe('#/brochures/kyoto');
  });

  it('leaves a canonical URL untouched', () => {
    window.history.replaceState(null, '', '#/brochures/kyoto?p=4');
    const before = window.history.length;
    writePageToHash(4);
    expect(window.location.hash).toBe('#/brochures/kyoto?p=4');
    expect(window.history.length).toBe(before);
  });
});
