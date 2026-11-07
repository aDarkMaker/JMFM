import type {AlbumSummary} from '../../core/model';
import type {ApiClient} from '../../core/api';
import {createApi} from '../api/createApi';
import {seedAlbumTags} from './albumTags';

const CONCURRENCY = 3;

function mergeStats(base: AlbumSummary, detail: AlbumSummary): AlbumSummary {
  return {
    ...base,
    ...(detail.viewsCount != null ? {viewsCount: detail.viewsCount} : {}),
    ...(detail.likesCount != null ? {likesCount: detail.likesCount} : {}),
    ...(detail.pageCount != null ? {pageCount: detail.pageCount} : {}),
    ...(detail.tags.length > 0 ? {tags: detail.tags} : {}),
    author: base.author || detail.author,
    category: base.category || detail.category,
  };
}

/**
 * List endpoints (`/categories/filter`, `/search`) omit view/like counts.
 * Those only exist on `/album`, so the rank rail hydrates Top-N via detail.
 */
export async function enrichAlbumStats(
  albums: AlbumSummary[],
  api: ApiClient = createApi(),
  concurrency = CONCURRENCY
): Promise<AlbumSummary[]> {
  if (albums.length === 0) return albums;
  const result = albums.map((a) => ({...a}));
  const queue = result
    .map((a, i) => i)
    .filter((i) => result[i].viewsCount == null && result[i].likesCount == null);

  await Promise.all(
    Array.from({length: Math.min(concurrency, queue.length)}, async () => {
      for (;;) {
        const i = queue.shift();
        if (i === undefined) break;
        const cur = result[i]!;
        try {
          const detail = await api.getAlbum(cur.albumId);
          result[i] = mergeStats(cur, {
            albumId: detail.albumId,
            name: detail.name,
            author: detail.author,
            tags: detail.tags,
            category: detail.category,
            likesCount: detail.likesCount,
            viewsCount: detail.viewsCount,
            pageCount: detail.pageCount,
          });
          if (detail.tags.length > 0) seedAlbumTags(cur.albumId, detail.tags);
        } catch {
          // keep the list row without stats
        }
      }
    })
  );
  return result;
}
