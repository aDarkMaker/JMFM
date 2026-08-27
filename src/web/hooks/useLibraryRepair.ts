import {useCallback, useState} from 'react';
import {createRuntime} from '../../core/download/runtime';
import {createHttpClient} from '../../core/net';
import {ApiClient} from '../../core/api';
import {scanLibraryRepair, repairItem, deleteAlbumDir} from '../library/repairLibrary';
import {useLibraryStore} from '../stores/library';
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

interface RepairProgress {
  done: number;
  total: number;
}

export function useLibraryRepair(imageFormat: string) {
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState<RepairProgress | null>(null);
  const {enqueueAlbum} = useDownloadTask();

  const runRepair = useCallback(
    async (issues: {item: LibraryItem; defects: Defect[]}[]): Promise<RepairOutcome> => {
      setRepairing(true);
      try {
        const downloadPath = useSettingsStore.getState().settings.downloadPath;
        const http = createHttpClient({});
        const runtime = createRuntime();
        const source = new ApiClient(http);
        const deps = {
          http,
          source,
          runtime,
          downloadPath,
          imageFormat: imageFormat === 'webp' ? ('webp' as const) : ('jpg' as const),
        };
        let repaired = 0;
        let redownloaded = 0;
        for (const {item} of issues) {
          const result = await repairItem(deps, item);
          if (result.kind === 'missing') {
            await deleteAlbumDir(item);
            enqueueAlbum(item.albumId, item.title);
            redownloaded += 1;
          } else {
            useLibraryStore.getState().patchItem(item.albumId, {
              title: item.title,
              author: item.author,
              tags: item.tags,
              pageCount: item.pageCount,
              coverPath: item.coverPath,
            });
            repaired += 1;
          }
          setRepairProgress({done: repaired + redownloaded, total: issues.length});
        }
        const message =
          `完成，补齐 ${repaired} 本` +
          (redownloaded > 0 ? `，${redownloaded} 本需重新下载（已加入任务队列）` : '');
        return {kind: 'alert', title: '修复文件', message};
      } catch (err) {
        return {
          kind: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        };
      } finally {
        setRepairing(false);
        setRepairProgress(null);
      }
    },
    [enqueueAlbum, imageFormat],
  );

  const handleRepair = useCallback(
    async (libraryItems: LibraryItem[]): Promise<RepairOutcome> => {
      if (repairing) {
        return {kind: 'none'};
      }
      if (libraryItems.length === 0) {
        return {kind: 'alert', title: '修复文件', message: '漫画库为空，无需修复'};
      }
      setRepairing(true);
      try {
        const downloadPath = useSettingsStore.getState().settings.downloadPath;
        const {compliant, remapped, issues} = await scanLibraryRepair(
          libraryItems,
          imageFormat,
          downloadPath,
        );
        for (const item of remapped) {
          useLibraryStore.getState().patchItem(item.albumId, {
            filePath: item.filePath,
            pagesDir: item.pagesDir,
            coverPath: item.coverPath,
          });
        }
        const total = libraryItems.length;
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
        setRepairProgress(null);
      }
    },
    [repairing, imageFormat],
  );

  return {repairing, repairProgress, runRepair, handleRepair};
}
