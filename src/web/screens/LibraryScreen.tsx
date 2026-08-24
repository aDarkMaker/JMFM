import {useCallback, useMemo, useState} from 'react';
import {AlbumCard, AlbumCardData} from '../components/AlbumCard';
import {SearchBar} from '../components/SearchBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {loadDoc} from '../reader/pdf-doc';
import {createRuntime} from '../../core/download/runtime';

type CategoryKey = 'all' | 'favorite' | 'downloaded' | 'recent';

const CATEGORIES: {key: CategoryKey; label: string}[] = [
  {key: 'all', label: '全部'},
  {key: 'favorite', label: '收藏'},
  {key: 'downloaded', label: '已下载'},
  {key: 'recent', label: '常看'},
];

export function LibraryScreen({onOpenReader}: {onOpenReader: (item: LibraryItem) => void}) {
  const items = useLibraryStore(s => s.items);
  const toggleFavorite = useLibraryStore(s => s.toggleFavorite);
  const removeItem = useLibraryStore(s => s.remove);
  const markOpened = useLibraryStore(s => s.markOpened);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');

  const filtered = useMemo(() => {
    let list = items;
    if (category === 'favorite') {
      list = list.filter(it => it.favorite);
    } else if (category === 'recent') {
      list = [...list].sort(
        (a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0),
      );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        it => it.title.toLowerCase().includes(q) || String(it.albumId).includes(q),
      );
    }
    return list;
  }, [items, category, query]);

  const showEmpty = filtered.length === 0;
  const emptyTitle = query || category !== 'all' ? '未找到匹配的漫画' : '漫画库还是空的';
  const emptyHint = query || category !== 'all' ? '换个关键词或分类试试' : '下载一本漫画开始阅读';

  const handleDelete = useCallback(
    (album: AlbumCardData) => {
      const item = items.find(it => it.albumId === album.albumId);
      if (!item) return;
      if (!window.confirm(`删除「${item.title}」？`)) {
        return;
      }
      removeItem(item.albumId);
      const runtime = createRuntime();
      const albumDir = item.filePath.slice(0, item.filePath.lastIndexOf('/'));
      void runtime.fs.unlink(albumDir).catch(() => undefined);
    },
    [items, removeItem],
  );

  const handlePress = useCallback(
    (album: AlbumCardData) => {
      const item = items.find(it => it.albumId === album.albumId);
      if (!item) return;
      markOpened(item.albumId);
      void loadDoc(item.filePath);
      onOpenReader(item);
    },
    [items, markOpened, onOpenReader],
  );

  const handleFavorite = useCallback(
    (album: AlbumCardData) => {
      toggleFavorite(album.albumId);
    },
    [toggleFavorite],
  );

  return (
    <div className="app-screen">
      <SectionHeader title="漫画库" />
      <div className="library-filters">
        <SearchBar value={query} onChange={setQuery} placeholder="搜索本地漫画" />
        {items.length > 0 ? (
          <div className="category-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className={`category-tab${category === cat.key ? ' is-active' : ''}`}
                onClick={() => setCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {showEmpty ? (
        <div className="app-empty">
          <EmptyState icon="photo-library" title={emptyTitle} hint={emptyHint} />
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map(item => (
            <AlbumCard
              key={item.albumId}
              album={item}
              onPress={handlePress}
              onFavorite={handleFavorite}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
