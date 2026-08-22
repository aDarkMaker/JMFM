import axios, {AxiosInstance} from 'axios';
import {HTML_DOMAINS, REQUEST} from '../constants';

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
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function buildBaseUrls(domains: readonly string[], path: string): string[] {
  return domains.flatMap(d => [
    `https://${d}${path}`,
    `http://${d}${path}`,
  ]);
}

function parseProxy(proxy: string): {host: string; port: number} | undefined {
  const [host, port] = proxy.split(':');
  const p = Number(port);
  return host && p ? {host, port: p} : undefined;
}

function buildClient(opts: HttpOptions): AxiosInstance {
  return axios.create({
    timeout: opts.timeoutMs ?? REQUEST.READ_TIMEOUT_MS,
    headers: {
      'User-Agent': REQUEST.USER_AGENT,
      ...opts.headers,
    },
    ...(opts.proxy ? {proxy: parseProxy(opts.proxy)} : {}),
  });
}

export class HttpClient {
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
    const client = buildClient(this.opts);
    const maxRetries = this.opts.maxRetries ?? REQUEST.MAX_RETRIES;
    for (const url of urls) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await this.tryOnce(client, url, headers, binary);
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
    client: AxiosInstance,
    url: string,
    headers: Record<string, string> | undefined,
    binary: boolean,
  ): Promise<FetchResult> {
    try {
      const resp = await client.get(url, {
        headers,
        responseType: binary ? 'arraybuffer' : 'text',
      });
      const ok = resp.status >= 200 && resp.status < 300;
      if (!ok) {
        return {ok: false, status: resp.status};
      }
      if (binary) {
        const buf = resp.data as ArrayBuffer;
        return {ok: true, status: resp.status, bytes: new Uint8Array(buf)};
      }
      return {ok: true, status: resp.status, text: String(resp.data)};
    } catch {
      return {ok: false, status: 0};
    }
  }
}
