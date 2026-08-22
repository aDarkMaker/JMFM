import React from 'react';
import {ScrollView, Text, View} from 'react-native';
import {AlbumCard} from '../components/AlbumCard';
import {SectionHeader} from '../components/SectionHeader';
import {dailyRecommendations} from '../../data/mock';
import {commonStyles} from '../styles/common';
import {homeStyles} from '../styles/screens/home';

function HomeScreen(): React.JSX.Element {
  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>JMFM</Text>
      </View>
      <View style={homeStyles.hero}>
        <Text style={homeStyles.heroText}>DAILY PICK</Text>
      </View>
      <SectionHeader title="每日推荐" />
      <ScrollView contentContainerStyle={homeStyles.grid}>
        {dailyRecommendations.map(item => (
          <AlbumCard
            key={item.albumId}
            title={item.title}
            author={item.author}
            tags={item.tags}
            chapterCount={item.chapterCount}
            coverColor={item.coverColor}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default HomeScreen;
