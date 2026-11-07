import {create} from 'zustand';
import {SORT} from '../../core/constants/sort';
import {createApi} from '../api/createApi';
import {filterBlockedAlbums} from '../../core/model/blocklist';
import {mergeFeedPage, feedErrorSlice, EMPTY_SLICE, type FeedSlice} from '../library/pagedFeed';
import {useSettingsStore} from './settings';
import {readRecentSearches, pushRecentSearch, clearRecentSearches} from '../library/recentSearches';

interface SearchState extends FeedSlice {
  query: string;
  /** Query whose results are currently on screen (may lag behind `query`). */
  shownQuery: string;
  category: string;
  order: string;
  loading: boolean;
  recent: string[];
  setQuery(query: string): void;
  setCategory(category: string): void;
  setOrder(order: string): void;
  loadRecent(): Promise<void>;
  submit(query: string): Promise<void>;
  loadMore(): Promise<void>;
  clearRecent(): Promise<void>;
}

/** Invalidates responses from a previous query. */
let requestSeq = 0;

export const useSearchStore = create<SearchState>((set, get) => ({
  ...EMPTY_SLICE,
  query: '',
  shownQuery: '',
  category: '',
  order: SORT.LATEST,
  loading: false,
  recent: [],

  setQuery(query) {
    set({query});
  },

  setCategory(category) {
    set({category});
    if (get().query) void get().submit(get().query);
  },

  setOrder(order) {
    set({order});
    if (get().query) void get().submit(get().query);
  },

  async loadRecent() {
    set({recent: await readRecentSearches()});
  },

  async submit(query) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const seq = ++requestSeq;
    // Keep the previous results on screen while the next page 1 is inflight;
    // only a brand-new keyword (no rows yet) shows the loading placeholder.
    set({query: trimmed, items: get().items, loading: true, error: undefined});
    void pushRecentSearch(trimmed).then((recent) => set({recent}));

    try {
      const {category, order} = get();
      const {albums, total} = await createApi().searchAlbums(trimmed, 1, {
        ...(category ? {category} : {}),
        order,
      });
      if (seq !== requestSeq) return;
      const {blacklistTags} = useSettingsStore.getState().settings;
      const next = mergeFeedPage(EMPTY_SLICE, {albums, total}, 1, true);
      set({
        ...next,
        items: filterBlockedAlbums(next.items, blacklistTags),
        shownQuery: trimmed,
        loading: false,
      });
    } catch (e) {
      if (seq !== requestSeq) return;
      set({...feedErrorSlice(get(), e), loading: false});
    }
  },

  async loadMore() {
    const {query, shownQuery, page, end, loading} = get();
    if (!query || loading || end) return;
    // Never paginate a query whose page 1 has not landed yet.
    if (shownQuery !== query) return;
    const nextPage = page + 1;
    const seq = requestSeq;
    set({loading: true, error: undefined});
    try {
      const {category, order} = get();
      const {albums, total} = await createApi().searchAlbums(query, nextPage, {
        ...(category ? {category} : {}),
        order,
      });
      if (seq !== requestSeq) return;
      const {blacklistTags} = useSettingsStore.getState().settings;
      const next = mergeFeedPage(get(), {albums, total}, nextPage);
      set({
        ...next,
        items: filterBlockedAlbums(next.items, blacklistTags),
        loading: false,
      });
    } catch (e) {
      if (seq !== requestSeq) return;
      set({...feedErrorSlice(get(), e), loading: false});
    }
  },

  async clearRecent() {
    await clearRecentSearches();
    set({recent: []});
  },
}));
