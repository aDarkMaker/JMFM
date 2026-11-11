import type {AlbumSummary} from '@/core/model';
import {appendPage, reachedEnd} from './paging';

/** Shared shape for every append-only feed (browse, search, hot). */
export interface FeedSlice {
  items: AlbumSummary[];
  page: number;
  end: boolean;
  total: number;
  updatedAt: number;
  error?: string;
}

export const EMPTY_SLICE: FeedSlice = {
  items: [],
  page: 0,
  end: false,
  total: 0,
  updatedAt: 0,
};

export interface PageResult {
  albums: AlbumSummary[];
  total: number;
}

/** Builds the next slice after a page arrives; `reset` replaces items. */
export function mergeFeedPage(
  prev: FeedSlice,
  page: PageResult,
  pageIndex: number,
  reset = false
): FeedSlice {
  return {
    items: reset ? appendPage([], page.albums) : appendPage(prev.items, page.albums),
    page: pageIndex,
    end: reachedEnd(page, pageIndex),
    total: page.total,
    updatedAt: Date.now(),
  };
}

export function feedErrorSlice(prev: FeedSlice, e: unknown): FeedSlice {
  return {...prev, error: e instanceof Error ? e.message : String(e)};
}

/** Keeps a bounded, LRU-ish map of cached feeds. */
export function cacheFeedSlice(
  feeds: Record<string, FeedSlice>,
  key: string,
  feed: FeedSlice,
  max: number
): Record<string, FeedSlice> {
  const next = {...feeds, [key]: feed};
  const keys = Object.keys(next);
  if (keys.length > max) {
    const oldest = keys
      .filter((k) => k !== key)
      .sort((a, b) => next[a].updatedAt - next[b].updatedAt)[0];
    if (oldest) delete next[oldest];
  }
  return next;
}

/** Most recently updated slice other than `key`, used to bridge key switches. */
export function latestSiblingFeed(
  feeds: Record<string, FeedSlice>,
  key: string
): FeedSlice | undefined {
  return Object.entries(feeds)
    .filter(([k, feed]) => k !== key && feed.items.length > 0)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0]?.[1];
}
