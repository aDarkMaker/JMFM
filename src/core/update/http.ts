import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {base64ToBytes} from '../util/base64';
import {UPDATE_TIMEOUT} from './constants';

const CONNECT_MS = UPDATE_TIMEOUT.CONNECT_MS;
const RETRY_ATTEMPTS = UPDATE_TIMEOUT.RETRY_ATTEMPTS;
const RETRY_INTERVAL_MS = UPDATE_TIMEOUT.RETRY_INTERVAL_MS;

export function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) {
    return false;
  }
  return /timeout|timed out|timedout|time out/i.test(e.message);
}

function friendlyError(e: unknown): Error {
  if (isTimeoutError(e)) {
    return new Error('网络超时，请稍后重试');
  }
  return new Error('网络连接失败，请检查网络');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withUpdateRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_INTERVAL_MS);
      }
    }
  }
  throw friendlyError(last);
}

export async function updateFetchText(
  url: string,
  headers?: Record<string, string>,
  readTimeoutMs = UPDATE_TIMEOUT.READ_VERSION_MS
): Promise<string> {
  return withUpdateRetry(async () => {
    if (Capacitor.isNativePlatform()) {
      const resp = await CapacitorHttp.get({
        url,
        headers,
        responseType: 'text',
        connectTimeout: CONNECT_MS,
        readTimeout: readTimeoutMs,
      });
      if (resp.status < 200 || resp.status >= 300) {
        throw new Error(`HTTP ${resp.status}: ${url}`);
      }
      return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    }

    const resp = await fetch(url, {headers});
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${url}`);
    }
    return resp.text();
  });
}

export async function updateFetchJson<T>(
  url: string,
  headers?: Record<string, string>
): Promise<T> {
  const text = await updateFetchText(url, headers);
  return JSON.parse(text) as T;
}

export async function updateFetchBytes(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  return withUpdateRetry(async () => {
    if (Capacitor.isNativePlatform()) {
      onProgress?.(0, 1);
      const resp = await CapacitorHttp.get({
        url,
        responseType: 'arraybuffer',
        connectTimeout: CONNECT_MS,
        readTimeout: UPDATE_TIMEOUT.READ_APK_MS,
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
  });
}
