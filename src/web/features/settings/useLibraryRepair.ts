import {t} from '@/web/i18n';
import {useCallback} from 'react';
import {scanLibraryRepair, needsRedownload} from '@/web/library/repairLibrary';
import {
  useLibraryStore,
  waitForLibraryLoaded,
  ensureRealAlbumIds,
  isHashAlbumId,
} from '@/web/stores/library';
import {useSettingsStore} from '@/web/stores/settings';
import {useRepairStore} from '@/web/stores/repair';
import {useDownloadTask} from '@/web/hooks/useDownloadTask';
import type {LibraryItem} from '@/web/stores/library';
import type {Defect} from '@/web/library/repairLibrary';

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
        let message = t('repair.queued', {count: queued});
        if (skippedHash > 0) {
          message += t('repair.skipped', {count: skippedHash});
        }
        useRepairStore.getState().setQueued(t('repair.queuedHint', {count: queued}));
        return {kind: 'alert', title: t('repair.title'), message};
      } catch (err) {
        useRepairStore.getState().reset();
        return {
          kind: 'alert',
          title: t('repair.failed'),
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
            title: t('repair.title'),
            message: t('repair.emptyWithUri'),
          };
        }
        return {kind: 'alert', title: t('repair.title'), message: t('repair.emptyNoUri')};
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
              ? t('repair.remapped', {count: remapped.length, total})
              : t('repair.allOk', {total});
          useRepairStore.getState().reset();
          return {kind: 'alert', title: t('repair.title'), message};
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
          title: t('repair.failed'),
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [imageFormat]
  );

  return {runRepair, handleRepair};
}
