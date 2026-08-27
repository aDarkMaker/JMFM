import {
  albumIdForLocalPath,
  discoverLibraryFromDisk,
  mergeDiscovered,
  parseLocalMeta,
} from '@/web/library/discoverLibrary';
import type {LocalAlbumMeta, LibraryScanner} from '@/web/library/discoverLibrary';
import type {LibraryItem} from '@/web/stores/library';

function item(title: string, pagesDir?: string, albumId = 1): LibraryItem {
  return {
    albumId,
    title,
    chapterCount: 1,
    filePath: pagesDir?.replace(/\/pages$/, '') ?? title,
    pagesDir,
    downloadedAt: 0,
  };
}

interface Fixture {
  dirs: Record<string, string[]>;
  pages: Record<string, string[]>;
  metas: Record<string, LocalAlbumMeta | null>;
}

function scanner(fixture: Fixture): LibraryScanner {
  return {
    listDirs: async path => fixture.dirs[path] ?? [],
    listImages: async path => fixture.pages[path] ?? [],
    readMeta: async path => fixture.metas[path] ?? null,
  };
}

describe('parseLocalMeta', () => {
  it('parses a valid meta object', () => {
    const meta = parseLocalMeta(
      JSON.stringify({albumId: 42, title: '标题', author: '作者', tags: ['a', 'b'], pageCount: 5}),
    );
    expect(meta).toMatchObject({albumId: 42, title: '标题', author: '作者', tags: ['a', 'b'], pageCount: 5});
  });

  it('rejects invalid JSON or empty titles', () => {
    expect(parseLocalMeta('not json')).toBeNull();
    expect(parseLocalMeta(JSON.stringify({title: '  '}))).toBeNull();
    expect(parseLocalMeta('null')).toBeNull();
  });
});

describe('albumIdForLocalPath', () => {
  it('is stable across calls and within the local offset range', () => {
    const a = albumIdForLocalPath('Download/JMFDownloads/abc/pages');
    expect(a).toBe(albumIdForLocalPath('Download/JMFDownloads/abc/pages'));
    expect(a).toBeGreaterThanOrEqual(1_000_000_000);
  });

  it('varies by path', () => {
    expect(albumIdForLocalPath('x/pages')).not.toBe(albumIdForLocalPath('y/pages'));
  });
});

describe('mergeDiscovered', () => {
  it('dedupes by pagesDir', () => {
    const existing = [item('A', 'base/A/pages', 1)];
    const discovered = [
      item('A', 'base/A/pages', 1_000_000_001),
      item('B', 'base/B/pages', 1_000_000_002),
    ];
    const merged = mergeDiscovered(existing, discovered);
    expect(merged.map(i => i.title)).toEqual(['A', 'B']);
  });

  it('skips discovered items whose real albumId already exists', () => {
    const existing = [item('A', 'other/A/pages', 42)];
    const discovered = [item('A', 'new/A/pages', 42)];
    const merged = mergeDiscovered(existing, discovered);
    expect(merged).toHaveLength(1);
  });

  it('keeps discovered items with hashed ids when no overlap', () => {
    const existing = [item('A', 'base/A/pages', 1)];
    const discovered = [item('C', 'base/C/pages', 1_000_000_003)];
    const merged = mergeDiscovered(existing, discovered);
    expect(merged).toHaveLength(2);
  });
});

describe('discoverLibraryFromDisk', () => {
  const fixture: Fixture = {
    dirs: {
      'Download/JMFDownloads': ['测试', '未命名'],
    },
    pages: {
      'Download/JMFDownloads/测试/pages': ['0001.webp', '0002.webp', '0003.webp'],
      'Download/JMFDownloads/未命名/pages': ['0001.jpg', '0002.jpg'],
    },
    metas: {
      'Download/JMFDownloads/测试': {
        albumId: 7,
        title: '测试',
        tags: ['abc'],
        pageCount: 3,
      },
      'Download/JMFDownloads/未命名': null,
    },
  };

  it('discovers albums with and without meta, respecting dedup', async () => {
    const existing = [item('测试', 'Download/JMFDownloads/测试/pages', 7)];
    const found = await discoverLibraryFromDisk(
      existing,
      'Download/JMFDownloads',
      scanner(fixture),
    );
    const byTitle = new Map(found.map(i => [i.title, i]));
    expect(byTitle.has('测试')).toBe(false);
    const unnamed = byTitle.get('未命名')!;
    expect(unnamed.pageCount).toBe(2);
    expect(unnamed.albumId).toBeGreaterThanOrEqual(1_000_000_000);
    expect(unnamed.filePath).toBe('Download/JMFDownloads/未命名');
  });

  it('discovers meta-backed items across legacy prefixes', async () => {
    const fixture2: Fixture = {
      dirs: {'JMFMobile/downloads': ['新本']},
      pages: {'JMFMobile/downloads/新本/pages': ['0001.webp']},
      metas: {'JMFMobile/downloads/新本': {albumId: 9, title: '新本', pageCount: 1}},
    };
    const found = await discoverLibraryFromDisk([], 'Download/JMFDownloads', scanner(fixture2));
    const fresh = found.find(i => i.albumId === 9);
    expect(fresh).toBeDefined();
    expect(fresh!.title).toBe('新本');
  });

  it('discovers albums under Documents/JMFDownloads', async () => {
    const fixture3: Fixture = {
      dirs: {'Documents/JMFDownloads': ['本地漫画']},
      pages: {'Documents/JMFDownloads/本地漫画/pages': ['0001.webp', '0002.webp']},
      metas: {'Documents/JMFDownloads/本地漫画': null},
    };
    const found = await discoverLibraryFromDisk([], 'JMFMobile/downloads', scanner(fixture3));
    expect(found).toHaveLength(1);
    expect(found[0]!.pagesDir).toBe('Documents/JMFDownloads/本地漫画/pages');
  });

  it('skips directories without image pages', async () => {
    const fixture3: Fixture = {
      dirs: {'Download/JMFDownloads': ['空目录']},
      pages: {},
      metas: {'Download/JMFDownloads/空目录': null},
    };
    const found = await discoverLibraryFromDisk([], 'Download/JMFDownloads', scanner(fixture3));
    expect(found).toHaveLength(0);
  });
});
