import React from 'react';
import {TextInput, View} from 'react-native';
import {Icon} from './Icon';
import {searchBarStyles} from '../styles/components/searchBar';
import {theme} from '../theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({value, onChangeText, placeholder}: SearchBarProps) {
  return (
    <View style={searchBarStyles.container}>
      <Icon name="search" size={20} color={theme.colors.mist} />
      <TextInput
        style={searchBarStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.placeholder}
      />
    </View>
  );
}
