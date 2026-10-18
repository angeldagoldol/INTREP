import { describe, expect, it } from 'vitest';
import { formatJapanTime, japanMonth, japanNow, msUntilNextMinute, seasonIdForMonth } from './japanTime.js';

describe('seasonIdForMonth', () => {
  it('follows the Japanese season calendar', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonIdForMonth)).toEqual([
      'winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter',
    ]);
  });
});

describe('japan time', () => {
  it('formats Tokyo time (UTC+9, no DST) regardless of the local zone', () => {
    expect(formatJapanTime(new Date('2026-10-17T12:04:00Z'))).toBe('21:04');
    expect(formatJapanTime(new Date('2026-06-30T15:30:00Z'))).toBe('00:30');
  });

  it('uses the month in Japan, which can differ from UTC', () => {
    expect(japanMonth(new Date('2026-11-30T16:00:00Z'))).toBe(12);
    const now = japanNow(new Date('2026-11-30T16:00:00Z'));
    expect(now.season.id).toBe('winter');
    expect(now.note).toBeTruthy();
  });

  it('describes an October evening as autumn', () => {
    const now = japanNow(new Date('2026-10-17T12:04:00Z'));
    expect(now).toMatchObject({ time: '21:04', month: 10 });
    expect(now.season).toMatchObject({ id: 'autumn', jp: '秋' });
  });

  it('computes the next minute boundary', () => {
    expect(msUntilNextMinute(new Date('2026-10-17T12:04:59.250Z'))).toBe(750);
  });
});
