import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {REQUEST} from '../constants';
import {base64ToBytes} from '../util/base64';

const TIMEOUT_MS = REQUEST.READ_TIMEOUT_MS;

export async function updateFetchText(
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const resp = await CapacitorHttp.get({
      url,
      headers,
      responseType: 'text',
      connectTimeout: TIMEOUT_MS,
      readTimeout: TIMEOUT_MS,
    });
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`HTTP ${resp.status}: ${url}`);
    }
    return String(resp.data);
  }

  const resp = await fetch(url, {headers});
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  return resp.text();
}

export async function updateFetchJson<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  const text = await updateFetchText(url, headers);
  return JSON.parse(text) as T;
}

export async function updateFetchBytes(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  if (Capacitor.isNativePlatform()) {
    onProgress?.(0, 1);
    const resp = await CapacitorHttp.get({
      url,
      responseType: 'arraybuffer',
      connectTimeout: TIMEOUT_MS,
      readTimeout: TIMEOUT_MS,
    });
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`HTTP ${resp.status}: ${url}`);
    }
    const bytes = base64ToBytes(String(resp.data));
    onProgress?.(bytes.length, bytes.length || 1);
    return bytes;
  }

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }

  const total = Number(resp.headers.get('content-length') ?? 0);
  const reader = resp.body?.getReader();
  if (!reader) {
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    onProgress?.(bytes.byteLength, bytes.byteLength || 1);
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total || loaded);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress?.(loaded, total || loaded);
  return merged;
}
