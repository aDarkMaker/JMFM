import {REQUEST} from '../constants';

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
  error?: string;
}

export interface HttpClient {
  getHtml(
    path: string,
    domains?: readonly string[],
    headers?: Record<string, string>
  ): Promise<FetchResult>;
  getBytes(url: string, headers?: Record<string, string>): Promise<FetchResult>;
  getBytesWithUrls(urls: string[], headers?: Record<string, string>): Promise<FetchResult>;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const DEFAULT_MAX_RETRIES = REQUEST.MAX_RETRIES;

export function buildBaseUrls(domains: readonly string[], path: string): string[] {
  return domains.flatMap((d) => [`https://${d}${path}`, `http://${d}${path}`]);
}
