const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Unix seconds for ~2001-09; below this, treat the value as seconds not ms. */
const MS_EPOCH_FLOOR = 1_000_000_000_000;

/** JM list payloads ship `update_at` in seconds; `Date.now()` is ms. */
export function toEpochMs(timestamp: number): number {
  return timestamp < MS_EPOCH_FLOOR ? timestamp * 1000 : timestamp;
}

/**
 * Coarse Chinese relative timestamp for update lists.
 * Returns an empty string when the source has no timestamp.
 */
export function formatRelativeTime(
  timestamp: number | undefined,
  now: number = Date.now()
): string {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) return '';
  const diff = now - toEpochMs(timestamp);
  if (diff < 0) return '刚刚';
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))} 个月前`;
  return `${Math.floor(diff / (365 * DAY))} 年前`;
}
