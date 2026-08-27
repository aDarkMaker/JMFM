import {useCallback} from 'react';
import {DownloadEvent, DownloadService, isCanceledError} from '../../core/download';
import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {createRuntime} from '../../core/download/runtime';
import {useSettingsStore} from '../stores/settings';
import {useDownloadStore} from '../stores/download';
import {saveToLibrary, AlbumInfo} from '../library/saveToLibrary';
import {useLibraryStore} from '../stores/library';
import {enqueueDownload} from '../download/queue';
import {uid} from '../library/uid';
import {formatTaskError} from '../util/formatTaskError';

export function useDownloadTask() {
  const downloadPath = useSettingsStore((s) => s.settings.downloadPath);
  const proxyEnabled = useSettingsStore((s) => s.settings.proxyEnabled);
  const proxy = useSettingsStore((s) => s.settings.proxy);
  const retryTimes = useSettingsStore((s) => s.settings.retryTimes);
  const imageThreads = useSettingsStore((s) => s.settings.imageThreads);
  const imageFormat = useSettingsStore((s) => s.settings.imageFormat);

  const runTask = useCallback(
    async (taskId: string) => {
      const http = createHttpClient({
        ...(proxyEnabled && proxy ? {proxy} : {}),
        maxRetries: retryTimes,
      });
      const runtime = createRuntime();
      const source = new ApiClient(http);
      const service = new DownloadService({
        http,
        source,
        runtime,
        downloadPath,
        concurrency: imageThreads || undefined,
        cpuCount: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
        imageFormat: imageFormat === 'webp' ? 'webp' : 'jpg',
      });

      const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const albumId = task.albumId;
      let albumInfo: AlbumInfo | null = null;
      let albumTotal = 0;
      const controller = {
        paused: false,
        cancel() {
          this.paused = true;
        },
      };
      useDownloadStore.getState().setController(taskId, controller);
      useDownloadStore.getState().setStatus(taskId, 'running');

      try {
        const albumDir = await service.downloadAlbum(
          albumId,
          (e: DownloadEvent) => {
            if (e.type === 'album-parsed') {
              albumInfo = {title: e.title, chapters: e.chapters, author: e.author, tags: e.tags};
              useDownloadStore.getState().setTitle(taskId, e.title);
              useDownloadStore.getState().updateChapter(taskId, 0, e.chapters);
            } else if (e.type === 'chapter') {
              useDownloadStore.getState().updateChapter(taskId, e.index, e.total);
            } else if (e.type === 'image') {
              albumTotal = e.albumTotal;
              useDownloadStore.getState().updateProgress(taskId, e.albumDone, e.albumTotal);
            }
          },
          {controller}
        );
        useDownloadStore.getState().setStatus(taskId, 'done');
        if (albumInfo) {
          await saveToLibrary(
            albumId,
            albumInfo,
            albumTotal,
            albumDir,
            http,
            runtime,
            useLibraryStore.getState()
          );
        }
      } catch (err) {
        if (isCanceledError(err)) {
          useDownloadStore.getState().setStatus(taskId, 'paused');
        } else {
          useDownloadStore
            .getState()
            .setStatus(
              taskId,
              'error',
              formatTaskError(err instanceof Error ? err.message : String(err))
            );
        }
      }
    },
    [downloadPath, proxyEnabled, proxy, retryTimes, imageThreads, imageFormat]
  );

  const startDownload = useCallback(
    (taskId: string) => {
      const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
      if (!task || task.status === 'running' || task.status === 'done') return;
      enqueueDownload(taskId, () => runTask(taskId));
    },
    [runTask]
  );

  const cancel = useCallback((taskId: string) => {
    const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
    task?.controller?.cancel();
  }, []);

  const enqueueAlbum = useCallback(
    (albumId: number, title: string): void => {
      const id = uid();
      useDownloadStore.getState().addBatch([{id, albumId, title}]);
      const task = useDownloadStore.getState().tasks.find((t) => t.albumId === albumId);
      if (task) {
        startDownload(task.id);
      }
    },
    [startDownload]
  );

  /** Re-queue albums for repair: clears finished tasks, batch-adds, then starts downloads. */
  const enqueueAlbumsForRepair = useCallback(
    (albums: {albumId: number; title: string}[]): number => {
      const unique = new Map<number, string>();
      for (const album of albums) {
        unique.set(album.albumId, album.title);
      }
      const entries = [...unique.entries()].map(([albumId, title]) => ({albumId, title}));
      if (entries.length === 0) {
        return 0;
      }

      const store = useDownloadStore.getState();
      const albumIds = entries.map((e) => e.albumId);
      for (const task of store.tasks) {
        if (!albumIds.includes(task.albumId)) continue;
        if (task.status === 'running' || task.status === 'pending') {
          continue;
        }
        task.controller?.cancel();
        store.remove(task.id);
      }

      const fresh = entries.map((e) => ({id: uid(), albumId: e.albumId, title: e.title}));
      store.addBatch(fresh);

      let queued = 0;
      for (const {albumId} of entries) {
        const task = useDownloadStore.getState().tasks.find((t) => t.albumId === albumId);
        if (!task || task.status === 'running') {
          continue;
        }
        if (task.status === 'pending') {
          startDownload(task.id);
          queued += 1;
        }
      }
      return queued;
    },
    [startDownload]
  );

  return {startDownload, cancel, enqueueAlbum, enqueueAlbumsForRepair};
}
