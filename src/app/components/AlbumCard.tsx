import React from 'react';
import {Text, View} from 'react-native';
import {albumCardStyles} from '../styles/components/albumCard';

export interface AlbumCardProps {
  title: string;
  author?: string;
  tags?: string[];
  chapterCount?: number;
  coverColor?: string;
}

export function AlbumCard({
  title,
  author,
  tags = [],
  chapterCount,
  coverColor,
}: AlbumCardProps) {
  return (
    <View style={albumCardStyles.card}>
      <View style={[albumCardStyles.cover, coverColor ? {backgroundColor: coverColor} : null]}>
        <View style={albumCardStyles.placeholder}>
          <Text style={albumCardStyles.placeholderText}>{title.slice(0, 4)}</Text>
        </View>
      </View>
      <View style={albumCardStyles.body}>
        <Text style={albumCardStyles.title} numberOfLines={1}>
          {title}
        </Text>
        {author ? <Text style={albumCardStyles.meta} numberOfLines={1}>{author}</Text> : null}
        <View style={albumCardStyles.footer}>
          {tags.slice(0, 2).map(tag => (
            <View key={tag} style={albumCardStyles.tag}>
              <Text style={albumCardStyles.tagText}>{tag}</Text>
            </View>
          ))}
          {chapterCount !== undefined ? (
            <Text style={albumCardStyles.chapter}>{chapterCount}话</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
