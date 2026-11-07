import {FALLBACK_CDN} from '../constants';

export interface Episode {
  photoId: number;
  sort: number;
  name: string;
}

export interface AlbumSummary {
  albumId: number;
  name: string;
  author: string;
  tags: string[];
  category?: string;
  categoryId?: string;
  updateAt?: number;
  coverUrl?: string;
  likesCount?: number;
  viewsCount?: number;
  pageCount?: number;
}

export interface AlbumDetail {
  albumId: number;
  name: string;
  description: string;
  /** Joined authors for single-line UI. */
  author: string;
  /** Source `author` array — chip block「作者」. */
  authors: string[];
  tags: string[];
  /** Source `works` — chip block「作品」. */
  works: string[];
  /** Source `actors` — chip block「出场人物」. */
  actors: string[];
  scrambleId: number;
  episodes: Episode[];
  category?: string;
  coverUrl?: string;
  updateAt?: number;
  likesCount?: number;
  viewsCount?: number;
  pageCount?: number;
  commentCount?: number;
  related: AlbumSummary[];
}

export interface CategorySub {
  cid: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  totalAlbums: number;
  subCategories: CategorySub[];
}

export interface TagGroup {
  title: string;
  tags: string[];
}

export interface PhotoDetail {
  photoId: number;
  name: string;
  sort: number;
  albumId: number;
  scrambleId: number;
  pageArr: string[];
  totalPics: number;
  cdnBaseUrl: string;
  queryParams: string;
}

export interface ImageItem {
  aid: number;
  scrambleId: number;
  url: string;
  fileName: string;
  suffix: string;
  index: number;
}

export type DecodeFormat = 'webp' | 'jpg';

export interface DecodedImage {
  width: number;
  height: number;
  bytes: Uint8Array;
  ext: string;
}

export function buildImageUrl(photo: PhotoDetail, fileName: string): string {
  const query = photo.queryParams ? `?${photo.queryParams}` : '';
  return `${photo.cdnBaseUrl}${fileName}${query}`;
}

export function buildFallbackImageUrl(aid: number, index: number): string {
  const padded = String(index).padStart(5, '0');
  return `https://${FALLBACK_CDN}/media/photos/${aid}/${padded}.jpg`;
}

export const IMAGE_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'gif'] as const;
export const IMAGE_EXT_SET: ReadonlySet<string> = new Set<string>(IMAGE_EXTS);
export const ALLOWED_SUFFIXES = IMAGE_EXT_SET;

export function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

export function createImageItem(photo: PhotoDetail, fileName: string, index: number): ImageItem {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const rawSuffix = dot > 0 ? fileName.slice(dot + 1) : '';
  // Whitelist the suffix; anything else would end up in a write path.
  const suffix = ALLOWED_SUFFIXES.has(rawSuffix.toLowerCase()) ? rawSuffix : '';
  return {
    aid: photo.photoId,
    scrambleId: photo.scrambleId,
    url: buildImageUrl(photo, fileName),
    fileName: base,
    suffix,
    index,
  };
}
