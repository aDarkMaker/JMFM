import {config} from '../../config';
import {HttpClient, bytesOf} from '../net';
import {retry} from '../net/retry';
import {AlbumDetail, AlbumSummary, ImageItem, PhotoDetail, createImageItem} from '../model';
import {aesEcbDecrypt, md5Hex} from '../crypto';
import {utf8Decode} from '../util/utf8';
import {parseAlbumDetail, parseAlbumList, parsePhotoDetail} from './parse';

function stripNonAsciiPrefix(text: string): string {
  let s = text;
  while (s && s.charCodeAt(0) > 127) {
    s = s.slice(1);
  }
  return s;
}

/** Shared across ApiClient instances so domain probing happens at most once per run. */
let sharedDomains: string[] | null = null;
let sharedDomainsJob: Promise<string[]> | null = null;

export class ApiClient {
  private http: HttpClient;
  private domains: string[] = [...config.domains.api];
  private domainInitialized = false;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async refreshDomains(): Promise<string[]> {
    if (this.domainInitialized) {
      return this.domains;
    }
    if (sharedDomains) {
      this.domains = sharedDomains;
      this.domainInitialized = true;
      return this.domains;
    }
    if (!sharedDomainsJob) {
      sharedDomainsJob = this.probeDomains()
        .then((servers) => {
          sharedDomains = servers;
          this.domains = servers;
          this.domainInitialized = true;
          return servers;
        })
        .finally(() => {
          sharedDomainsJob = null;
        });
    }
    return sharedDomainsJob;
  }

  private async probeDomains(): Promise<string[]> {
    for (const url of config.domains.apiDomainServers) {
      try {
        const resp = await this.http.getBytes(url);
        const bytes = bytesOf(resp);
        if (!resp.ok || !bytes) {
          continue;
        }
        const text = stripNonAsciiPrefix(utf8Decode(bytes)).trim();
        const json = aesEcbDecrypt(text, config.app.domainServerSecret);
        const servers = JSON.parse(json).Server as string[];
        if (Array.isArray(servers) && servers.length > 0) {
          return servers;
        }
      } catch {
        // fall through to next domain server
      }
    }
    return this.domains;
  }

  async getAlbum(albumId: number): Promise<AlbumDetail> {
    const data = await this.req('/album', {id: albumId});
    return parseAlbumDetail(data);
  }

  async getPhoto(photoId: number): Promise<PhotoDetail> {
    const data = await this.req('/chapter', {id: photoId});
    return parsePhotoDetail(data);
  }

  /** Latest / filtered album list. Default o=mr_t = today by latest. */
  async getLatestAlbums(
    page = 1,
    opts?: {order?: string; category?: string}
  ): Promise<{albums: AlbumSummary[]; total: number}> {
    const data = await this.req('/categories/filter', {
      page,
      order: '',
      c: opts?.category ?? '0',
      o: opts?.order ?? 'mr_t',
    });
    return parseAlbumList(data);
  }

  async searchAlbums(query: string, page = 1): Promise<{albums: AlbumSummary[]; total: number}> {
    const data = await this.req('/search', {
      search_query: query,
      page,
    });
    return parseAlbumList(data);
  }

  buildImageItems(photo: PhotoDetail): ImageItem[] {
    return photo.pageArr.map((name, i) => createImageItem(photo, name, i));
  }

  private async req(
    path: string,
    params: Record<string, string | number>
  ): Promise<Record<string, unknown>> {
    const domains = await this.refreshDomains();
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    const urls = domains.map((d) => `https://${d}${path}?${query}`);
    // Source rate-limits by returning code=200 with empty data or corrupted
    // ciphertext; wait out the 2s window and retry, keep the interval semantic.
    return retry(
      async () => {
        const ts = String(Math.floor(Date.now() / 1000));
        const token = md5Hex(`${ts}${config.app.tokenSecret}`);
        const headers = {
          Token: token,
          Tokenparam: `${ts},${config.app.apiTokenVersion}`,
        };
        const resp = await this.http.getBytesWithUrls(urls, headers);
        const bytes = bytesOf(resp);
        if (!resp.ok || !bytes) {
          const detail = resp.error ? `; ${resp.error}` : '';
          throw new Error(`api request failed: ${path} (status ${resp.status}${detail})`);
        }
        const text = utf8Decode(bytes);
        let body: {code: number; data: unknown};
        try {
          body = JSON.parse(text) as {code: number; data: unknown};
        } catch (e) {
          throw new Error(`api response parse failed: ${path} (${resp.bytes?.length ?? 0} bytes)`, {
            cause: e,
          });
        }
        if (body.code !== 200) {
          throw new Error(`api error code ${body.code}`);
        }
        const data = typeof body.data === 'string' ? body.data : '';
        if (!data) {
          throw new Error(`api empty data: ${path} (${resp.bytes?.length ?? 0} bytes)`);
        }
        try {
          return JSON.parse(aesEcbDecrypt(data, `${ts}${config.app.dataSecret}`)) as Record<
            string,
            unknown
          >;
        } catch (e) {
          throw new Error(`api decrypt failed: ${path} (data ${data.length} chars)`, {cause: e});
        }
      },
      3,
      2000
    );
  }
}
