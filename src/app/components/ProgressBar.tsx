import React from 'react';
import {View} from 'react-native';
import {progressBarStyles} from '../styles/components/progressBar';

export interface ProgressBarProps {
  progress: number;
}

export function ProgressBar({progress}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={progressBarStyles.track}>
      <View style={[progressBarStyles.fill, {width: `${clamped * 100}%`}]} />
    </View>
  );
}
