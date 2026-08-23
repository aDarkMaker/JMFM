import {CapacitorHttp} from '@capacitor/core';
import {HTML_DOMAINS, REQUEST} from '../constants';
import {base64ToBytes} from '../util/base64';
import {buildBaseUrls, FetchResult, HttpClient, HttpOptions} from './http';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class NativeHttpClient implements HttpClient {
  private opts: HttpOptions;

  constructor(opts: HttpOptions = {}) {
    this.opts = opts;
  }

  async getHtml(
    path: string,
    domains: readonly string[] = HTML_DOMAINS,
    headers?: Record<string, string>,
  ): Promise<FetchResult> {
    const urls = buildBaseUrls(domains, path);
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
      const resp = await CapacitorHttp.get({
        url,
        headers,
        responseType: binary ? 'arraybuffer' : 'text',
        connectTimeout: this.opts.timeoutMs ?? REQUEST.CONNECT_TIMEOUT_MS,
        readTimeout: this.opts.timeoutMs ?? REQUEST.READ_TIMEOUT_MS,
      });
      const ok = resp.status >= 200 && resp.status < 300;
      if (!ok) {
        return {ok: false, status: resp.status};
      }
      if (binary) {
        return {
          ok: true,
          status: resp.status,
          bytes: base64ToBytes(String(resp.data)),
        };
      }
      return {ok: true, status: resp.status, text: String(resp.data)};
    } catch {
      return {ok: false, status: 0};
    }
  }
}
