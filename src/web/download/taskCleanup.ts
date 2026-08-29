import type {Task} from '../stores/download';
import {useLibraryStore} from '../stores/library';
import {useSettingsStore} from '../stores/settings';
import {createDownloadRuntime} from './createDownloadRuntime';
import {sanitizeTitle} from '../../core/util/filename';
import {clearImageDocCache} from '../reader/image-doc';

function isPlaceholderTitle(title: string): boolean {
  return /^漫画 \d+$/.test(title);
}

export function albumDirForTask(task: Task, downloadPath: string): string | null {
  const libraryItem = useLibraryStore.getState().items.find((i) => i.albumId === task.albumId);
  if (libraryItem?.filePath) {
    return libraryItem.filePath;
  }
  if (isPlaceholderTitle(task.title)) {
    return null;
  }
  return `${downloadPath}/${sanitizeTitle(task.title)}`;
}

export async function cleanupTaskFiles(task: Task): Promise<void> {
  const {downloadPath} = useSettingsStore.getState().settings;
  const albumDir = albumDirForTask(task, downloadPath);
  if (!albumDir || albumDir === downloadPath) {
    return;
  }
  const runtime = createDownloadRuntime(useSettingsStore.getState().settings);
  await runtime.fs.unlink(albumDir).catch(() => undefined);
  clearImageDocCache(`${albumDir}/pages`);
}
