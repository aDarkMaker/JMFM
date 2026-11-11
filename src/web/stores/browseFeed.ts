import {create} from 'zustand';
import {ALL_CATEGORY, SORT} from '@/core/constants/sort';
import {createApi} from '@/web/api/createApi';
import {filterBlockedAlbums} from '@/core/model/blocklist';
import {feedKey} from '@/web/library/paging';
import {
  EMPTY_SLICE,
  cacheFeedSlice,
  feedErrorSlice,
  latestSiblingFeed,
  mergeFeedPage,
  type FeedSlice,
} from '@/web/library/pagedFeed';
import {useSettingsStore} from './settings';

const MAX_CACHED_FEEDS = 6;
const FEED_TTL_MS = 30 * 60 * 1000;

export type Feed = FeedSlice;

interface BrowseFeedState {
  category: string;
  order: string;
  feeds: Record<string, Feed>;
  loadingKey?: string;
  setCategory(category: string): void;
  setOrder(order: string): void;
  /** Sets category and order together and loads only once. */
  setFilter(category: string, order?: string): void;
  load(reset?: boolean): Promise<void>;
}

/** Discards responses that arrive after the user switched category/order. */
let requestSeq = 0;

export const useBrowseFeedStore = create<BrowseFeedState>((set, get) => ({
  category: ALL_CATEGORY,
  order: SORT.DEFAULT,
  feeds: {},
  loadingKey: undefined,

  setCategory(category) {
    if (get().category === category) return;
    set({category});
    void get().load();
  },

  setOrder(order) {
    if (get().order === order) return;
    set({order});
    void get().load(true);
  },

  setFilter(category, order) {
    const state = get();
    if (state.category === category && (order == null || state.order === order)) return;
    const reset = order != null && order !== state.order;
    set({category, ...(order != null ? {order} : {})});
    void get().load(reset);
  },

  async load(reset) {
    const {category, order, feeds, loadingKey} = get();
    const key = feedKey([category, order]);
    const cached = feeds[key] ?? EMPTY_SLICE;

    if (!reset && cached.end) return;
    if (loadingKey === key) return;
    if (!reset && cached.items.length > 0 && Date.now() - cached.updatedAt < FEED_TTL_MS) {
      return;
    }

    const nextPage = reset ? 1 : cached.page + 1;
    const seq = ++requestSeq;
    set({loadingKey: key});

    try {
      const {albums, total} = await createApi().browseAlbums(nextPage, {category, order});
      if (seq !== requestSeq) return;
      const {blacklistTags} = useSettingsStore.getState().settings;
      const next = mergeFeedPage(cached, {albums, total}, nextPage, reset);
      set((state) => ({
        feeds: cacheFeedSlice(
          state.feeds,
          key,
          {
            ...next,
            items: filterBlockedAlbums(next.items, blacklistTags),
          },
          MAX_CACHED_FEEDS
        ),
        loadingKey: undefined,
      }));
    } catch (e) {
      if (seq !== requestSeq) return;
      set((state) => ({
        feeds: cacheFeedSlice(state.feeds, key, feedErrorSlice(cached, e), MAX_CACHED_FEEDS),
        loadingKey: undefined,
      }));
    }
  },
}));

export function selectCurrentFeed(state: BrowseFeedState): Feed {
  return state.feeds[feedKey([state.category, state.order])] ?? EMPTY_SLICE;
}

/**
 * Feed to render: the cached key when it has rows, otherwise the most recent
 * sibling feed so a category switch never flashes a blank list.
 */
export function selectVisibleFeed(state: BrowseFeedState): Feed {
  const key = feedKey([state.category, state.order]);
  const cached = state.feeds[key];
  if (cached && cached.items.length > 0) return cached;
  if (state.loadingKey === key) {
    return latestSiblingFeed(state.feeds, key) ?? cached ?? EMPTY_SLICE;
  }
  return cached ?? EMPTY_SLICE;
}

export function selectIsSwitching(state: BrowseFeedState): boolean {
  const key = feedKey([state.category, state.order]);
  return state.loadingKey === key && (state.feeds[key]?.items.length ?? 0) === 0;
}
