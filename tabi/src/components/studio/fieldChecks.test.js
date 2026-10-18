// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  JAPAN_AREAS,
  coordinateCheck,
  describeCoords,
  inJapan,
  monthYear,
  parseCoordinatePair,
  readNumber,
  roundCoord,
  urlCheck,
} from './fieldChecks.js';

describe('inJapan', () => {
  it('knows real places in Japan, from Hokkaidō to the far islands, from points abroad', () => {
    expect(inJapan(34.9671, 135.7727)).toBe(true); // Kyoto
    expect(inJapan(26.2124, 127.6809)).toBe(true); // Naha
    expect(inJapan(43.0618, 141.3545)).toBe(true); // Sapporo
    expect(inJapan(27.0941, 142.1918)).toBe(true); // Chichijima, Ogasawara
    expect(inJapan(24.4672, 122.9877)).toBe(true); // Yonaguni
    expect(inJapan(20.4253, 136.0814)).toBe(true); // Okinotorishima
    expect(inJapan(24.2867, 153.9807)).toBe(true); // Minamitorishima
    expect(inJapan(51.5074, -0.1278)).toBe(false); // London
    expect(inJapan(37.5665, 126.978)).toBe(false); // Seoul
    expect(inJapan(25.033, 121.5654)).toBe(false); // Taipei
  });

  it('every area lies within Japan’s extremes (20–46° N, 122–155° E)', () => {
    for (const { bounds: [west, south, east, north] } of JAPAN_AREAS) {
      expect(west).toBeGreaterThanOrEqual(122);
      expect(east).toBeLessThanOrEqual(155);
      expect(south).toBeGreaterThanOrEqual(20);
      expect(north).toBeLessThanOrEqual(46);
    }
  });
});

describe('readNumber / roundCoord', () => {
  it('reads numbers and numeric strings only', () => {
    expect(readNumber(35.1)).toBe(35.1);
    expect(readNumber(' 35.1 ')).toBe(35.1);
    expect(readNumber('')).toBeNull();
    expect(readNumber('abc')).toBeNull();
    expect(readNumber(Number.NaN)).toBeNull();
    expect(readNumber(null)).toBeNull();
  });

  it('rounds to four decimals', () => {
    expect(roundCoord(34.967149)).toBe(34.9671);
    expect(roundCoord(-0.00001)).toBe(0);
  });
});

describe('coordinateCheck', () => {
  it('accepts points in Japan, including Okinawa', () => {
    expect(coordinateCheck(34.9671, 135.7727)).toMatchObject({ state: 'ok', tone: 'ok' });
    expect(coordinateCheck('26.2124', '127.6809')).toMatchObject({ state: 'ok' });
  });

  it('allows empty coordinates but asks for the missing half', () => {
    expect(coordinateCheck('', undefined)).toMatchObject({ state: 'empty', tone: 'info' });
    expect(coordinateCheck(35, '')).toMatchObject({ state: 'partial', message: expect.stringMatching(/longitude/) });
    expect(coordinateCheck('', 135)).toMatchObject({ state: 'partial', message: expect.stringMatching(/latitude/) });
  });

  it('rejects impossible values', () => {
    expect(coordinateCheck(35.7, 200)).toMatchObject({ state: 'invalid', tone: 'error', message: expect.stringMatching(/Longitude/) });
    expect(coordinateCheck(95, 10)).toMatchObject({ state: 'invalid', message: expect.stringMatching(/Latitude/) });
  });

  it('spots a pair typed the wrong way round and offers the fix', () => {
    expect(coordinateCheck(135.7727, 34.9671)).toMatchObject({ state: 'swapped', tone: 'warning', fix: { lat: 34.9671, lng: 135.7727 } });
  });

  it('warns about points outside Japan', () => {
    expect(coordinateCheck(48.8566, 2.3522)).toMatchObject({ state: 'outside', tone: 'warning' });
    expect(coordinateCheck(35.6812, 33)).toMatchObject({ state: 'outside' });
  });
});

describe('parseCoordinatePair', () => {
  it('reads decimal pairs', () => {
    expect(parseCoordinatePair('34.9671, 135.7727')).toEqual({ lat: 34.9671, lng: 135.7727 });
    expect(parseCoordinatePair('34.96714 135.77271')).toEqual({ lat: 34.9671, lng: 135.7727 });
    expect(parseCoordinatePair(' -33.8688 ; 151.2093 ')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('turns a longitude-first pair round when only one order is possible', () => {
    expect(parseCoordinatePair('135.7727, 34.9671')).toEqual({ lat: 34.9671, lng: 135.7727 });
  });

  it('reads hemispheres, degrees, minutes and seconds', () => {
    expect(parseCoordinatePair('34.9671° N, 135.7727° E')).toEqual({ lat: 34.9671, lng: 135.7727 });
    expect(parseCoordinatePair(`34°58'01.6"N 135°46'21.7"E`)).toEqual({ lat: 34.9671, lng: 135.7727 });
    expect(parseCoordinatePair('135.7727 E, 34.9671 N')).toEqual({ lat: 34.9671, lng: 135.7727 });
    expect(parseCoordinatePair('33.8688 S 151.2093 E')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('reads map links', () => {
    expect(parseCoordinatePair('https://www.google.com/maps/place/Kiyomizu/@34.9948561,135.7850463,17z/data=x')).toEqual({ lat: 34.9949, lng: 135.785 });
    expect(parseCoordinatePair('https://maps.example/?q=35.6812,139.7671')).toEqual({ lat: 35.6812, lng: 139.7671 });
    expect(parseCoordinatePair('https://example.com/no-coords')).toBeNull();
  });

  it('ignores anything that is not a pair', () => {
    expect(parseCoordinatePair('34.9671')).toBeNull();
    expect(parseCoordinatePair('Kiyomizu-dera')).toBeNull();
    expect(parseCoordinatePair('200, 300')).toBeNull();
    expect(parseCoordinatePair(42)).toBeNull();
    expect(parseCoordinatePair(`34°75'N 135°E`)).toBeNull();
  });
});

describe('describeCoords', () => {
  it('spells out hemispheres', () => {
    expect(describeCoords(34.9671, 135.7727)).toBe('34.9671° N, 135.7727° E');
    expect(describeCoords(-33.8688, -70.5)).toBe('33.8688° S, 70.5000° W');
    expect(describeCoords('', 1)).toBe('');
  });
});

describe('urlCheck', () => {
  it('accepts https links and names their host', () => {
    expect(urlCheck('https://www.kiyomizudera.or.jp/en/')).toMatchObject({ state: 'ok', host: 'kiyomizudera.or.jp' });
    expect(urlCheck('')).toMatchObject({ state: 'empty' });
    expect(urlCheck('   ')).toMatchObject({ state: 'empty' });
  });

  it('asks for https instead of http, with the fix', () => {
    expect(urlCheck('http://example.jp/page')).toMatchObject({ state: 'http', tone: 'warning', fix: 'https://example.jp/page' });
  });

  it('adds the scheme to a bare address', () => {
    expect(urlCheck('www.japan.travel/en/')).toMatchObject({ state: 'bare', fix: 'https://www.japan.travel/en/' });
    expect(urlCheck('kuromon.com')).toMatchObject({ state: 'bare', fix: 'https://kuromon.com' });
  });

  it('refuses scripts, mail and junk', () => {
    expect(urlCheck('javascript:alert(1)')).toMatchObject({ state: 'invalid', tone: 'error' });
    expect(urlCheck('mailto:a@b.jp')).toMatchObject({ state: 'invalid' });
    expect(urlCheck('data:text/html,hi')).toMatchObject({ state: 'invalid' });
    expect(urlCheck('the temple website')).toMatchObject({ state: 'invalid' });
    expect(urlCheck('https://intranet/')).toMatchObject({ state: 'invalid' });
  });
});

describe('monthYear', () => {
  it('prints the month a check happened', () => {
    expect(monthYear(new Date('2026-10-17T12:00:00Z'))).toBe('October 2026');
  });
});
