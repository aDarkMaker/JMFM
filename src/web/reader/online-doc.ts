import type {ImageItem} from '../../core/model';
import {createApi, currentApiOptions} from '../api/createApi';
import {createHttpClient} from '../../core/net';
import {fetchImageBytes} from '../../core/download/pages';
import {base64ToBytes} from '../../core/util/base64';
import {getNum} from '../../core/transcode';
import {decodeAndSave} from '../../core/transcode/decode';
import {registerCacheClear} from '../util/cacheRegistry';

export interface OnlineDocMeta {
  key: string;
  pageCount: number;
  items: ImageItem[];
  srcs: (string | undefined)[];
  blobUrls: string[];
}

const CACHE_LIMIT = 2;
const cache = new Map<string, OnlineDocMeta>();
const inflight = new Map<string, Promise<OnlineDocMeta>>();
const resolveInflight = new Map<string, Promise<string | undefined>>();

export function onlineDocKey(albumId: number, photoId: number): string {
  return `online:${albumId}:${photoId}`;
}

function touch(meta: OnlineDocMeta): void {
  cache.delete(meta.key);
  cache.set(meta.key, meta);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string;
    clearOnlineDoc(oldest);
  }
}

function revoke(meta: OnlineDocMeta): void {
  for (const url of meta.blobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  meta.blobUrls = [];
  meta.srcs = Array(meta.pageCount);
}

export function clearOnlineDoc(key?: string): void {
  if (key) {
    const hit = cache.get(key);
    if (hit) {
      revoke(hit);
      cache.delete(key);
    }
    return;
  }
  for (const meta of cache.values()) revoke(meta);
  cache.clear();
}

registerCacheClear(() => clearOnlineDoc());

export function getOnlineDocMeta(key: string): OnlineDocMeta | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  touch(hit);
  return hit;
}

/** Loads chapter page list for online preview (URLs resolved lazily). */
export async function loadOnlineDocMeta(
  albumId: number,
  photoId: number,
  scrambleId?: number
): Promise<OnlineDocMeta> {
  const key = onlineDocKey(albumId, photoId);
  const hit = cache.get(key);
  if (hit) {
    touch(hit);
    return hit;
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const api = createApi();
    const photo = await api.getPhoto(photoId);
    if (!photo.scrambleId) {
      if (scrambleId) {
        photo.scrambleId = scrambleId;
      } else {
        try {
          const album = await api.getAlbum(albumId);
          if (album.scrambleId) photo.scrambleId = album.scrambleId;
        } catch {
          // keep default scramble from parse
        }
      }
    }
    const items = api.buildImageItems(photo);
    const meta: OnlineDocMeta = {
      key,
      pageCount: items.length,
      items,
      srcs: Array.from({length: items.length}),
      blobUrls: [],
    };
    touch(meta);
    return meta;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

function mimeOf(ext: string): string {
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** Fetch + unscramble one page into a blob URL (deduped per index). */
export function resolveOnlineSrc(
  meta: OnlineDocMeta,
  index: number
): Promise<string | undefined> {
  if (meta.srcs[index]) return Promise.resolve(meta.srcs[index]);
  const item = meta.items[index];
  if (!item) return Promise.resolve(undefined);

  const token = `${meta.key}:${index}`;
  const existing = resolveInflight.get(token);
  if (existing) return existing;

  const job = (async () => {
    const opts = currentApiOptions();
    const http = createHttpClient({
      ...(opts.proxyEnabled && opts.proxy ? {proxy: opts.proxy} : {}),
      maxRetries: opts.retryTimes,
    });
    const image = await fetchImageBytes(http, item);
    const bytes = image.bytes ?? (image.base64 ? base64ToBytes(image.base64) : undefined);
    if (!bytes || bytes.length === 0) return undefined;
    const num = getNum(item.scrambleId, item.aid, item.fileName);
    const decoded = await decodeAndSave(num, bytes, item.suffix, 'jpg');
    const url = URL.createObjectURL(
      new Blob([decoded.bytes as BlobPart], {type: mimeOf(decoded.ext)})
    );
    meta.srcs[index] = url;
    meta.blobUrls.push(url);
    touch(meta);
    return url;
  })().finally(() => resolveInflight.delete(token));

  resolveInflight.set(token, job);
  return job;
}
