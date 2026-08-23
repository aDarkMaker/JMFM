import {useState} from 'react';
import {useLibraryStore} from '../stores/library';
import {SearchBar} from '../components/SearchBar';
import {ListTile} from '../components/ListTile';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';

export function LibraryScreen() {
  const items = useLibraryStore(s => s.items);
  const [query, setQuery] = useState('');

  const filtered = items.filter(it =>
    it.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="app-screen">
      <SectionHeader title="漫画库" />
      <SearchBar value={query} onChange={setQuery} placeholder="搜索本地漫画" />
      {filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title={query ? '未找到匹配的漫画' : '漫画库还是空的'}
          hint={query ? '换个关键词试试' : '从首页推荐开始下载吧'}
        />
      ) : (
        <div className="library-stack">
          {filtered.map(item => (
            <ListTile
              key={item.albumId}
              icon="auto-stories"
              title={item.title}
              subtitle={`${item.chapterCount}话`}
              trailing="chevron-right"
            />
          ))}
        </div>
      )}
    </div>
  );
}
