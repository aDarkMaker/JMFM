import {describe, expect, test} from 'bun:test';
import {formatRelativeTime} from '../src/web/util/relativeTime';

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  test('returns empty string without a timestamp', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('');
    expect(formatRelativeTime(0, NOW)).toBe('');
    expect(formatRelativeTime(Number.NaN, NOW)).toBe('');
  });

  test('sub-minute and future timestamps collapse to 刚刚', () => {
    expect(formatRelativeTime(NOW - 1_000, NOW)).toBe('刚刚');
    expect(formatRelativeTime(NOW - MINUTE + 1, NOW)).toBe('刚刚');
    expect(formatRelativeTime(NOW + 5 * MINUTE, NOW)).toBe('刚刚');
  });

  test('minutes and hours', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前');
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前');
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前');
  });

  test('days, months, years', () => {
    expect(formatRelativeTime(NOW - DAY, NOW)).toBe('1 天前');
    expect(formatRelativeTime(NOW - 29 * DAY, NOW)).toBe('29 天前');
    expect(formatRelativeTime(NOW - 40 * DAY, NOW)).toBe('1 个月前');
    expect(formatRelativeTime(NOW - 400 * DAY, NOW)).toBe('1 年前');
  });

  test('defaults to the current clock', () => {
    expect(formatRelativeTime(Date.now() - 2 * MINUTE)).toBe('2 分钟前');
  });

  test('accepts Unix seconds from the JM list payload', () => {
    const seconds = Math.floor((NOW - 3 * HOUR) / 1000);
    expect(formatRelativeTime(seconds, NOW)).toBe('3 小时前');
  });
});
