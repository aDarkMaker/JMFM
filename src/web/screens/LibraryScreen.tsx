import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AlbumCard, AlbumCardData} from '../components/AlbumCard';
import {SearchBar} from '../components/SearchBar';
import {EmptyState} from '../components/EmptyState';
import {AlbumCardSkeleton} from '../components/Skeletons';
import {SectionHeader} from '../components/SectionHeader';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {loadImageDocMeta} from '../reader/image-doc';
import {createDownloadRuntime} from '../download/createDownloadRuntime';
import {useSettingsStore} from '../stores/settings';
import {useToastStore} from '../stores/toast';
import {useHistoryStore} from '../stores/history';

type CategoryKey = 'all' | 'favorite' | 'downloaded' | 'recent';

const CATEGORIES: {key: CategoryKey; label: string}[] = [
  {key: 'all', label: '全部'},
  {key: 'favorite', label: '收藏'},
  {key: 'downloaded', label: '已下载'},
  {key: 'recent', label: '常看'},
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
  const [sliderStyle, setSliderStyle] = useState({left: 0, width: 0});
  const showToast = useToastStore((s) => s.show);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const sliderRef = useRef<HTMLSpanElement>(null);

  const measureSlider = useCallback(() => {
    const idx = CATEGORIES.findIndex((c) => c.key === category);
    const tab = tabsRef.current[idx];
    if (!tab) return;
    setSliderStyle({left: tab.offsetLeft, width: tab.offsetWidth});
  }, [category]);

  useEffect(() => {
    measureSlider();
  }, [measureSlider, items.length]);

  useEffect(() => {
    window.addEventListener('resize', measureSlider);
    return () => window.removeEventListener('resize', measureSlider);
  }, [measureSlider]);

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
  const emptyTitle = query || category !== 'all' ? '未找到匹配的漫画' : '漫画库还是空的';
  const emptyHint = query || category !== 'all' ? '换个关键词或分类试试' : '下载一本漫画开始阅读';
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
    showToast(`已删除：${item.title}`, 'info');
  }, [pendingDelete, removeItem, showToast]);

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
      showToast(next ? `已收藏：${album.title}` : `已取消收藏：${album.title}`, next ? 'success' : 'info');
    },
    [items, toggleFavorite, showToast]
  );

  return (
    <div className="app-screen">
      <SectionHeader title="漫画库" />
      <div className="library-filters">
        <SearchBar value={query} onChange={setQuery} placeholder="搜索本地漫画" />
        {items.length > 0 ? (
          <div className="category-tabs" role="tablist">
            <span
              ref={sliderRef}
              className="category-slider"
              style={{left: sliderStyle.left, width: sliderStyle.width}}
            />
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.key}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                role="tab"
                aria-selected={category === cat.key}
                className={`category-tab${category === cat.key ? ' is-active' : ''}`}
                onClick={() => setCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {!loaded && items.length === 0 ? (
        <AlbumCardSkeleton count={6} />
      ) : showEmpty ? (
        <div className="app-empty app-empty--fixed">
          <EmptyState icon="photo-library" title={emptyTitle} hint={emptyHint} />
        </div>
      ) : (
        <div className="library-grid grid-cards">
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
        title="删除漫画"
        message={pendingDelete ? `删除「${pendingDelete.title}」？` : ''}
        confirmLabel="删除"
        danger
        messageEllipsis
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
