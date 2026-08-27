import {config} from '../../config';
import {SCRAMBLE} from '../constants';
import {AlbumDetail, AlbumSummary, Episode, PhotoDetail} from '../model';

export type ListItem = {
  id?: unknown;
  name?: unknown;
  author?: unknown;
  tags?: unknown;
  update_at?: unknown;
  category?: {title?: unknown};
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
  return Array.isArray(raw) ? raw.map(String) : [];
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

export function parseSummary(it: ListItem): AlbumSummary | null {
  const albumId = Number(it.id);
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return null;
  }
  const updateAt = Number(it.update_at);
  return {
    albumId,
    name: String(it.name ?? ''),
    author: parseAuthor(it.author),
    tags: parseTags(it.tags),
    category: it.category?.title != null ? String(it.category.title) : undefined,
    updateAt: Number.isFinite(updateAt) && updateAt > 0 ? updateAt : undefined,
    coverUrl: coverUrlOf(albumId),
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

export function parseAlbumDetail(data: Record<string, unknown>): AlbumDetail {
  const id = Number(data.id);
  const name = String(data.name ?? '');
  let episodes = parseEpisodes(data.series);
  if (episodes.length === 0) {
    episodes = [{photoId: id, sort: 1, name}];
  }
  return {
    albumId: id,
    name,
    description: String(data.description ?? ''),
    author: parseAuthor(data.author),
    tags: parseTags(data.tags),
    scrambleId: defaultScrambleId(data.scramble_id),
    episodes,
  };
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
