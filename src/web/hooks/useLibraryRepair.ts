import {useCallback, useState} from 'react';
import {createRuntime} from '../../core/download/runtime';
import {scanLibraryRepair, repairLibraryItems} from '../library/repairLibrary';
import {useDownloadStore} from '../stores/download';
import {useDownloadTask} from './useDownloadTask';
import type {LibraryItem} from '../stores/library';

export type RepairOutcome =
  | {kind: 'none'}
  | {kind: 'alert'; title: string; message: string}
  | {
      kind: 'confirm';
      payload: LibraryItem[];
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
    async (needsRepair: LibraryItem[]): Promise<RepairOutcome> => {
      setRepairing(true);
      try {
        const runtime = createRuntime();
        await repairLibraryItems(needsRepair, runtime.fs, (done, total) => {
          setRepairProgress({done, total});
        });
        for (const item of needsRepair) {
          const existing = useDownloadStore.getState().tasks.find(
            t => t.albumId === item.albumId,
          );
          if (existing) {
            existing.controller?.cancel();
            useDownloadStore.getState().remove(existing.id);
          }
        }
        for (const item of needsRepair) {
          enqueueAlbum(item.albumId, item.title);
        }
        return {
          kind: 'alert',
          title: '资源修复',
          message: `已将 ${needsRepair.length} 本加入下载队列，可到任务页查看进度`,
        };
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
    [enqueueAlbum],
  );

  const handleRepair = useCallback(
    async (libraryItems: LibraryItem[]): Promise<RepairOutcome> => {
      if (repairing) {
        return {kind: 'none'};
      }
      if (libraryItems.length === 0) {
        return {kind: 'alert', title: '资源修复', message: '漫画库为空，无需修复'};
      }
      setRepairing(true);
      try {
        const {compliant, needsRepair} = await scanLibraryRepair(
          libraryItems,
          imageFormat,
        );
        const total = libraryItems.length;
        if (needsRepair.length === 0) {
          return {
            kind: 'alert',
            title: '资源修复',
            message: `所有资源已是最新格式（共 ${total} 本）`,
          };
        }
        return {
          kind: 'confirm',
          payload: needsRepair,
          total,
          count: needsRepair.length,
          compliant,
        };
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
