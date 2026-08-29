import {HttpClient} from '@/core/net';
import {DownloadService, DownloadEvent, ContentSource, isCanceledError} from '@/core/download';
import {DownloadRuntime, FileSystem} from '@/core/download/types';
import {AlbumDetail, PhotoDetail, createImageItem} from '@/core/model';
import {base64ToBytes} from '@/core/util/base64';

const album: AlbumDetail = {
  albumId: 123,
  name: '测试本子',
  description: '',
  author: '',
  tags: [],
  scrambleId: 400,
  episodes: [
    {photoId: 100200, sort: 1, name: '第一章'},
    {photoId: 100300, sort: 2, name: '第二章'},
  ],
};

function makePhoto(photoId: number): PhotoDetail {
  return {
    photoId,
    name: `chapter-${photoId}`,
    sort: 1,
    albumId: 123,
    scrambleId: 400,
    pageArr: ['1.webp', '2.webp'],
    totalPics: 2,
    cdnBaseUrl: `https://cdn-msp.jmapiproxy1.cc/media/photos/${photoId}/`,
    queryParams: '',
  };
}

function makeSource(): ContentSource {
  return {
    getAlbum: async () => album,
    getPhoto: async (id) => makePhoto(id),
    buildImageItems: (photo) => photo.pageArr.map((name, i) => createImageItem(photo, name, i)),
  };
}

function makeRuntime(): DownloadRuntime & {
  writes: Map<string, Uint8Array>;
  calls: {decode: number};
} {
  const writes = new Map<string, Uint8Array>();
  const calls = {decode: 0};
  const fs: FileSystem = {
    mkdir: async () => undefined,
    writeFile: async (path, data) => {
      writes.set(path, typeof data === 'string' ? base64ToBytes(data) : data);
    },
    appendFile: async (path, data) => {
      const chunk = typeof data === 'string' ? base64ToBytes(data) : data;
      const prev = writes.get(path);
      if (!prev) {
        writes.set(path, chunk);
        return;
      }
      const merged = new Uint8Array(prev.length + chunk.length);
      merged.set(prev, 0);
      merged.set(chunk, prev.length);
      writes.set(path, merged);
    },
    readFile: async (path) => writes.get(path) ?? new Uint8Array(),
    unlink: async () => undefined,
    rename: async (oldPath, newPath) => {
      const data = writes.get(oldPath);
      if (data) {
        writes.set(newPath, data);
        writes.delete(oldPath);
      }
    },
    size: async (path) => writes.get(path)?.length ?? -1,
    exists: async (path) => writes.has(path),
  };
  return {
    fs,
    writes,
    calls,
    decodeAndSave: async (_num, encoded, ext) => {
      calls.decode += 1;
      return {width: 100, height: 100, bytes: encoded, ext};
    },
  };
}

function makeHttp(): HttpClient {
  return {
    getBytes: jest.fn(async () => {
      return {ok: true, status: 200, bytes: new Uint8Array(100).fill(1)};
    }),
  } as unknown as HttpClient;
}

describe('DownloadService end-to-end', () => {
  it('downloads album -> chapters -> images', async () => {
    const runtime = makeRuntime();
    const http = makeHttp();
    const service = new DownloadService({
      http,
      source: makeSource(),
      runtime,
      downloadPath: '/downloads',
      concurrency: 4,
      cpuCount: 4,
    });

    const events: DownloadEvent[] = [];
    const albumDir = await service.downloadAlbum(123, (e) => events.push(e));

    expect(albumDir).toBe('/downloads/测试本子');
    expect(events.map((e) => e.type)).toEqual([
      'album-parsed',
      'chapter',
      'image',
      'image',
      'chapter',
      'image',
      'image',
      'done',
    ]);
    const albumParsed = events.find((e) => e.type === 'album-parsed');
    expect(albumParsed?.title).toBe('测试本子');
    expect(albumParsed?.chapters).toBe(2);
    expect(runtime.writes.size).toBe(5);
    expect(runtime.writes.has('/downloads/测试本子/pages/0001.webp')).toBe(true);
    expect(runtime.calls.decode).toBe(4);
    expect(http.getBytes).toHaveBeenCalledTimes(4);
  });

  it('reports error when album fetch fails', async () => {
    const runtime = makeRuntime();
    const http = makeHttp();
    const source: ContentSource = {
      getAlbum: async () => {
        throw new Error('failed to fetch album');
      },
      getPhoto: async () => makePhoto(1),
      buildImageItems: () => [],
    };
    const service = new DownloadService({
      http,
      source,
      runtime,
      downloadPath: '/downloads',
    });

    const events: DownloadEvent[] = [];
    await expect(service.downloadAlbum(123, (e) => events.push(e))).rejects.toThrow(
      'failed to fetch album'
    );
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('skips existing files on resume', async () => {
    const runtime = makeRuntime();
    const http = makeHttp();
    const service = new DownloadService({
      http,
      source: makeSource(),
      runtime,
      downloadPath: '/downloads',
      concurrency: 4,
      cpuCount: 4,
    });

    runtime.writes.set('/downloads/测试本子/pages/0001.webp', new Uint8Array(100).fill(9));
    runtime.writes.set('/downloads/测试本子/pages/0002.webp', new Uint8Array(100).fill(9));

    const events: DownloadEvent[] = [];
    await service.downloadAlbum(123, (e) => events.push(e));

    expect(http.getBytes).toHaveBeenCalledTimes(2);
    expect(runtime.calls.decode).toBe(2);
    expect(runtime.writes.size).toBe(5);
    expect(events.filter((e) => e.type === 'image').length).toBe(4);
    expect(events.filter((e) => e.type === 'done').length).toBe(1);
  });

  it('cancels when controller is set', async () => {
    const runtime = makeRuntime();
    const http = makeHttp();
    const service = new DownloadService({
      http,
      source: makeSource(),
      runtime,
      downloadPath: '/downloads',
      concurrency: 1,
      cpuCount: 4,
    });

    const controller = {
      paused: false,
      cancel() {
        this.paused = true;
      },
    };
    const events: DownloadEvent[] = [];

    let cancelled = false;
    const origGetBytes = http.getBytes;
    http.getBytes = jest.fn(async (url, headers) => {
      const r = await origGetBytes(url, headers);
      if (!cancelled) {
        controller.cancel();
        cancelled = true;
      }
      return r;
    });

    await expect(service.downloadAlbum(123, (e) => events.push(e), {controller})).rejects.toThrow(
      'canceled'
    );

    expect(events.some((e) => e.type === 'canceled')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('isCanceledError detects cancellation', () => {
    const controller = {paused: true, cancel() {}};
    const service = new DownloadService({
      http: makeHttp(),
      source: makeSource(),
      runtime: makeRuntime(),
      downloadPath: '/downloads',
    });

    return service
      .downloadAlbum(123, () => {}, {controller})
      .catch((e) => {
        expect(isCanceledError(e)).toBe(true);
      });
  });
});
