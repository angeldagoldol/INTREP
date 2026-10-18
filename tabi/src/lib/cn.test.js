import { cn } from './cn.js';

describe('cn', () => {
  it('joins strings, arrays and condition maps, skipping falsy values', () => {
    const hidden = false;
    expect(cn('a', hidden && 'b', null, undefined, '', 'c')).toBe('a c');
    expect(cn(['a', ['b', null]], { c: true, d: false })).toBe('a b c');
    expect(cn(0, 1)).toBe('1');
    expect(cn()).toBe('');
  });
});
