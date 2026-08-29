import {useCallback} from 'react';
import {scanLibraryRepair, needsRedownload} from '../library/repairLibrary';
import {
  useLibraryStore,
  waitForLibraryLoaded,
  ensureRealAlbumIds,
  isHashAlbumId,
} from '../stores/library';
import {useSettingsStore} from '../stores/settings';
import {useRepairStore} from '../stores/repair';
import {useDownloadTask} from './useDownloadTask';
import type {LibraryItem} from '../stores/library';
import type {Defect} from '../library/repairLibrary';

export type RepairOutcome =
  | {kind: 'none'}
  | {kind: 'alert'; title: string; message: string}
  | {
      kind: 'confirm';
      issues: {item: LibraryItem; defects: Defect[]}[];
      total: number;
      count: number;
      compliant: number;
    };

export function useLibraryRepair(imageFormat: string) {
  const {enqueueAlbumsForRepair} = useDownloadTask();

  const runRepair = useCallback(
    async (issues: {item: LibraryItem; defects: Defect[]}[]): Promise<RepairOutcome> => {
      if (useRepairStore.getState().phase === 'scanning') {
        return {kind: 'none'};
      }
      try {
        await ensureRealAlbumIds();
        const byPath = new Map(
          useLibraryStore.getState().items.map((i) => [i.filePath, i] as const)
        );
        const toQueue = issues
          .filter(({defects}) => needsRedownload(defects))
          .map(({item}) => byPath.get(item.filePath) ?? item)
          .filter((item) => !isHashAlbumId(item.albumId))
          .map((item) => ({albumId: item.albumId, title: item.title}));
        const skippedHash = issues.filter(({item, defects}) => {
          if (!needsRedownload(defects)) return false;
          const latest = byPath.get(item.filePath) ?? item;
          return isHashAlbumId(latest.albumId);
        }).length;
        const queued = enqueueAlbumsForRepair(toQueue);
        let message = `已将 ${queued} 本添加到下载队列`;
        if (skippedHash > 0) {
          message += `（${skippedHash} 本无法识别 ID，已跳过）`;
        }
        useRepairStore.getState().setQueued(`已添加 ${queued} 本，进度见「下载」页`);
        return {kind: 'alert', title: '修复文件', message};
      } catch (err) {
        useRepairStore.getState().reset();
        return {
          kind: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [enqueueAlbumsForRepair]
  );

  const handleRepair = useCallback(
    async (libraryItems: LibraryItem[]): Promise<RepairOutcome> => {
      if (useRepairStore.getState().phase === 'scanning') {
        return {kind: 'none'};
      }
      await waitForLibraryLoaded();
      let items = libraryItems;
      if (items.length === 0) {
        await useLibraryStore.getState().load();
        items = useLibraryStore.getState().items;
      }
      if (items.length === 0) {
        const {downloadTreeUri} = useSettingsStore.getState().settings;
        if (!downloadTreeUri) {
          return {
            kind: 'alert',
            title: '修复文件',
            message: '漫画库为空。请在设置中重新选择下载目录，以导入已有漫画。',
          };
        }
        return {kind: 'alert', title: '修复文件', message: '漫画库为空，无需修复'};
      }
      useRepairStore.getState().beginScan();
      try {
        items = await ensureRealAlbumIds();
        const {downloadPath, downloadTreeUri} = useSettingsStore.getState().settings;
        const {compliant, remapped, issues} = await scanLibraryRepair(
          items,
          imageFormat,
          downloadPath,
          downloadTreeUri,
          (done, total) => useRepairStore.getState().setScanProgress(done, total)
        );
        for (const item of remapped) {
          useLibraryStore.getState().patchItem(item.albumId, {
            filePath: item.filePath,
            pagesDir: item.pagesDir,
            coverPath: item.coverPath,
          });
        }
        const redownloadIssues = issues.filter(({defects}) => needsRedownload(defects));
        const total = items.length;
        if (redownloadIssues.length === 0) {
          const message =
            remapped.length > 0
              ? `已恢复 ${remapped.length} 本的下载路径，其余资源完整（共 ${total} 本）`
              : `所有资源均完整（共 ${total} 本）`;
          useRepairStore.getState().reset();
          return {kind: 'alert', title: '修复文件', message};
        }
        useRepairStore.getState().reset();
        return {
          kind: 'confirm',
          issues: redownloadIssues,
          total,
          count: redownloadIssues.length,
          compliant,
        };
      } catch (err) {
        useRepairStore.getState().reset();
        return {
          kind: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [imageFormat]
  );

  return {runRepair, handleRepair};
}
