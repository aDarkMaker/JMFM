import {create} from 'zustand';
import type {AlbumDetail} from '@/core/model';
import {createApi} from '@/web/api/createApi';

const DETAIL_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 10;

interface DetailEntry {
  detail: AlbumDetail;
  at: number;
}

interface DetailState {
  cache: Record<string, DetailEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | undefined>;
  load(albumId: number, force?: boolean): Promise<void>;
}

export const useAlbumDetailStore = create<DetailState>((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  async load(albumId, force) {
    const key = String(albumId);
    const {cache, loading} = get();
    if (loading[key]) return;
    const hit = cache[key];
    if (!force && hit && Date.now() - hit.at < DETAIL_TTL_MS) return;

    set((state) => ({
      loading: {...state.loading, [key]: true},
      errors: {...state.errors, [key]: undefined},
    }));
    try {
      const detail = await createApi().getAlbum(albumId);
      set((state) => {
        const nextCache = {...state.cache, [key]: {detail, at: Date.now()}};
        const keys = Object.keys(nextCache);
        if (keys.length > MAX_CACHED) {
          const oldest = keys.sort((a, b) => nextCache[a].at - nextCache[b].at)[0];
          if (oldest !== key) delete nextCache[oldest];
        }
        return {
          cache: nextCache,
          loading: {...state.loading, [key]: false},
        };
      });
    } catch (e) {
      set((state) => ({
        loading: {...state.loading, [key]: false},
        errors: {...state.errors, [key]: e instanceof Error ? e.message : String(e)},
      }));
    }
  },
}));
