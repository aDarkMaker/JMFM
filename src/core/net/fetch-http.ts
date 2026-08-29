import {REQUEST} from '../constants';
import {FetchResult, HttpClient, HttpOptions} from './http';
import {requestWithRetry} from './retry';
import {fetchOnce} from './fetch-once';

export class FetchHttpClient implements HttpClient {
  protected opts: HttpOptions;

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
      fetchOnce(url, headers, binary, this.opts.timeoutMs ?? REQUEST.READ_TIMEOUT_MS)
    );
  }
}
