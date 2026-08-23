import {HttpClient} from '@/core/net';
import {DownloadService, DownloadEvent, ContentSource} from '@/core/download';
import {DownloadRuntime, FileSystem} from '@/core/download/types';
import {AlbumDetail, PhotoDetail, createImageItem} from '@/core/model';

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
    getPhoto: async id => makePhoto(id),
    buildImageItems: photo =>
      photo.pageArr.map((name, i) => createImageItem(photo, name, i)),
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
      writes.set(path, data);
    },
    readFile: async path => writes.get(path) ?? new Uint8Array(),
    unlink: async () => undefined,
  };
  return {
    fs,
    writes,
    calls,
    decodeAndSave: async (_num, encoded, ext) => {
      calls.decode += 1;
      return {width: 100, height: 100, bytes: encoded, ext};
    },
    createAlbumPdf: async (dir, title, _imagePaths) => {
      return `${dir}/${title}.pdf`;
    },
  };
}

function makeHttp(): HttpClient {
  return {
    getBytes: jest.fn(async () => {
      return {ok: true, status: 200, bytes: new Uint8Array([1, 2, 3])};
    }),
  } as unknown as HttpClient;
}

describe('DownloadService end-to-end', () => {
  it('downloads album -> chapters -> images -> pdf', async () => {
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
    const pdfPath = await service.downloadAlbum(123, e => events.push(e));

    expect(pdfPath).toBe('/downloads/123/测试本子.pdf');
    expect(events.map(e => e.type)).toEqual([
      'album-parsed',
      'chapter',
      'image',
      'image',
      'chapter',
      'image',
      'image',
      'pdf-start',
      'done',
    ]);
    expect(runtime.writes.size).toBe(4);
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
    await expect(
      service.downloadAlbum(123, e => events.push(e)),
    ).rejects.toThrow('failed to fetch album');
    expect(events.some(e => e.type === 'error')).toBe(true);
  });
});
