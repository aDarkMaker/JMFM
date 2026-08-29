import {CapacitorHttp} from '@capacitor/core';
import {REQUEST} from '../constants';
import {FetchResult, HttpClient, HttpOptions} from './http';
import {requestWithRetry} from './retry';
import {fetchOnce, isRetryableStatus} from './fetch-once';
import {isValidBase64, bytesToBase64} from '../util/base64';

export class NativeHttpClient implements HttpClient {
  private opts: HttpOptions;

  constructor(opts: HttpOptions = {}) {
    this.opts = opts;
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
        return {
          ok: false,
          status: resp.status,
          error: `HTTP ${resp.status}`,
          retryable: isRetryableStatus(resp.status),
        };
      }
      if (binary) {
        if (resp.data == null || resp.data === '') {
          return {ok: false, status: resp.status, retryable: true, error: 'empty body'};
        }
        if (typeof resp.data === 'object') {
          // Content-Type: application/json makes the native plugin parse the body
          // into a JS object even for responseType=arraybuffer; re-encode the JSON
          // text so consumers (ApiClient.req) can parse it back.
          const jsonText = JSON.stringify(resp.data);
          return {
            ok: true,
            status: resp.status,
            base64: bytesToBase64(new TextEncoder().encode(jsonText)),
          };
        }
        const data = String(resp.data);
        if (!isValidBase64(data)) {
          // Source returns 200 with non-base64 garbage (HTML/JSON error pages);
          // fall through to the next domain instead of treating it as success.
          return {ok: false, status: resp.status, retryable: true, error: 'invalid body'};
        }
        return {
          ok: true,
          status: resp.status,
          base64: data,
        };
      }
      return {ok: true, status: resp.status, text: String(resp.data)};
    } catch (e) {
      const nativeMsg = e instanceof Error ? e.message : String(e);
      // native stack failure falls back to the WebView fetch (same Chromium stack as desktop)
      const fallback = await fetchOnce(url, headers, binary);
      if (fallback.ok || !fallback.error) {
        return fallback;
      }
      return {
        ...fallback,
        error: `${host}: native=${nativeMsg}; web=${fallback.error}`,
      };
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
