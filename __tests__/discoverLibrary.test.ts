import {
  albumIdForLocalPath,
  backfillCoverPaths,
  dedupeLibraryItems,
  discoverLibraryFromDisk,
  mergeDiscovered,
  mergeLibraryDuplicates,
  parseLocalMeta,
  repairAlbumIdsFromTitle,
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
  files?: Record<string, boolean>;
}

function scanner(fixture: Fixture): LibraryScanner {
  return {
    listDirs: async (path) => fixture.dirs[path] ?? [],
    listFiles: async (path) => {
      const files: string[] = [];
      if (fixture.files) {
        const prefix = `${path}/`;
        for (const [p, exists] of Object.entries(fixture.files)) {
          if (!exists) continue;
          if (p.startsWith(prefix)) {
            const rest = p.slice(prefix.length);
            if (!rest.includes('/')) files.push(rest);
          }
        }
      }
      return files;
    },
    listImages: async (path) => fixture.pages[path] ?? [],
    readMeta: async (path) => fixture.metas[path] ?? null,
    fileExists: async (path) => fixture.files?.[path] ?? false,
  };
}

describe('parseLocalMeta', () => {
  it('parses a valid meta object', () => {
    const meta = parseLocalMeta(
      JSON.stringify({albumId: 42, title: '标题', author: '作者', tags: ['a', 'b'], pageCount: 5})
    );
    expect(meta).toMatchObject({
      albumId: 42,
      title: '标题',
      author: '作者',
      tags: ['a', 'b'],
      pageCount: 5,
    });
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
    expect(merged.map((i) => i.title)).toEqual(['A', 'B']);
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

  it('dedupes same album across normalized path prefixes', () => {
    const existing = [item('测试', 'JMFDownloads/测试/pages', 1_000_000_001)];
    const discovered = [item('测试', 'Documents/JMFDownloads/测试/pages', 1_000_000_002)];
    const merged = mergeDiscovered(existing, discovered, 'Documents/JMFDownloads');
    expect(merged).toHaveLength(1);
  });

  it('dedupes local items by title when pagesDir differs', () => {
    const existing = [item('标题A', 'base/x/pages', 1_000_000_001)];
    const discovered = [item('标题A', 'other/y/pages', 1_000_000_002)];
    const merged = mergeDiscovered(existing, discovered, 'base');
    expect(merged).toHaveLength(1);
  });
});

describe('dedupeLibraryItems', () => {
  it('merges same comic under different hashed ids, keeping coverPath', () => {
    const items = [
      item('标题', 'Documents/JMFDownloads/标题/pages', 1_000_000_001),
      {
        ...item('标题', 'JMFDownloads/标题/pages', 1_000_000_002),
        coverPath: 'JMFDownloads/标题/cover.jpg',
      },
    ];
    const deduped = dedupeLibraryItems(items, 'Documents/JMFDownloads');
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.coverPath).toBe('JMFDownloads/标题/cover.jpg');
  });

  it('merges same comic keeping real albumId', () => {
    const items = [
      item('标题', 'Documents/JMFDownloads/标题/pages', 1_000_000_001),
      {
        ...item('标题', 'JMFDownloads/标题/pages', 42),
        coverPath: 'JMFDownloads/标题/cover.jpg',
      },
    ];
    const deduped = dedupeLibraryItems(items, 'Documents/JMFDownloads');
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.albumId).toBe(42);
    expect(deduped[0]!.coverPath).toBe('JMFDownloads/标题/cover.jpg');
  });

  it('mergeLibraryDuplicates prefers real albumId', () => {
    const target = item('A', 'base/A/pages', 1_000_000_001);
    const incoming = {...item('A', 'base/A/pages', 42), coverPath: 'base/A/cover.jpg'};
    const merged = mergeLibraryDuplicates(target, incoming, 'base');
    expect(merged.albumId).toBe(42);
    expect(merged.coverPath).toBe('base/A/cover.jpg');
  });

  it('keeps distinct albums', () => {
    const items = [
      item('A', 'Documents/JMFDownloads/A/pages', 1_000_000_001),
      item('B', 'Documents/JMFDownloads/B/pages', 1_000_000_002),
    ];
    expect(dedupeLibraryItems(items, 'Documents/JMFDownloads')).toHaveLength(2);
  });
});

describe('backfillCoverPaths', () => {
  it('sets cover.jpg for existing items without coverPath', async () => {
    const fixture: Fixture = {
      dirs: {},
      pages: {},
      metas: {},
      files: {'Documents/JMFDownloads/漫画A/cover.jpg': true},
    };
    const items = [
      {
        ...item('漫画A', 'Documents/JMFDownloads/漫画A/pages', 1),
        filePath: 'Documents/JMFDownloads/漫画A',
      },
    ];
    const {items: patched, changed} = await backfillCoverPaths(
      items,
      'Documents/JMFDownloads',
      scanner(fixture)
    );
    expect(changed).toBe(true);
    expect(patched[0]!.coverPath).toBe('Documents/JMFDownloads/漫画A/cover.jpg');
  });
});

describe('repairAlbumIdsFromTitle', () => {
  it('resolves hash id by exact title match', async () => {
    const items = [
      {
        ...item('真实标题', 'Documents/JMFDownloads/真实标题/pages', 1_000_000_001),
        filePath: 'Documents/JMFDownloads/真实标题',
      },
    ];
    const resolver = {
      searchAlbums: async () => ({
        albums: [{albumId: 42, name: '真实标题'}],
      }),
    };
    const {items: patched, changed} = await repairAlbumIdsFromTitle(items, resolver);
    expect(changed).toBe(true);
    expect(patched[0]!.albumId).toBe(42);
  });

  it('keeps hash id when search has no exact title match', async () => {
    const items = [
      {
        ...item('标题A', 'Documents/JMFDownloads/标题A/pages', 1_000_000_001),
        filePath: 'Documents/JMFDownloads/标题A',
      },
    ];
    const resolver = {
      searchAlbums: async () => ({
        albums: [{albumId: 42, name: '别的标题'}],
      }),
    };
    const {items: patched, changed} = await repairAlbumIdsFromTitle(items, resolver);
    expect(changed).toBe(false);
    expect(patched[0]!.albumId).toBe(1_000_000_001);
  });

  it('keeps item when search fails', async () => {
    const items = [
      {
        ...item('标题B', 'Documents/JMFDownloads/标题B/pages', 1_000_000_002),
        filePath: 'Documents/JMFDownloads/标题B',
      },
    ];
    const resolver = {
      searchAlbums: async () => {
        throw new Error('network');
      },
    };
    const {items: patched, changed} = await repairAlbumIdsFromTitle(items, resolver);
    expect(changed).toBe(false);
    expect(patched[0]!.albumId).toBe(1_000_000_002);
  });

  it('skips items that already have real album ids', async () => {
    const items = [item('已有', 'Documents/JMFDownloads/已有/pages', 7)];
    const resolver = {
      searchAlbums: async () => {
        throw new Error('should not search');
      },
    };
    const {changed} = await repairAlbumIdsFromTitle(items, resolver);
    expect(changed).toBe(false);
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
      scanner(fixture)
    );
    const byTitle = new Map(found.map((i) => [i.title, i]));
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
    const fresh = found.find((i) => i.albumId === 9);
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

  it('discovers cover.jpg when meta has no coverPath', async () => {
    const fixture4: Fixture = {
      dirs: {'Documents/JMFDownloads': ['漫画A']},
      pages: {'Documents/JMFDownloads/漫画A/pages': ['0001.webp']},
      metas: {'Documents/JMFDownloads/漫画A': null},
      files: {'Documents/JMFDownloads/漫画A/cover.jpg': true},
    };
    const found = await discoverLibraryFromDisk(
      [],
      'Documents/JMFDownloads',
      scanner(fixture4),
      'content://tree/primary%3ADocuments%2FJMFDownloads'
    );
    expect(found[0]!.coverPath).toBe('Documents/JMFDownloads/漫画A/cover.jpg');
  });

  it('prefers canonical cover.jpg over stale meta coverPath', async () => {
    const fixture5: Fixture = {
      dirs: {'Documents/JMFDownloads': ['漫画B']},
      pages: {'Documents/JMFDownloads/漫画B/pages': ['0001.webp']},
      metas: {
        'Documents/JMFDownloads/漫画B': {
          title: '漫画B',
          coverPath: 'JMFDownloads/漫画B/cover.jpg',
        },
      },
      files: {
        'Documents/JMFDownloads/漫画B/cover.jpg': true,
        'JMFDownloads/漫画B/cover.jpg': false,
      },
    };
    const found = await discoverLibraryFromDisk(
      [],
      'Documents/JMFDownloads',
      scanner(fixture5),
      'content://tree/primary%3ADocuments%2FJMFDownloads'
    );
    expect(found[0]!.coverPath).toBe('Documents/JMFDownloads/漫画B/cover.jpg');
  });

  it('falls back to meta coverPath when canonical missing but meta file exists', async () => {
    const fixture6: Fixture = {
      dirs: {'Documents/JMFDownloads': ['漫画C']},
      pages: {'Documents/JMFDownloads/漫画C/pages': ['0001.webp']},
      metas: {
        'Documents/JMFDownloads/漫画C': {
          title: '漫画C',
          coverPath: 'Documents/JMFDownloads/漫画C/cover.png',
        },
      },
      files: {'Documents/JMFDownloads/漫画C/cover.png': true},
    };
    const found = await discoverLibraryFromDisk(
      [],
      'Documents/JMFDownloads',
      scanner(fixture6),
      'content://tree/primary%3ADocuments%2FJMFDownloads'
    );
    expect(found[0]!.coverPath).toBe('Documents/JMFDownloads/漫画C/cover.png');
  });

  it('discovers cover.jpg via listFiles when fileExists fails', async () => {
    const fixture7: Fixture = {
      dirs: {'Documents/JMFDownloads': ['漫画D']},
      pages: {'Documents/JMFDownloads/漫画D/pages': ['0001.webp']},
      metas: {'Documents/JMFDownloads/漫画D': null},
      files: {'Documents/JMFDownloads/漫画D/cover.jpg': true},
    };
    const base = scanner(fixture7);
    const flaky: LibraryScanner = {
      ...base,
      fileExists: async () => false,
    };
    const found = await discoverLibraryFromDisk(
      [],
      'Documents/JMFDownloads',
      flaky,
      'content://tree/primary%3ADocuments%2FJMFDownloads'
    );
    expect(found[0]!.coverPath).toBe('Documents/JMFDownloads/漫画D/cover.jpg');
  });
});
