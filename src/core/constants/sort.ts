/** Sort codes accepted by /categories/filter and /search (verified against the live API). */
export const SORT = {
  /** Browse / filter: newest in the selected time window. */
  DEFAULT: 'mr_t',
  /** Search: all-time chronological. */
  LATEST: 'mr',
  /** Search: most views. */
  BY_VIEWS: 'mv',
  /** Search: most likes. */
  BY_LIKES: 'tf',
  /** Search: most pages. */
  BY_PAGES: 'mp',
  TODAY_HOT: 'mv_t',
  WEEK_HOT: 'mv_w',
  MONTH_HOT: 'mv_m',
} as const;

export type SortCode = (typeof SORT)[keyof typeof SORT];

export interface SortOption {
  code: SortCode;
  label: string;
  /** Pages are capped server side; shorter feeds mark the end earlier. */
  shortFeed?: boolean;
}

/** Discover / browse chips: time-scoped popularity. */
export const SORT_OPTIONS: readonly SortOption[] = [
  {code: SORT.DEFAULT, label: '最新'},
  {code: SORT.TODAY_HOT, label: '今日最热', shortFeed: true},
  {code: SORT.WEEK_HOT, label: '本周最热'},
  {code: SORT.MONTH_HOT, label: '本月最热'},
];

/** Search chips: time / views / likes / pages (all-time). */
export const SEARCH_SORT_OPTIONS: readonly SortOption[] = [
  {code: SORT.LATEST, label: '最新'},
  {code: SORT.BY_VIEWS, label: '观看'},
  {code: SORT.BY_LIKES, label: '喜欢'},
  {code: SORT.BY_PAGES, label: '页数'},
];

/** Fallback categories when /categories fails, matched by verified slug. */
export const CATEGORY_FALLBACK: readonly {slug: string; name: string}[] = [
  {slug: 'doujin', name: '同人'},
  {slug: 'hanman', name: '韩漫'},
  {slug: 'meiman', name: 'English'},
  {slug: 'short', name: '短篇'},
  {slug: 'single', name: '单本'},
  {slug: 'another', name: '其他'},
];

/** /categories/filter: "0" is the unfiltered newest feed. */
export const ALL_CATEGORY = '0';
