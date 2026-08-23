import {useMemo, useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {AlbumCard} from '../components/AlbumCard';
import {SearchBar} from '../components/SearchBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {createRuntime} from '../../core/download/runtime';

interface CategoryFilter {
  key: string;
  label: string;
}

export function LibraryScreen() {
  const items = useLibraryStore(s => s.items);
  const toggleFavorite = useLibraryStore(s => s.toggleFavorite);
  const removeItem = useLibraryStore(s => s.remove);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo<CategoryFilter[]>(() => {
    const tags = new Set<string>();
    items.forEach(it => (it.tags ?? []).forEach(t => tags.add(t)));
    return [
      {key: 'all', label: '全部'},
      {key: 'favorite', label: '收藏'},
      {key: 'downloaded', label: '已下载'},
      ...[...tags].map(tag => ({key: `tag:${tag}`, label: tag})),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (category === 'favorite') {
      list = list.filter(it => it.favorite);
    } else if (category.startsWith('tag:')) {
      const tag = category.slice(4);
      list = list.filter(it => (it.tags ?? []).includes(tag));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        it => it.title.toLowerCase().includes(q) || String(it.albumId).includes(q),
      );
    }
    return list;
  }, [items, category, query]);

  async function handlePress(item: LibraryItem) {
    try {
      if (Capacitor.isNativePlatform()) {
        const uri = await Filesystem.getUri({
          path: item.filePath,
          directory: Directory.Documents,
        });
        await Share.share({files: [uri.uri], dialogTitle: item.title});
      } else {
        const runtime = createRuntime();
        const bytes = await runtime.fs.readFile(item.filePath);
        const blob = new Blob([bytes.slice().buffer], {type: 'application/pdf'});
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      console.error('Failed to open pdf:', err);
    }
  }

  function handleDelete(item: LibraryItem) {
    if (!window.confirm(`删除「${item.title}」？`)) {
      return;
    }
    removeItem(item.albumId);
    const runtime = createRuntime();
    const albumDir = item.filePath.slice(0, item.filePath.lastIndexOf('/'));
    void runtime.fs.unlink(albumDir).catch(() => undefined);
  }

  const showEmpty = filtered.length === 0;
  const emptyTitle = query || category !== 'all' ? '未找到匹配的漫画' : '漫画库还是空的';
  const emptyHint = query || category !== 'all' ? '换个关键词或分类试试' : '下载一本漫画开始阅读';

  return (
    <div className="app-screen">
      <SectionHeader title="漫画库" />
      <SearchBar value={query} onChange={setQuery} placeholder="搜索本地漫画" />
      {items.length > 0 ? (
        <div className="category-tabs">
          {categories.map(cat => (
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
      {showEmpty ? (
        <EmptyState icon="photo-library" title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className="library-grid">
          {filtered.map(item => (
            <AlbumCard
              key={item.albumId}
              album={item}
              onPress={() => void handlePress(item)}
              onFavorite={() => toggleFavorite(item.albumId)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
