import {config} from '../../config';
import {SCRAMBLE} from '../constants';
import {
  AlbumDetail,
  AlbumSummary,
  Category,
  CategorySub,
  Episode,
  PhotoDetail,
  TagGroup,
} from '../model';

export type ListItem = {
  id?: unknown;
  name?: unknown;
  author?: unknown;
  tags?: unknown;
  update_at?: unknown;
  category?: {id?: unknown; title?: unknown};
  likes?: unknown;
  total_views?: unknown;
  total_photos?: unknown;
};

export function defaultScrambleId(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : SCRAMBLE.SCRAMBLE_220980;
}

function coverUrlOf(albumId: number): string {
  const cdns = config.domains.cdn;
  const domain = cdns[albumId % cdns.length];
  return `https://${domain}/media/albums/${albumId}_3x4.jpg`;
}

export function parseAuthor(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map(String).join(', ');
  }
  return String(raw ?? '');
}

export function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = String(item ?? '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function parseAlbumList(data: Record<string, unknown>): {
  albums: AlbumSummary[];
  total: number;
} {
  const content = Array.isArray(data.content) ? (data.content as ListItem[]) : [];
  const albums = content.map(parseSummary).filter((a): a is AlbumSummary => a != null);
  const total = Number(data.total ?? albums.length);
  return {albums, total: Number.isFinite(total) ? total : albums.length};
}

function numberOrUndefined(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** JM `update_at` is Unix seconds; normalize to ms for Date.now() comparisons. */
function parseUpdateAt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

export function parseSummary(it: ListItem): AlbumSummary | null {
  const albumId = Number(it.id);
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return null;
  }
  const categoryId = it.category?.id != null ? String(it.category.id) : undefined;
  return {
    albumId,
    name: String(it.name ?? ''),
    author: parseAuthor(it.author),
    tags: parseTags(it.tags),
    category: it.category?.title != null ? String(it.category.title) : undefined,
    ...(categoryId ? {categoryId} : {}),
    updateAt: parseUpdateAt(it.update_at),
    coverUrl: coverUrlOf(albumId),
    likesCount: numberOrUndefined(it.likes),
    viewsCount: numberOrUndefined(it.total_views),
    pageCount: numberOrUndefined(it.total_photos),
  };
}

export function parseCategories(data: Record<string, unknown>): {
  categories: Category[];
  blocks: TagGroup[];
} {
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];
  const categories = rawCategories
    .map((it): Category | null => {
      const item = it as {
        id?: unknown;
        name?: unknown;
        slug?: unknown;
        type?: unknown;
        total_albums?: unknown;
        sub_categories?: unknown;
      };
      const name = String(item.name ?? '').trim();
      if (!name) {
        return null;
      }
      const subs = Array.isArray(item.sub_categories) ? item.sub_categories : [];
      const slug = String(item.slug ?? '').trim();
      return {
        id: String(item.id ?? ''),
        name,
        // Slug categories are queried by slug; id-only categories fall back to the id.
        slug: slug || String(item.id ?? ''),
        totalAlbums: Number(item.total_albums) || 0,
        subCategories: subs
          .map((s) => {
            const sub = s as {CID?: unknown; name?: unknown; slug?: unknown};
            const subName = String(sub.name ?? '').trim();
            if (!subName) {
              return null;
            }
            return {cid: String(sub.CID ?? ''), name: subName, slug: String(sub.slug ?? '')};
          })
          .filter((s): s is CategorySub => s != null),
      };
    })
    .filter((c): c is Category => c != null)
    .sort((a, b) => b.totalAlbums - a.totalAlbums);

  const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  const blocks = rawBlocks
    .map((it): TagGroup | null => {
      const block = it as {title?: unknown; content?: unknown};
      const title = String(block.title ?? '').trim();
      const tags = parseTags(block.content);
      if (!title || tags.length === 0) {
        return null;
      }
      return {title, tags};
    })
    .filter((b): b is TagGroup => b != null);

  return {categories, blocks};
}

/** Soft key for near-duplicate related cards (DL版 / 机翻 / 删字审查变体). */
function relatedTitleKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&nbsp;/gi, '')
    .replace(/&#\d+;/g, '')
    .replace(/\[[^\]]*]/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/[（(]c\d+[）)]/gi, '')
    .replace(/[\s\u3000·・\-–—_./\\:：]+/g, '')
    .slice(0, 20);
}

function parseRelated(
  raw: unknown,
  excludeAlbumId?: number,
  excludeName?: string
): AlbumSummary[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seenIds = new Set<number>();
  const seenTitles = new Set<string>();
  if (excludeAlbumId != null && excludeAlbumId > 0) {
    seenIds.add(excludeAlbumId);
  }
  if (excludeName) {
    const key = relatedTitleKey(excludeName);
    if (key.length >= 12) seenTitles.add(key);
  }
  const out: AlbumSummary[] = [];
  for (const it of raw) {
    const album = parseSummary(it as ListItem);
    if (!album || seenIds.has(album.albumId)) continue;
    const titleKey = relatedTitleKey(album.name);
    if (titleKey.length >= 12 && seenTitles.has(titleKey)) continue;
    seenIds.add(album.albumId);
    if (titleKey.length >= 12) seenTitles.add(titleKey);
    out.push(album);
  }
  return out;
}

function parseDescription(raw: unknown): string {
  const text = String(raw ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  return text;
}

export function parseAlbumDetail(data: Record<string, unknown>): AlbumDetail {
  const id = Number(data.id);
  const name = String(data.name ?? '');
  let episodes = parseEpisodes(data.series);
  if (episodes.length === 0) {
    episodes = [{photoId: id, sort: 1, name}];
  }
  const category = (data.category as {title?: unknown} | undefined)?.title;
  // /album chip fields are always string arrays: author / tags / works / actors.
  const authors = parseTags(data.author);
  const description = parseDescription(data.description ?? data.description_full ?? '');
  return {
    albumId: id,
    name,
    description,
    author: authors.join(', ') || parseAuthor(data.author),
    authors,
    tags: parseTags(data.tags),
    works: parseTags(data.works),
    actors: parseTags(data.actors),
    scrambleId: defaultScrambleId(data.scramble_id),
    episodes,
    ...(category != null ? {category: String(category)} : {}),
    coverUrl: coverUrlOf(id),
    // List feeds use update_at; album detail exposes addtime instead.
    updateAt: parseUpdateAt(data.update_at) ?? parseUpdateAt(data.addtime),
    likesCount: numberOrUndefined(data.likes),
    viewsCount: numberOrUndefined(data.total_views),
    pageCount: numberOrUndefined(data.total_photos),
    commentCount: numberOrUndefined(data.comment_total),
    related: parseRelated(data.related_list, id, name),
  };
}

export function parseEpisodes(series: unknown): Episode[] {
  if (!Array.isArray(series) || series.length === 0) {
    return [];
  }
  return series.map((it: {id: unknown; sort: unknown; name: unknown}) => ({
    photoId: Number(it.id),
    sort: Number(it.sort ?? 1),
    name: String(it.name ?? ''),
  }));
}

export function parsePhotoDetail(data: Record<string, unknown>): PhotoDetail {
  const images: string[] = Array.isArray(data.images) ? data.images : [];
  const id = Number(data.id);
  const cdns = config.domains.cdn;
  const domain = cdns[id % cdns.length];
  return {
    photoId: id,
    name: String(data.name ?? ''),
    sort: parseSort(data),
    albumId: Number(data.series_id ?? 0),
    scrambleId: defaultScrambleId(data.scramble_id),
    pageArr: images,
    totalPics: images.length,
    cdnBaseUrl: `https://${domain}/media/photos/${id}/`,
    queryParams: '',
  };
}

function parseSort(data: {series?: unknown; id?: unknown}): number {
  if (!Array.isArray(data.series)) {
    return 1;
  }
  for (const ch of data.series as {id: unknown; sort?: unknown}[]) {
    if (Number(ch.id) === Number(data.id)) {
      return Number(ch.sort ?? 1);
    }
  }
  return 1;
}
