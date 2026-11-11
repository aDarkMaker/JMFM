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
  /** Message key resolved by `t()` in the UI layer. */
  labelKey: string;
  /** Pages are capped server side; shorter feeds mark the end earlier. */
  shortFeed?: boolean;
}

/** Discover / browse chips: time-scoped popularity. */
export const SORT_OPTIONS: readonly SortOption[] = [
  {code: SORT.DEFAULT, labelKey: 'sort.latest'},
  {code: SORT.TODAY_HOT, labelKey: 'sort.todayHot', shortFeed: true},
  {code: SORT.WEEK_HOT, labelKey: 'sort.weekHot'},
  {code: SORT.MONTH_HOT, labelKey: 'sort.monthHot'},
];

/** Search chips: time / views / likes / pages (all-time). */
export const SEARCH_SORT_OPTIONS: readonly SortOption[] = [
  {code: SORT.LATEST, labelKey: 'sort.latest'},
  {code: SORT.BY_VIEWS, labelKey: 'sort.views'},
  {code: SORT.BY_LIKES, labelKey: 'sort.likes'},
  {code: SORT.BY_PAGES, labelKey: 'sort.pages'},
];

/** Fallback categories when /categories fails, matched by verified slug. */
export const CATEGORY_FALLBACK: readonly {slug: string; nameKey: string}[] = [
  {slug: 'doujin', nameKey: 'cat.doujin'},
  {slug: 'hanman', nameKey: 'cat.hanman'},
  {slug: 'meiman', nameKey: 'cat.meiman'},
  {slug: 'short', nameKey: 'cat.short'},
  {slug: 'single', nameKey: 'cat.single'},
  {slug: 'another', nameKey: 'cat.other'},
];

/** /categories/filter: "0" is the unfiltered newest feed. */
export const ALL_CATEGORY = '0';
