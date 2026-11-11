import {beforeEach, describe, expect, mock, test} from 'bun:test';

type Settings = {downloadPath: string; downloadTreeUri?: string};

let settings: Settings = {downloadPath: 'JMFDownloads'};
const files = new Map<string, boolean>();
const probed: string[] = [];

mock.module('@/web/stores/settings', () => ({
  useSettingsStore: {getState: () => ({settings})},
}));

mock.module('@/core/fs/saf/safStorage', () => ({
  safEntryExists: async (_treeUri: string, rel: string) => {
    probed.push(rel);
    return files.get(rel) === true;
  },
  safGetEntryUri: async (_treeUri: string, rel: string) => `content://tree/${rel}`,
  safListDirectory: async () => [],
}));

mock.module('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    convertFileSrc: (uri: string) => `https://localhost/_capacitor_content_/${uri}`,
  },
}));

mock.module('@capacitor/filesystem', () => ({
  Directory: {Documents: 'DOCUMENTS'},
  Filesystem: {
    stat: async ({path}: {path: string}) => {
      if (files.get(path) !== true) throw new Error('missing');
      return {};
    },
    getUri: async ({path}: {path: string}) => ({uri: `file:///docs/${path}`}),
  },
}));

const {clearCoverCache, resolveCoverSrc} = await import('@/web/library/coverCache');

beforeEach(() => {
  clearCoverCache();
  probed.length = 0;
  files.clear();
  settings = {downloadPath: 'JMFDownloads'};
});

describe('resolveCoverSrc with SAF', () => {
  test('falls back to albumDir/cover.jpg when the stored path is gone', async () => {
    settings = {downloadPath: 'JMFDownloads', downloadTreeUri: 'content://tree'};
    files.set('Title/cover.jpg', true);

    const src = await resolveCoverSrc('JMFDownloads/Title/cover.jpg', 'JMFDownloads/Title');

    expect(probed).toEqual(['Title/cover.jpg']);
    expect(src).toBe('https://localhost/_capacitor_content_/content://tree/Title/cover.jpg');
  });

  test('probes the stored path before the album fallback', async () => {
    settings = {downloadPath: 'JMFDownloads', downloadTreeUri: 'content://tree'};
    files.set('Old/cover.png', true);

    await resolveCoverSrc('JMFDownloads/Old/cover.png', 'JMFDownloads/New');

    expect(probed).toEqual(['Old/cover.png']);
  });

  test('returns null when no candidate exists', async () => {
    settings = {downloadPath: 'JMFDownloads', downloadTreeUri: 'content://tree'};

    const src = await resolveCoverSrc('JMFDownloads/Gone/cover.jpg', 'JMFDownloads/Gone');

    expect(probed).toEqual(['Gone/cover.jpg']);
    expect(src).toBeNull();
  });

  test('reuses the cached src without probing again', async () => {
    settings = {downloadPath: 'JMFDownloads', downloadTreeUri: 'content://tree'};
    files.set('Title/cover.jpg', true);

    await resolveCoverSrc('JMFDownloads/Title/cover.jpg', 'JMFDownloads/Title');
    await resolveCoverSrc('JMFDownloads/Title/cover.jpg', 'JMFDownloads/Title');

    expect(probed).toHaveLength(1);
  });
});

describe('resolveCoverSrc with Documents', () => {
  test('skips missing candidates in order', async () => {
    files.set('JMFDownloads/B/cover.jpg', true);

    const src = await resolveCoverSrc('JMFDownloads/A/cover.jpg', 'JMFDownloads/B');

    expect(src).toBe('https://localhost/_capacitor_content_/file:///docs/JMFDownloads/B/cover.jpg');
  });

  test('returns null when the file is absent', async () => {
    const src = await resolveCoverSrc('JMFDownloads/C/cover.jpg', 'JMFDownloads/C');

    expect(src).toBeNull();
  });
});

describe('resolveCoverSrc with remote paths', () => {
  test('passes http paths through untouched', async () => {
    const src = await resolveCoverSrc('https://cdn.example/cover.jpg');

    expect(src).toBe('https://cdn.example/cover.jpg');
  });
});
