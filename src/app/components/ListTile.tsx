import React from 'react';
import {ReactNode} from 'react';
import {Text, View} from 'react-native';
import {Icon, IconName} from './Icon';
import {listTileStyles} from '../styles/components/listTile';

export interface ListTileProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

export function ListTile({icon, title, subtitle, trailing}: ListTileProps) {
  return (
    <View style={listTileStyles.container}>
      {icon ? (
        <View style={listTileStyles.iconWrap}>
          <Icon name={icon} size={20} />
        </View>
      ) : null}
      <View style={listTileStyles.body}>
        <Text style={listTileStyles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={listTileStyles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={listTileStyles.trailing}>{trailing}</View> : null}
    </View>
  );
}
