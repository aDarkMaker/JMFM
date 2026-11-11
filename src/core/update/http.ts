import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {base64ToBytes} from '@/core/util/base64';
import {retry} from '@/core/net/retry';
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
  etag?: string;
  text?: string;
  bytes?: Uint8Array;
}

/** HTTP failures the caller may want to distinguish (rate limit, not found, …). */
export class UpdateHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'UpdateHttpError';
  }
}

const NON_RETRYABLE_STATUS = new Set([403, 404, 429]);

function shouldRetryError(e: unknown): boolean {
  return !(e instanceof UpdateHttpError && NON_RETRYABLE_STATUS.has(e.status));
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
    const etag = resp.headers?.etag ?? resp.headers?.ETag;
    const ok = resp.status >= 200 && resp.status < 300;
    if (!ok) {
      return {ok, status: resp.status, etag};
    }
    if (binary) {
      const bytes = base64ToBytes(String(resp.data));
      onProgress?.(bytes.length, bytes.length || 1);
      return {ok, status: resp.status, bytes, etag};
    }
    return {
      ok,
      status: resp.status,
      text: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data),
      etag,
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
    const etag = resp.headers.get('etag') ?? undefined;
    const ok = resp.status >= 200 && resp.status < 300;
    if (!ok) {
      return {ok, status: resp.status, etag};
    }
    if (!binary) {
      return {ok, status: resp.status, text: await resp.text(), etag};
    }
    const total = Number(resp.headers.get('content-length') ?? 0);
    const reader = resp.body?.getReader();
    if (!reader) {
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      onProgress?.(bytes.byteLength, bytes.byteLength || 1);
      return {ok, status: resp.status, bytes, etag};
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
    return {ok, status: resp.status, bytes: merged, etag};
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
    return await retry(
      async () => {
        const result = await once(url);
        if (!result.ok) {
          throw new UpdateHttpError(`HTTP ${result.status}: ${url}`, result.status);
        }
        return result;
      },
      RETRY_ATTEMPTS,
      RETRY_INTERVAL_MS,
      shouldRetryError
    );
  } catch (e) {
    if (e instanceof UpdateHttpError) {
      throw e;
    }
    throw friendlyError(e);
  }
}

export interface FetchTextResult {
  text: string;
  etag?: string;
}

/**
 * Fetches a text resource and surfaces its ETag so callers can revalidate.
 * `ifNoneMatch` sends a conditional request; a 304 rejects with UpdateHttpError(304).
 */
export async function updateFetchTextResult(
  url: string,
  opts: {headers?: Record<string, string>; readTimeoutMs?: number} = {}
): Promise<FetchTextResult> {
  const result = await withRetry(
    pickOnce({
      headers: opts.headers,
      binary: false,
      readTimeoutMs: opts.readTimeoutMs ?? UPDATE_TIMEOUT.READ_VERSION_MS,
    }),
    url
  );
  return {text: result.text ?? '', etag: result.etag};
}

export async function updateFetchText(
  url: string,
  headers?: Record<string, string>,
  readTimeoutMs = UPDATE_TIMEOUT.READ_VERSION_MS
): Promise<string> {
  const result = await updateFetchTextResult(url, {headers, readTimeoutMs});
  return result.text;
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
    throw new UpdateHttpError(`HTTP ${resp.status}: ${url}`, resp.status);
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

export interface StreamFetchOptions {
  readTimeoutMs?: number;
  /** Byte offset to ask for with a Range request (web only). */
  startOffset?: number;
  /** Called once the transport starts; `resumed` is false when the body restarted. */
  onStart?: (resumed: boolean) => void;
}

/**
 * Reads a binary resource in chunks, invoking onChunk per chunk.
 * Web honours `startOffset` with a Range request and reports through `onStart`
 * whether the server continued the existing file or restarted it; native refetches.
 */
export async function streamFetchBytes(
  url: string,
  onChunk: StreamChunkHandler,
  opts: StreamFetchOptions = {}
): Promise<boolean> {
  const startOffset = opts.startOffset ?? 0;
  try {
    if (Capacitor.isNativePlatform()) {
      opts.onStart?.(false);
      await streamNative(url, opts.readTimeoutMs ?? UPDATE_TIMEOUT.READ_APK_MS, onChunk);
      return false;
    }
    const readTimeoutMs = opts.readTimeoutMs ?? UPDATE_TIMEOUT.READ_APK_MS;

    const headers: Record<string, string> =
      startOffset > 0 ? {Range: `bytes=${startOffset}-`} : {};
    const resp = await fetch(url, {headers, signal: AbortSignal.timeout(readTimeoutMs)});
    if (resp.status !== 206 && resp.status !== 200) {
      throw new UpdateHttpError(`HTTP ${resp.status}: ${url}`, resp.status);
    }
    // A 200 means the server ignored the range and is resending the whole file.
    const appended = resp.status === 206 && startOffset > 0;
    opts.onStart?.(appended);
    const base = appended ? startOffset : 0;
    const contentLength = Number(resp.headers.get('content-length') ?? 0);
    const total = appended ? base + contentLength : contentLength;
    const reader = resp.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await resp.arrayBuffer());
      await onChunk(bytes, base + bytes.byteLength, total || bytes.byteLength);
      return appended;
    }
    let loaded = base;
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
    return appended;
  } catch (e) {
    if (e instanceof UpdateHttpError) {
      throw e;
    }
    throw friendlyError(e);
  }
}
