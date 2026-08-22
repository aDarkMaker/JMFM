import React from 'react';
import {Text, View} from 'react-native';
import {Icon, IconName} from './Icon';
import {emptyStateStyles} from '../styles/components/emptyState';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  hint?: string;
}

export function EmptyState({icon = 'folder', title, hint}: EmptyStateProps) {
  return (
    <View style={emptyStateStyles.container}>
      <View style={emptyStateStyles.iconWrap}>
        <Icon name={icon} size={32} />
      </View>
      <Text style={emptyStateStyles.title}>{title}</Text>
      {hint ? <Text style={emptyStateStyles.hint}>{hint}</Text> : null}
    </View>
  );
}
