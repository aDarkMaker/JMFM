import {REQUEST} from '../constants';
import {base64ToBytes} from '../util/base64';

export interface HttpOptions {
  proxy?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text?: string;
  bytes?: Uint8Array;
  /** Native CapacitorHttp binary responses carry base64 directly, avoiding decode-then-re-encode. */
  base64?: string;
  error?: string;
  /** False for 4xx (no point retrying); unset/true means retryable. */
  retryable?: boolean;
}

/** Resolves response bytes; decodes base64 lazily. */
export function bytesOf(result: FetchResult): Uint8Array | undefined {
  if (result.bytes && result.bytes.length > 0) {
    return result.bytes;
  }
  if (result.base64) {
    const bytes = base64ToBytes(result.base64);
    return bytes.length > 0 ? bytes : undefined;
  }
  return undefined;
}

export interface HttpClient {
  getBytes(url: string, headers?: Record<string, string>): Promise<FetchResult>;
  getBytesWithUrls(urls: string[], headers?: Record<string, string>): Promise<FetchResult>;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const DEFAULT_MAX_RETRIES = REQUEST.MAX_RETRIES;

export function buildBaseUrls(domains: readonly string[], path: string): string[] {
  return domains.flatMap((d) => [`https://${d}${path}`, `http://${d}${path}`]);
}
