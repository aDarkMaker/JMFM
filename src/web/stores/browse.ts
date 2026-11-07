import {create} from 'zustand';
import type {AlbumSummary, Category, TagGroup} from '../../core/model';
import {SORT} from '../../core/constants/sort';
import {createApi} from '../api/createApi';
import {filterBlockedAlbums} from '../../core/model/blocklist';
import {enrichAlbumStats} from '../library/albumStats';
import {useSettingsStore} from './settings';

const CATEGORY_TTL_MS = 6 * 60 * 60 * 1000;
const HOT_LIMIT = 10;
const HOT_TTL_MS = 60 * 60 * 1000;

/** Bumps when a newer loadHot starts so late enrich results are dropped. */
let hotSeq = 0;

interface BrowseTaxonomyState {
  categories: Category[];
  blocks: TagGroup[];
  categoriesAt: number;
  categoriesLoading: boolean;
  categoriesError?: string;
  loadCategories(force?: boolean): Promise<void>;
  hot: AlbumSummary[];
  hotAt: number;
  hotLoading: boolean;
  loadHot(force?: boolean): Promise<void>;
}

/** Category tree + weekly hot strip shared by Home, Discover and Search. */
export const useBrowseStore = create<BrowseTaxonomyState>((set, get) => ({
  categories: [],
  blocks: [],
  categoriesAt: 0,
  categoriesLoading: false,
  categoriesError: undefined,
  hot: [],
  hotAt: 0,
  hotLoading: false,

  async loadCategories(force) {
    const {categories, categoriesAt, categoriesLoading} = get();
    if (categoriesLoading) return;
    const fresh = Date.now() - categoriesAt < CATEGORY_TTL_MS;
    if (!force && fresh && categories.length > 0) return;

    set({categoriesLoading: true, categoriesError: undefined});
    try {
      const {categories: list, blocks} = await createApi().getCategories();
      set({
        categories: list,
        blocks,
        categoriesAt: Date.now(),
        categoriesLoading: false,
      });
    } catch (e) {
      set({
        categoriesLoading: false,
        categoriesError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async loadHot(force) {
    const {hot, hotAt, hotLoading} = get();
    if (hotLoading) return;
    if (!force && hot.length > 0 && Date.now() - hotAt < HOT_TTL_MS) return;
    const seq = ++hotSeq;
    set({hotLoading: true});
    try {
      const api = createApi();
      const {albums} = await api.browseAlbums(1, {order: SORT.WEEK_HOT});
      const {blacklistTags} = useSettingsStore.getState().settings;
      const list = filterBlockedAlbums(albums.slice(0, HOT_LIMIT), blacklistTags);
      if (seq !== hotSeq) return;
      // Paint the ordered list first; stats come from /album (list payload has none).
      set({hot: list, hotAt: Date.now(), hotLoading: false});
      const enriched = await enrichAlbumStats(list, api);
      if (seq !== hotSeq) return;
      set({hot: enriched});
    } catch {
      if (seq === hotSeq) set({hotLoading: false});
    }
  },
}));

// Re-read categories when the proxy or retry policy changes.
useSettingsStore.subscribe((state, prev) => {
  if (!state.loaded || !prev.loaded) return;
  const changed =
    state.settings.proxyEnabled !== prev.settings.proxyEnabled ||
    state.settings.proxy !== prev.settings.proxy ||
    state.settings.retryTimes !== prev.settings.retryTimes;
  if (changed) {
    void useBrowseStore.getState().loadCategories(true);
  }
});
