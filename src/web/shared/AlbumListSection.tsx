/** Album row list with shared download enqueue + toast wiring. */
import {t} from '@/web/i18n';
import {useCallback, useMemo} from 'react';
import type {AlbumSummary} from '@/core/model';
import {useShallow} from 'zustand/react/shallow';
import styles from './albumListSection.module.css';
import {useDownloadStore} from '@/web/stores/download';
import {useSettingsStore} from '@/web/stores/settings';
import {useToastStore} from '@/web/stores/toast';
import {useDownloadTask} from '@/web/hooks/useDownloadTask';
import {isBlockedAlbum} from '@/core/model/blocklist';
import {AlbumRow} from '@/web/shared/AlbumRow';

export interface AlbumListSectionProps {
  albums: AlbumSummary[];
  onPress: (album: AlbumSummary) => void;
}

/** Album rows with shared download enqueue + toast wiring. */
export function AlbumListSection({albums, onPress}: AlbumListSectionProps) {
  const queuedTaskAlbumIds = useDownloadStore(useShallow((s) => s.tasks.map((t) => t.albumId)));
  const blacklistTags = useSettingsStore((s) => s.settings.blacklistTags);
  const {enqueueAlbum} = useDownloadTask();
  const showToast = useToastStore((s) => s.show);

  const queued = useMemo(() => new Set(queuedTaskAlbumIds), [queuedTaskAlbumIds]);

  const handleDownload = useCallback(
    (album: AlbumSummary) => {
      if (queued.has(album.albumId) || isBlockedAlbum(album, blacklistTags)) return;
      enqueueAlbum(album.albumId, album.name);
      showToast(t('common.queuedToast', {name: album.name}));
    },
    [queued, blacklistTags, enqueueAlbum, showToast]
  );

  return (
    <div className={styles.list}>
      {albums.map((album) => (
        <AlbumRow
          key={album.albumId}
          album={album}
          onPress={onPress}
          downloading={queued.has(album.albumId)}
          onDownload={handleDownload}
        />
      ))}
    </div>
  );
}
