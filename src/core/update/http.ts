import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {base64ToBytes} from '../util/base64';
import {retry} from '../net/retry';
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

interface OnceResult {
  ok: boolean;
  status: number;
  text?: string;
  bytes?: Uint8Array;
}

type Once = (url: string) => Promise<OnceResult>;

function nativeOnce(
  headers: Record<string, string> | undefined,
  binary: boolean,
  readTimeoutMs: number,
  onProgress?: (loaded: number, total: number) => void
): Once {
  return async (url) => {
    const resp = await CapacitorHttp.get({
      url,
      headers,
      responseType: binary ? 'arraybuffer' : 'text',
      connectTimeout: CONNECT_MS,
      readTimeout: readTimeoutMs,
    });
    const ok = resp.status >= 200 && resp.status < 300;
    if (!ok) {
      return {ok, status: resp.status};
    }
    if (binary) {
      const bytes = base64ToBytes(String(resp.data));
      onProgress?.(bytes.length, bytes.length || 1);
      return {ok, status: resp.status, bytes};
    }
    return {
      ok,
      status: resp.status,
      text: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data),
    };
  };
}

function webOnce(
  headers: Record<string, string> | undefined,
  binary: boolean,
  readTimeoutMs: number,
  onProgress?: (loaded: number, total: number) => void
): Once {
  return async (url) => {
    const resp = await fetch(url, {headers, signal: AbortSignal.timeout(readTimeoutMs)});
    const ok = resp.status >= 200 && resp.status < 300;
    if (!ok) {
      return {ok, status: resp.status};
    }
    if (!binary) {
      return {ok, status: resp.status, text: await resp.text()};
    }
    const total = Number(resp.headers.get('content-length') ?? 0);
    const reader = resp.body?.getReader();
    if (!reader) {
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      onProgress?.(bytes.byteLength, bytes.byteLength || 1);
      return {ok, status: resp.status, bytes};
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
    return {ok, status: resp.status, bytes: merged};
  };
}

function pickOnce(opts: {
  headers?: Record<string, string>;
  binary: boolean;
  readTimeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
}): Once {
  const {headers, binary, onProgress} = opts;
  const readTimeoutMs = opts.readTimeoutMs ?? UPDATE_TIMEOUT.READ_VERSION_MS;
  return Capacitor.isNativePlatform()
    ? nativeOnce(headers, binary, readTimeoutMs, onProgress)
    : webOnce(headers, binary, readTimeoutMs, onProgress);
}

async function withRetry(once: Once, url: string): Promise<OnceResult> {
  try {
    return await retry(async () => {
      const result = await once(url);
      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${url}`);
      }
      return result;
    }, RETRY_ATTEMPTS, RETRY_INTERVAL_MS);
  } catch (e) {
    throw friendlyError(e);
  }
}

export async function updateFetchText(
  url: string,
  headers?: Record<string, string>,
  readTimeoutMs = UPDATE_TIMEOUT.READ_VERSION_MS
): Promise<string> {
  const result = await withRetry(pickOnce({headers, binary: false, readTimeoutMs}), url);
  return result.text ?? '';
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
  const result = await withRetry(pickOnce({binary: true, onProgress}), url);
  return result.bytes ?? new Uint8Array();
}

export type StreamChunkHandler = (
  chunk: Uint8Array,
  loaded: number,
  total: number
) => Promise<void> | void;

const STREAM_SLICE_CHARS = (1 << 20) & ~3; // base64 slice decoding to ~768KB, multiple of 4

async function streamNative(
  url: string,
  readTimeoutMs: number,
  onChunk: StreamChunkHandler
): Promise<void> {
  const resp = await CapacitorHttp.get({
    url,
    responseType: 'arraybuffer',
    connectTimeout: CONNECT_MS,
    readTimeout: readTimeoutMs,
  });
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  const b64 = String(resp.data);
  const total = (b64.length * 3) >> 2;
  let loaded = 0;
  for (let i = 0; i < b64.length; i += STREAM_SLICE_CHARS) {
    const chunk = base64ToBytes(b64.slice(i, i + STREAM_SLICE_CHARS));
    loaded += chunk.length;
    await onChunk(chunk, loaded, total);
  }
}

async function streamWeb(
  url: string,
  readTimeoutMs: number,
  onChunk: StreamChunkHandler
): Promise<void> {
  const resp = await fetch(url, {signal: AbortSignal.timeout(readTimeoutMs)});
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  const total = Number(resp.headers.get('content-length') ?? 0);
  const reader = resp.body?.getReader();
  if (!reader) {
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    await onChunk(bytes, bytes.byteLength, total || bytes.byteLength);
    return;
  }
  let loaded = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      loaded += value.length;
      await onChunk(value, loaded, total || loaded);
    }
  }
}

/**
 * Reads a binary resource in chunks, invoking onChunk per chunk.
 * Native path slices the whole base64 returned by CapacitorHttp to avoid buffering the full
 * payload; web path streams through the response reader.
 */
export async function streamFetchBytes(
  url: string,
  onChunk: StreamChunkHandler,
  readTimeoutMs = UPDATE_TIMEOUT.READ_APK_MS
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await streamNative(url, readTimeoutMs, onChunk);
    } else {
      await streamWeb(url, readTimeoutMs, onChunk);
    }
  } catch (e) {
    throw friendlyError(e);
  }
}
