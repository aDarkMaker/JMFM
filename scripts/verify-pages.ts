import {AxiosHttpClient} from './shared/axios-http';
import {ApiClient} from '../src/core/api';
import {sleep} from '../src/core/net';
import {filterBlockedAlbums} from '../src/core/model/blocklist';
import {IMAGE_EXT_SET, extOf} from '../src/core/model';
import type {AlbumSummary} from '../src/core/model';
import {buildRecommendations} from '../src/web/library/daily';
import {
  LibraryScanner,
  discoverLibraryFromDisk,
  mergeDiscovered,
} from '../src/web/library/discoverLibrary';
import {useDownloadStore} from '../src/web/stores/download';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const LIB_DIR = `${process.cwd()}/temp`;
const BLACKLIST = process.env.JMF_BLACKLIST?.split(',').filter(Boolean) ?? [];

function log(step: string, detail: string): void {
  console.log(`[${new Date().toISOString()}] ${step}: ${detail}`);
}

async function fetchPool(api: ApiClient, pages: number): Promise<AlbumSummary[]> {
  const byId = new Map<number, AlbumSummary>();
  for (let page = 1; page <= pages; page++) {
    const {albums} = await api.getLatestAlbums(page, {order: 'mr_t'});
    if (albums.length === 0) break;
    for (const album of albums) {
      if (album.updateAt != null && !byId.has(album.albumId)) {
        byId.set(album.albumId, album);
      }
    }
    await sleep(400);
  }
  return [...byId.values()];
}

function nodeScanner(): LibraryScanner {
  const list = (path: string) => {
    try {
      return existsSync(path) ? readdirSync(path) : [];
    } catch {
      return [];
    }
  };
  return {
    async listDirs(path) {
      return list(path).filter((n) => statSync(join(path, n)).isDirectory());
    },
    async listFiles(path) {
      return list(path).filter((n) => statSync(join(path, n)).isFile());
    },
    async listImages(path) {
      return list(path).filter(
        (n) => statSync(join(path, n)).isFile() && IMAGE_EXT_SET.has(extOf(n))
      );
    },
    async readMeta(path) {
      const file = join(path, '.jmf-meta.json');
      if (!existsSync(file)) {
        return null;
      }
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';
        if (!title) return null;
        return {
          albumId: typeof raw.albumId === 'number' ? raw.albumId : undefined,
          title,
          author: typeof raw.author === 'string' ? raw.author : undefined,
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
        };
      } catch {
        return null;
      }
    },
    async fileExists(path) {
      return existsSync(path);
    },
  };
}

async function verifyHome(api: ApiClient): Promise<void> {
  const pool = await fetchPool(api, 3);
  const kept = filterBlockedAlbums(pool, BLACKLIST);
  const picks = buildRecommendations(kept, [], 6);
  log(
    'home',
    `pool=${pool.length} after blacklist=${kept.length} picks=${picks.length}`
  );
  if (picks.length === 0) return;
  for (const album of picks) {
    const detail = await api.getAlbum(album.albumId).catch(() => null);
    log(
      'home-pick',
      JSON.stringify({
        albumId: album.albumId,
        title: album.name.slice(0, 40),
        tags: detail?.tags ?? album.tags ?? [],
        episodes: detail?.episodes.length ?? 0,
      })
    );
    await sleep(1200);
  }
  if (picks.length < 6) {
    console.error(`home: expected 6 picks, got ${picks.length}`);
    process.exitCode = 1;
  }
}

async function verifyTags(api: ApiClient, count: number): Promise<void> {
  const {albums} = await api.getLatestAlbums(1, {order: 'mr_t'});
  const seen = new Set<string>();
  const sample = Math.min(count, albums.length);
  let tagged = 0;
  for (let i = 0; i < sample; i++) {
    const album = albums[i]!;
    try {
      const detail = await api.getAlbum(album.albumId);
      for (const tag of detail.tags) {
        seen.add(tag);
      }
      if (detail.tags.length > 0) tagged += 1;
    } catch {
      // skip failed detail
    }
    await sleep(1200);
  }
  log('tags', `distinct tags from ${sample} albums: ${seen.size}, tagged=${tagged}/${sample}`);
  if (sample > 0 && tagged === 0) {
    console.error('tags: no album returned tags; content verification failed');
    process.exitCode = 1;
  }
}

async function verifyLibrary(): Promise<void> {
  if (!existsSync(LIB_DIR)) {
    log('library', `no ${LIB_DIR} yet; run verify first`);
    return;
  }
  const discovered = await discoverLibraryFromDisk([], LIB_DIR, nodeScanner());
  const merged = mergeDiscovered([], discovered, LIB_DIR);
  log(
    'library',
    `discovered=${discovered.length} merged=${merged.length} dirs=${readdirSync(LIB_DIR).length}`
  );
  for (const item of merged.slice(0, 3)) {
    log(
      'library-item',
      JSON.stringify({
        albumId: item.albumId,
        title: item.title.slice(0, 40),
        pages: item.pageCount,
        cover: Boolean(item.coverPath),
      })
    );
  }
}

async function verifyTaskMachine(): Promise<void> {
  const s = useDownloadStore.getState();
  s.add({id: 'v1', albumId: 999001, title: 'Verify Album'});
  s.setStatus('v1', 'running');
  s.updateProgress('v1', 3, 10);
  s.pauseAll();
  const paused = useDownloadStore.getState().tasks[0]!.status;
  s.resumeAll();
  const resumed = useDownloadStore.getState().tasks[0]!.status;
  s.setStatus('v1', 'done');
  const done = useDownloadStore.getState().tasks[0]!.status;
  s.remove('v1');
  log('task-machine', `pause=${paused} resume=${resumed} done=${done}`);
}

async function main(): Promise<void> {
  const count = Number(process.argv[2] ?? 2);
  const http = new AxiosHttpClient({
    ...(process.env.JMF_PROXY ? {proxy: process.env.JMF_PROXY} : {}),
    timeoutMs: 15000,
    maxRetries: 3,
  });
  const api = new ApiClient(http);
  await verifyHome(api);
  await verifyTags(api, count);
  await verifyLibrary();
  await verifyTaskMachine();
  log('finish', 'ok');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
