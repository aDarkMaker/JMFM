import {REQUEST} from '../constants';
import {FetchResult, HttpClient, HttpOptions} from './http';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class FetchHttpClient implements HttpClient {
  private opts: HttpOptions;

  constructor(opts: HttpOptions = {}) {
    this.opts = opts;
  }

  async getHtml(
    path: string,
    domains?: readonly string[],
    headers?: Record<string, string>,
  ): Promise<FetchResult> {
    const {buildBaseUrls} = await import('./http');
    const urls = buildBaseUrls(domains ?? [], path);
    return this.request(urls, headers, false);
  }

  async getBytes(
    url: string,
    headers?: Record<string, string>,
  ): Promise<FetchResult> {
    return this.request([url], headers, true);
  }

  async getBytesWithUrls(
    urls: string[],
    headers?: Record<string, string>,
  ): Promise<FetchResult> {
    return this.request(urls, headers, true);
  }

  private async request(
    urls: string[],
    headers: Record<string, string> | undefined,
    binary: boolean,
  ): Promise<FetchResult> {
    const maxRetries = this.opts.maxRetries ?? REQUEST.MAX_RETRIES;
    for (const url of urls) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await this.tryOnce(url, headers, binary);
        if (result.ok) {
          return result;
        }
        if (attempt < maxRetries - 1) {
          await sleep(REQUEST.RETRY_INTERVAL_MS);
        }
      }
    }
    return {ok: false, status: 0};
  }

  private async tryOnce(
    url: string,
    headers: Record<string, string> | undefined,
    binary: boolean,
  ): Promise<FetchResult> {
    try {
      const resp = await fetch(url, {
        headers: headers as HeadersInit,
        credentials: 'include',
      });
      const ok = resp.status >= 200 && resp.status < 300;
      if (!ok) {
        return {ok: false, status: resp.status};
      }
      if (binary) {
        const buf = await resp.arrayBuffer();
        return {ok: true, status: resp.status, bytes: new Uint8Array(buf)};
      }
      return {ok: true, status: resp.status, text: await resp.text()};
    } catch {
      return {ok: false, status: 0};
    }
  }
}
