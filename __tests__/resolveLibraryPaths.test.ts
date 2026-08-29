import {parsePickedDirectory, resolveItemPaths} from '@/web/library/resolveLibraryPaths';
import {sanitizeTitle} from '@/core/util/filename';
import type {LibraryItem} from '@/web/stores/library';

function item(title: string, pagesDir?: string, coverPath?: string): LibraryItem {
  return {
    albumId: 1,
    title,
    chapterCount: 1,
    filePath: pagesDir?.replace(/\/pages$/, '') ?? `${title}`,
    pagesDir,
    coverPath,
    downloadedAt: 0,
  };
}

describe('parsePickedDirectory', () => {
  it('decodes URL-encoded SAF tree URIs', () => {
    expect(
      parsePickedDirectory(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload'
      )
    ).toBe('Download/JMFDownloads');
  });

  it('keeps Documents/JMFDownloads without duplicating app dir', () => {
    expect(
      parsePickedDirectory(
        'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FJMFDownloads'
      )
    ).toBe('Documents/JMFDownloads');
  });

  it('handles plain paths', () => {
    expect(parsePickedDirectory('/Download')).toBe('Download/JMFDownloads');
  });

  it('avoids duplicating the app dir', () => {
    expect(parsePickedDirectory('content://.../tree/primary%3AJMFDownloads')).toBe('JMFDownloads');
  });

  it('falls back to app dir on unparseable input', () => {
    expect(parsePickedDirectory('')).toBe('JMFDownloads');
    expect(parsePickedDirectory('content://')).toBe('JMFDownloads');
  });
});

describe('resolveItemPaths', () => {
  it('keeps items whose pagesDir already exists', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages');
    const exists = async (p: string) => p === 'JMFMobile/downloads/测试/pages';
    expect(await resolveItemPaths(it, 'New/dir', exists)).toBeNull();
  });

  it('remaps to current downloadPath when found', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages');
    const exists = async (p: string) => p === 'New/dir/测试/pages';
    const fixed = await resolveItemPaths(it, 'New/dir', exists);
    expect(fixed).not.toBeNull();
    expect(fixed!.pagesDir).toBe('New/dir/测试/pages');
    expect(fixed!.filePath).toBe('New/dir/测试');
  });

  it('falls back to legacy prefixes', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages');
    const exists = async (p: string) => p === 'JMFMobile/JMFDownloads/测试/pages';
    const fixed = await resolveItemPaths(it, 'New/dir', exists);
    expect(fixed).not.toBeNull();
    expect(fixed!.pagesDir).toBe('JMFMobile/JMFDownloads/测试/pages');
  });

  it('returns null when files are nowhere', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages');
    expect(await resolveItemPaths(it, 'New/dir', async () => false)).toBeNull();
  });

  it('repairs coverPath when old cover is missing', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages', 'old/cover.jpg');
    const exists = async (p: string) =>
      p === 'New/dir/测试/pages' || p === 'New/dir/测试/cover.jpg';
    const fixed = await resolveItemPaths(it, 'New/dir', exists);
    expect(fixed!.coverPath).toBe('New/dir/测试/cover.jpg');
  });

  it('keeps old coverPath when it still exists', async () => {
    const it = item('测试', 'JMFMobile/downloads/测试/pages', 'old/cover.jpg');
    const exists = async (p: string) => p === 'New/dir/测试/pages' || p === 'old/cover.jpg';
    const fixed = await resolveItemPaths(it, 'New/dir', exists);
    expect(fixed!.coverPath).toBe('old/cover.jpg');
  });
});

describe('sanitizeTitle', () => {
  it('replaces illegal path characters', () => {
    expect(sanitizeTitle('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('trims and defaults empty', () => {
    expect(sanitizeTitle('   ')).toBe('untitled');
    expect(sanitizeTitle('')).toBe('untitled');
  });

  it('caps length at 200', () => {
    expect(sanitizeTitle('x'.repeat(300)).length).toBe(200);
  });
});
