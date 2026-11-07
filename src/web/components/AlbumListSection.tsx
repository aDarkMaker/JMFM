import {useMemo} from 'react';
import type {AlbumSummary} from '../../core/model';
import {useShallow} from 'zustand/react/shallow';
import {useDownloadStore} from '../stores/download';
import {useSettingsStore} from '../stores/settings';
import {useToastStore} from '../stores/toast';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {isBlockedAlbum} from '../../core/model/blocklist';
import {AlbumRow} from './AlbumRow';

export interface AlbumListSectionProps {
  albums: AlbumSummary[];
  onPress: (album: AlbumSummary) => void;
  /** Passed to the list container so feed stagger animations can target it. */
  listRef?: React.Ref<HTMLDivElement>;
}

/** Album rows with shared download enqueue + toast wiring. */
export function AlbumListSection({albums, onPress, listRef}: AlbumListSectionProps) {
  const queuedTaskAlbumIds = useDownloadStore(useShallow((s) => s.tasks.map((t) => t.albumId)));
  const blacklistTags = useSettingsStore((s) => s.settings.blacklistTags);
  const {enqueueAlbum} = useDownloadTask();
  const showToast = useToastStore((s) => s.show);

  const queued = useMemo(() => new Set(queuedTaskAlbumIds), [queuedTaskAlbumIds]);

  return (
    <div className="album-list" ref={listRef}>
      {albums.map((album) => (
        <AlbumRow
          key={album.albumId}
          album={album}
          onPress={() => onPress(album)}
          downloading={queued.has(album.albumId)}
          onDownload={() => {
            if (queued.has(album.albumId) || isBlockedAlbum(album, blacklistTags)) return;
            enqueueAlbum(album.albumId, album.name);
            showToast(`已加入下载队列：${album.name}`);
          }}
        />
      ))}
    </div>
  );
}
