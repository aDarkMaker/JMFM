import React from 'react';
import {SvgXml} from 'react-native-svg';
import {icons} from '../generated/icons';
import {theme} from '../theme';

export type IconName = keyof typeof icons;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({name, size = 24, color = theme.colors.ink}: IconProps) {
  return <SvgXml xml={icons[name]} width={size} height={size} color={color} />;
}
