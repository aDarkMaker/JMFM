import React from 'react';
import {Text, View} from 'react-native';
import {sectionHeaderStyles} from '../styles/components/sectionHeader';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({title, actionLabel, onPressAction}: SectionHeaderProps) {
  return (
    <View style={sectionHeaderStyles.container}>
      <Text style={sectionHeaderStyles.title}>{title}</Text>
      {actionLabel ? (
        <Text style={sectionHeaderStyles.action} onPress={onPressAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}
