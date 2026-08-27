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
  updateAt?: number;
  coverUrl?: string;
}

export interface AlbumDetail {
  albumId: number;
  name: string;
  description: string;
  author: string;
  tags: string[];
  scrambleId: number;
  episodes: Episode[];
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

export function createImageItem(
  photo: PhotoDetail,
  fileName: string,
  index: number,
): ImageItem {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const suffix = dot > 0 ? fileName.slice(dot + 1) : '';
  return {
    aid: photo.photoId,
    scrambleId: photo.scrambleId,
    url: buildImageUrl(photo, fileName),
    fileName: base,
    suffix,
    index,
  };
}
