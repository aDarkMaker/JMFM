import {parse} from 'node-html-parser';
import {AlbumDetail, Episode, PhotoDetail} from '../../../src/core/model';
import {extractBase64Html} from './base64';

export function parseAlbumDetail(html: string): AlbumDetail {
  const decoded = extractBase64Html(html);
  const root = parse(decoded);

  const albumId = extractAlbumId(decoded, root);
  const scrambleId = extractScrambleId(decoded);
  const name = extractBookName(decoded, root);
  const episodes = extractEpisodes(root);

  return {
    albumId,
    name,
    description: '',
    author: '',
    tags: [],
    scrambleId,
    episodes,
  };
}

export function parsePhotoDetail(html: string): PhotoDetail {
  const decoded = extractBase64Html(html);
  const root = parse(decoded);

  const photoId = extractPhotoId(decoded, root);
  const scrambleId = extractScrambleId(decoded);
  const albumId = extractSeriesId(decoded);
  const pageArr = extractPageArr(decoded);
  const totalPics = extractTotalPics(decoded);
  const {cdnBaseUrl, queryParams} = extractCdnBase(decoded, root);

  const files = pageArr.length > 0 ? pageArr : [];
  return {
    photoId,
    name: '',
    sort: 0,
    albumId,
    scrambleId,
    pageArr: files,
    totalPics,
    cdnBaseUrl,
    queryParams,
  };
}

function extractAlbumId(html: string, root: ReturnType<typeof parse>): number {
  const el = root.querySelector('[class*="number"]');
  if (el) {
    const m = /JM(\d+)/.exec(el.textContent);
    if (m) {
      return Number(m[1]);
    }
  }
  const m = /：\s*JM(\d+)/.exec(html);
  return m ? Number(m[1]) : 0;
}

function extractScrambleId(html: string): number {
  const m = /var\s+scramble_id\s*=\s*(\d+)\s*;/.exec(html);
  return m ? Number(m[1]) : 0;
}

function extractBookName(html: string, root: ReturnType<typeof parse>): string {
  const el = root.querySelector('[id="book-name"]');
  if (el) {
    return el.textContent.trim();
  }
  const m = /id="book-name"[^>]*>([\s\S]*?)</.exec(html);
  return m ? m[1].trim() : '';
}

function extractEpisodes(root: ReturnType<typeof parse>): Episode[] {
  const els = root.querySelectorAll('[data-album]');
  const episodes: Episode[] = [];
  for (const el of els) {
    const photoId = Number(el.getAttribute('data-album'));
    if (!photoId) {
      continue;
    }
    const m = /第\s*(\d+)\s*[话話]\s*([\s\S]*)/.exec(el.textContent);
    const sort = m ? Number(m[1]) : episodes.length + 1;
    const name = m ? m[2].trim() : el.textContent.trim();
    episodes.push({photoId, sort, name});
  }
  return episodes;
}

function extractPhotoId(html: string, root: ReturnType<typeof parse>): number {
  const meta = root.querySelector('meta[property="og:url"]');
  if (meta) {
    const m = /\/photo\/(\d+)/.exec(meta.getAttribute('content') ?? '');
    if (m) {
      return Number(m[1]);
    }
  }
  const m = /\/photo\/(\d+)/.exec(html);
  return m ? Number(m[1]) : 0;
}

function extractSeriesId(html: string): number {
  const m = /var\s+series_id\s*=\s*(\d+)\s*;/.exec(html);
  return m ? Number(m[1]) : 0;
}

function extractPageArr(html: string): string[] {
  const m = /var\s+page_arr\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
  if (!m) {
    return [];
  }
  try {
    const arr = JSON.parse(m[1].replace(/'/g, '"'));
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function extractTotalPics(html: string): number {
  const m = /var\s+total_pics\s*=\s*(\d+)\s*;/.exec(html);
  return m ? Number(m[1]) : 0;
}

function extractCdnBase(
  html: string,
  root: ReturnType<typeof parse>
): {cdnBaseUrl: string; queryParams: string} {
  const firstImg = root.querySelector('img[data-original]');
  const raw = firstImg?.getAttribute('data-original') ?? '';
  if (raw) {
    return splitCdnUrl(raw);
  }
  const m = /data-original="([^"]+)"/.exec(html);
  return m ? splitCdnUrl(m[1]) : {cdnBaseUrl: '', queryParams: ''};
}

function splitCdnUrl(raw: string): {cdnBaseUrl: string; queryParams: string} {
  const [path, query] = raw.split('?', 2);
  const lastSlash = path.lastIndexOf('/');
  const cdnBaseUrl = lastSlash > 0 ? `${path.slice(0, lastSlash + 1)}` : path;
  return {cdnBaseUrl, queryParams: query ?? ''};
}
