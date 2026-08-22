import {config} from '../../config';
import {SCRAMBLE} from '../constants';
import {HttpClient} from '../net';
import {AlbumDetail, Episode, ImageItem, PhotoDetail, createImageItem} from '../model';
import {aesEcbDecrypt, md5Hex} from '../crypto';
import {utf8Decode} from '../util/utf8';

function stripNonAsciiPrefix(text: string): string {
  let s = text;
  while (s && s.charCodeAt(0) > 127) {
    s = s.slice(1);
  }
  return s;
}

function defaultScrambleId(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : SCRAMBLE.SCRAMBLE_220980;
}

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
    for (const url of config.domains.apiDomainServers) {
      try {
        const resp = await this.http.getBytes(url);
        if (!resp.ok || !resp.bytes) {
          continue;
        }
        const text = stripNonAsciiPrefix(utf8Decode(resp.bytes)).trim();
        const json = aesEcbDecrypt(text, config.app.domainServerSecret);
        const servers = JSON.parse(json).Server as string[];
        if (Array.isArray(servers) && servers.length > 0) {
          this.domains = servers;
          this.domainInitialized = true;
          return this.domains;
        }
      } catch {
        // fall through to next domain server
      }
    }
    return this.domains;
  }

  async getAlbum(albumId: number): Promise<AlbumDetail> {
    const data = await this.req('/album', {id: albumId});
    const id = Number(data.id);
    const name = String(data.name ?? '');
    let episodes = this.parseEpisodes(data.series);
    if (episodes.length === 0) {
      episodes = [{photoId: id, sort: 1, name}];
    }
    return {
      albumId: id,
      name,
      description: String(data.description ?? ''),
      author: Array.isArray(data.author)
        ? data.author.join(', ')
        : String(data.author ?? ''),
      tags: Array.isArray(data.tags) ? data.tags : [],
      scrambleId: defaultScrambleId(data.scramble_id),
      episodes,
    };
  }

  async getPhoto(photoId: number): Promise<PhotoDetail> {
    const data = await this.req('/chapter', {id: photoId});
    const images: string[] = Array.isArray(data.images) ? data.images : [];
    const id = Number(data.id);
    const cdns = config.domains.cdn;
    const domain = cdns[id % cdns.length];
    return {
      photoId: id,
      name: String(data.name ?? ''),
      sort: this.parseSort(data),
      albumId: Number(data.series_id ?? 0),
      scrambleId: defaultScrambleId(data.scramble_id),
      pageArr: images,
      totalPics: images.length,
      cdnBaseUrl: `https://${domain}/media/photos/${id}/`,
      queryParams: '',
    };
  }

  buildImageUrls(photo: PhotoDetail): string[] {
    return photo.pageArr.map(name => {
      if (photo.cdnBaseUrl) {
        const q = photo.queryParams ? `?${photo.queryParams}` : '';
        return `${photo.cdnBaseUrl}${name}${q}`;
      }
      const cdns = config.domains.cdn;
      const domain = cdns[photo.photoId % cdns.length];
      return `https://${domain}/media/photos/${photo.photoId}/${name}`;
    });
  }

  buildImageItems(photo: PhotoDetail): ImageItem[] {
    return photo.pageArr.map((name, i) => createImageItem(photo, name, i));
  }

  private parseEpisodes(series: unknown): Episode[] {
    if (!Array.isArray(series) || series.length === 0) {
      return [];
    }
    return series.map((it: {id: unknown; sort: unknown; name: unknown}) => ({
      photoId: Number(it.id),
      sort: Number(it.sort ?? 1),
      name: String(it.name ?? ''),
    }));
  }

  private parseSort(data: {series?: unknown; id?: unknown}): number {
    if (!Array.isArray(data.series)) {
      return 1;
    }
    for (const ch of data.series as {id: unknown; sort?: unknown}[]) {
      if (Number(ch.id) === Number(data.id)) {
        return Number(ch.sort ?? 1);
      }
    }
    return 1;
  }

  private async req(
    path: string,
    params: Record<string, number>,
  ): Promise<Record<string, unknown>> {
    const domains = await this.refreshDomains();
    const ts = String(Math.floor(Date.now() / 1000));
    const token = md5Hex(`${ts}${config.app.tokenSecret}`);
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const headers = {
      'user-agent': config.request.userAgentMobile,
      Accept: config.request.acceptApi,
      'Accept-Encoding': config.request.acceptEncoding,
      Referer: config.request.referer,
      token,
      tokenparam: `${ts},${config.app.version}`,
    };
    const urls = domains.map(d => `https://${d}${path}?${query}`);
    const resp = await this.http.getBytesWithUrls(urls, headers);
    if (!resp.ok || !resp.bytes) {
      throw new Error(`api request failed: ${path}`);
    }
    const text = utf8Decode(resp.bytes);
    const body = JSON.parse(text) as {code: number; data: string};
    if (body.code !== 200) {
      throw new Error(`api error code ${body.code}`);
    }
    return JSON.parse(
      aesEcbDecrypt(body.data, `${ts}${config.app.dataSecret}`),
    );
  }
}
