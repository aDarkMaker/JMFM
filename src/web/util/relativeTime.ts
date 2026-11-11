import {t} from '@/web/i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Unix seconds for ~2001-09; below this, treat the value as seconds not ms. */
const MS_EPOCH_FLOOR = 1_000_000_000_000;

/** JM list payloads ship `update_at` in seconds; `Date.now()` is ms. */
export function toEpochMs(timestamp: number): number {
  return timestamp < MS_EPOCH_FLOOR ? timestamp * 1000 : timestamp;
}

/** Coarse relative timestamp for update lists. Empty string when unknown. */
export function formatRelativeTime(
  timestamp: number | undefined,
  now: number = Date.now()
): string {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) return '';
  const diff = now - toEpochMs(timestamp);
  if (diff < MINUTE) return t('time.justNow');
  if (diff < HOUR) return t('time.minutesAgo', {n: Math.floor(diff / MINUTE)});
  if (diff < DAY) return t('time.hoursAgo', {n: Math.floor(diff / HOUR)});
  if (diff < 30 * DAY) return t('time.daysAgo', {n: Math.floor(diff / DAY)});
  if (diff < 365 * DAY) return t('time.monthsAgo', {n: Math.floor(diff / (30 * DAY))});
  return t('time.yearsAgo', {n: Math.floor(diff / (365 * DAY))});
}
