import {CapacitorHttp} from '@capacitor/core';
import {HTML_DOMAINS, REQUEST} from '../constants';
import {base64ToBytes} from '../util/base64';
import {buildBaseUrls, FetchResult, HttpClient, HttpOptions} from './http';
import {requestWithRetry} from './retry';

export class NativeHttpClient implements HttpClient {
  private opts: HttpOptions;

  constructor(opts: HttpOptions = {}) {
    this.opts = opts;
  }

  async getHtml(
    path: string,
    domains: readonly string[] = HTML_DOMAINS,
    headers?: Record<string, string>
  ): Promise<FetchResult> {
    const urls = buildBaseUrls(domains, path);
    return this.request(urls, headers, false);
  }

  async getBytes(url: string, headers?: Record<string, string>): Promise<FetchResult> {
    return this.request([url], headers, true);
  }

  async getBytesWithUrls(urls: string[], headers?: Record<string, string>): Promise<FetchResult> {
    return this.request(urls, headers, true);
  }

  private request(
    urls: string[],
    headers: Record<string, string> | undefined,
    binary: boolean
  ): Promise<FetchResult> {
    return requestWithRetry(urls, this.opts.maxRetries, (url) =>
      this.tryOnce(url, headers, binary)
    );
  }

  private async tryOnce(
    url: string,
    headers: Record<string, string> | undefined,
    binary: boolean
  ): Promise<FetchResult> {
    const host = this.hostOf(url);
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
        return {ok: false, status: resp.status, error: `HTTP ${resp.status}`};
      }
      if (binary) {
        return {
          ok: true,
          status: resp.status,
          bytes: base64ToBytes(String(resp.data)),
        };
      }
      return {ok: true, status: resp.status, text: String(resp.data)};
    } catch (e) {
      const nativeMsg = e instanceof Error ? e.message : String(e);
      // native stack failure falls back to the WebView fetch (same Chromium stack as desktop)
      try {
        const resp = await fetch(url, {headers: headers as HeadersInit});
        const ok = resp.status >= 200 && resp.status < 300;
        if (!ok) {
          return {ok: false, status: resp.status, error: `HTTP ${resp.status}`};
        }
        if (binary) {
          const buf = await resp.arrayBuffer();
          return {ok: true, status: resp.status, bytes: new Uint8Array(buf)};
        }
        return {ok: true, status: resp.status, text: await resp.text()};
      } catch (e2) {
        const webMsg = e2 instanceof Error ? e2.message : String(e2);
        return {
          ok: false,
          status: 0,
          error: `${host}: native=${nativeMsg}; web=${webMsg}`,
        };
      }
    }
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }
}
