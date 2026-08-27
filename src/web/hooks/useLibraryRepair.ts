import {useCallback, useState} from 'react';
import {scanLibraryRepair} from '../library/repairLibrary';
import {useLibraryStore, waitForLibraryLoaded} from '../stores/library';
import {useSettingsStore} from '../stores/settings';
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
  const [repairing, setRepairing] = useState(false);
  const {enqueueAlbumsForRepair} = useDownloadTask();

  const runRepair = useCallback(
    async (issues: {item: LibraryItem; defects: Defect[]}[]): Promise<RepairOutcome> => {
      if (repairing) {
        return {kind: 'none'};
      }
      setRepairing(true);
      try {
        const albums = issues.map(({item}) => ({albumId: item.albumId, title: item.title}));
        const queued = enqueueAlbumsForRepair(albums);
        return {kind: 'alert', title: '修复文件', message: `已将 ${queued} 本添加到下载队列`};
      } catch (err) {
        return {
          kind: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        };
      } finally {
        setRepairing(false);
      }
    },
    [enqueueAlbumsForRepair, repairing]
  );

  const handleRepair = useCallback(
    async (libraryItems: LibraryItem[]): Promise<RepairOutcome> => {
      if (repairing) {
        return {kind: 'none'};
      }
      await waitForLibraryLoaded();
      let items = libraryItems;
      if (items.length === 0) {
        // Re-scan disk in case metadata was empty on a previous load.
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
      setRepairing(true);
      try {
        const {downloadPath, downloadTreeUri} = useSettingsStore.getState().settings;
        const {compliant, remapped, issues} = await scanLibraryRepair(
          items,
          imageFormat,
          downloadPath,
          downloadTreeUri
        );
        for (const item of remapped) {
          useLibraryStore.getState().patchItem(item.albumId, {
            filePath: item.filePath,
            pagesDir: item.pagesDir,
            coverPath: item.coverPath,
          });
        }
        const total = items.length;
        if (issues.length === 0) {
          const message =
            remapped.length > 0
              ? `已恢复 ${remapped.length} 本的下载路径，其余资源完整（共 ${total} 本）`
              : `所有资源均完整（共 ${total} 本）`;
          return {kind: 'alert', title: '修复文件', message};
        }
        return {kind: 'confirm', issues, total, count: issues.length, compliant};
      } catch (err) {
        return {
          kind: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        };
      } finally {
        setRepairing(false);
      }
    },
    [repairing, imageFormat]
  );

  return {repairing, runRepair, handleRepair};
}
