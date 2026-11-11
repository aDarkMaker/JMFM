export const STORAGE_KEYS = {
  settings: 'jmf.settings',
  library: 'jmf.library',
  dailyCachePrefix: 'jmf.daily.',
  dismissedPrefix: 'jmf.daily.dismissed.',
  tagCachePrefix: 'jmf.tags.',
  recentSearches: 'jmf.search.recent',
  history: 'jmf.history',
  updateRelease: 'jmf.update.release',
} as const;

/**
 * Bump whenever a persisted structure changes shape. `readVersioned` routes
 * older payloads (including unversioned legacy ones, `0`) through `migrate`.
 */
export const STORAGE_VERSION = 1;
