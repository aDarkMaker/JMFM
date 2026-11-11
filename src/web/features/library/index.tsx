import {t} from '@/web/i18n';
import {useCallback, useMemo, useState} from 'react';
import type {AlbumCardData} from '@/web/shared/AlbumCard';
import {AlbumCard} from '@/web/shared/AlbumCard';
import {SearchBar} from '@/web/shared/SearchBar';
import {EmptyState} from '@/web/ui/EmptyState';
import {AlbumCardSkeleton} from '@/web/shared/Skeletons';
import {SectionHeader} from '@/web/ui/SectionHeader';
import {Segmented} from '@/web/ui/Segmented';
import type {SegmentedOption} from '@/web/ui/Segmented';
import {ConfirmDialog} from '@/web/ui/ConfirmDialog';
import type {LibraryItem} from '@/web/stores/library';
import {useLibraryStore} from '@/web/stores/library';
import {loadImageDocMeta} from '@/web/reader/image-doc';
import {createDownloadRuntime} from '@/web/download/createDownloadRuntime';
import {useSettingsStore} from '@/web/stores/settings';
import {showToast} from '@/web/ui/Toast';
import {useHistoryStore} from '@/web/stores/history';
import styles from './library.module.css';

type CategoryKey = 'all' | 'favorite' | 'downloaded' | 'recent';

const CATEGORIES: SegmentedOption<CategoryKey>[] = [
  {value: 'all', label: t('library.catAll')},
  {value: 'favorite', label: t('library.catFavorite')},
  {value: 'downloaded', label: t('library.catDownloaded')},
  {value: 'recent', label: t('library.catRecent')},
];

export function LibraryScreen({
  onOpenReader,
}: {
  onOpenReader: (item: LibraryItem, startPage?: number) => void;
}) {
  const items = useLibraryStore((s) => s.items);
  const loaded = useLibraryStore((s) => s.loaded);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const removeItem = useLibraryStore((s) => s.remove);
  const markOpened = useLibraryStore((s) => s.markOpened);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (category === 'favorite') {
      list = list.filter((it) => it.favorite);
    } else if (category === 'recent') {
      list = list.filter((it) => (it.lastOpenedAt ?? 0) > 0);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (it) => it.title.toLowerCase().includes(q) || String(it.albumId).includes(q)
      );
    }
    // 常看 / 默认按最近阅读；已下载按最近下载 —— 不再单独提供排序 chip。
    const sorted = [...list];
    if (category === 'downloaded') {
      sorted.sort((a, b) => (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0));
    } else {
      sorted.sort(
        (a, b) =>
          (b.lastOpenedAt ?? b.downloadedAt ?? 0) - (a.lastOpenedAt ?? a.downloadedAt ?? 0)
      );
    }
    return sorted;
  }, [items, category, query]);

  const showEmpty = filtered.length === 0;
  const historyByAlbum = useHistoryStore((s) => s.entries);
  const emptyTitle =
    query || category !== 'all' ? t('library.emptyMatch') : t('library.empty');
  const emptyHint =
    query || category !== 'all' ? t('library.emptyMatchHint') : t('library.emptyHint');
  const handleDelete = useCallback(
    (album: AlbumCardData) => {
      const item = items.find((it) => it.albumId === album.albumId);
      if (!item) return;
      setPendingDelete(item);
    },
    [items]
  );

  const confirmDelete = useCallback(() => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    removeItem(item.albumId);
    const runtime = createDownloadRuntime(useSettingsStore.getState().settings);
    void runtime.fs.unlink(item.filePath).catch(() => undefined);
    showToast(t('library.deleted', {title: item.title}), 'info');
  }, [pendingDelete, removeItem]);

  const handlePress = useCallback(
    (album: AlbumCardData) => {
      const item = items.find((it) => it.albumId === album.albumId);
      if (!item) return;
      const entry = useHistoryStore.getState().entries[String(item.albumId)];
      markOpened(item.albumId);
      if (item.pagesDir) {
        void loadImageDocMeta(item.pagesDir).catch(() => undefined);
      }
      onOpenReader(item, entry?.page);
    },
    [items, markOpened, onOpenReader]
  );

  const handleFavorite = useCallback(
    (album: AlbumCardData) => {
      const item = items.find((it) => it.albumId === album.albumId);
      const next = !item?.favorite;
      toggleFavorite(album.albumId);
      showToast(
        next
          ? t('library.favorited', {title: album.title})
          : t('library.unfavorited', {title: album.title}),
        next ? 'success' : 'info'
      );
    },
    [items, toggleFavorite]
  );

  return (
    <div className="app-screen">
      <SectionHeader title={t('library.title')} />
      <div className={styles.filters}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('library.search')} />
        {items.length > 0 ? (
          <Segmented
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            size="sm"
            ariaLabel={t('library.category')}
          />
        ) : null}
      </div>
      {!loaded && items.length === 0 ? (
        <AlbumCardSkeleton count={6} />
      ) : showEmpty ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState icon="photo-library" title={emptyTitle} hint={emptyHint} />
        </div>
      ) : (
        <div className={`${styles.grid} grid-cards`}>
          {filtered.map((item) => {
            const entry = historyByAlbum[String(item.albumId)];
            return (
              <AlbumCard
                key={item.albumId}
                album={
                  entry
                    ? {...item, progress: {page: entry.page, total: entry.total}}
                    : item
                }
                onPress={handlePress}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete != null}
        title={t('library.deleteTitle')}
        message={pendingDelete ? t('library.deleteMessage', {title: pendingDelete.title}) : ''}
        confirmLabel={t('common.delete')}
        danger
        messageEllipsis
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
