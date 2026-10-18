/**
 * "Now in Japan": the current season and Tokyo time, whatever the visitor's
 * own time zone. Seasons follow the Japanese convention (spring = March–May).
 */
import { SEASON_MAP } from '../../data/seasons.js';

export const JAPAN_TIME_ZONE = 'Asia/Tokyo';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: JAPAN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const monthFormat = new Intl.DateTimeFormat('en-US', { timeZone: JAPAN_TIME_ZONE, month: 'numeric' });

/** A conservative "what's happening" note for each month of the year. */
const MONTH_NOTES = {
  1: 'New Year shrine visits',
  2: 'snow festivals & first plum blossom',
  3: 'plum blossom, first sakura',
  4: 'cherry blossom season',
  5: 'fresh green & Golden Week',
  6: 'rainy season & hydrangeas',
  7: 'Gion Matsuri in Kyoto',
  8: 'fireworks & Obon',
  9: 'moon viewing',
  10: 'first maple colours up north',
  11: 'maple season',
  12: 'illuminations & first snow',
};

/** 1–12 → season id: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter. */
export function seasonIdForMonth(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** Month (1–12) in Japan for `date`. */
export function japanMonth(date = new Date()) {
  return Number(monthFormat.format(date));
}

/** "21:04" — 24-hour Tokyo time. */
export function formatJapanTime(date = new Date()) {
  return timeFormat.format(date);
}

/** { time, month, season, note } for `date`, all in Japan time. */
export function japanNow(date = new Date()) {
  const month = japanMonth(date);
  return {
    time: formatJapanTime(date),
    month,
    season: SEASON_MAP[seasonIdForMonth(month)],
    note: MONTH_NOTES[month],
  };
}

/** Milliseconds until the next whole minute, so a clock ticks on :00. */
export function msUntilNextMinute(date = new Date()) {
  return 60000 - (date.getTime() % 60000);
}
