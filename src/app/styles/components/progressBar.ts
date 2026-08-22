import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const progressBarStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.lightFill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.signal,
  },
});
