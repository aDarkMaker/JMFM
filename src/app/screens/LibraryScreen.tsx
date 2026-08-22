import React, {useEffect, useMemo, useState} from 'react';
import {FlatList, Text, View} from 'react-native';
import {AlbumCard} from '../components/AlbumCard';
import {EmptyState} from '../components/EmptyState';
import {SearchBar} from '../components/SearchBar';
import {useLibraryStore} from '../stores/useLibraryStore';
import {commonStyles} from '../styles/common';
import {libraryStyles} from '../styles/screens/library';

function LibraryScreen(): React.JSX.Element {
  const albums = useLibraryStore(state => state.albums);
  const load = useLibraryStore(state => state.load);
  const [query, setQuery] = useState('');

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return albums;
    }
    return albums.filter(
      a => a.title.toLowerCase().includes(q) || (a.author ?? '').toLowerCase().includes(q),
    );
  }, [albums, query]);

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>漫画库</Text>
      </View>
      <SearchBar value={query} onChangeText={setQuery} placeholder="搜索漫画" />
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.albumId)}
        numColumns={2}
        columnWrapperStyle={libraryStyles.gridGap}
        contentContainerStyle={libraryStyles.list}
        renderItem={({item}) => (
          <AlbumCard
            title={item.title}
            author={item.author}
            chapterCount={1}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="auto-stories"
            title="还没有漫画"
            hint="去 Home 页看看每日推荐，或输入专辑 ID 下载"
          />
        }
      />
    </View>
  );
}

export default LibraryScreen;
