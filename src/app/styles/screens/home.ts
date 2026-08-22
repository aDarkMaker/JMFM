import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const homeStyles = StyleSheet.create({
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  heroText: {
    color: theme.colors.mist,
    fontFamily: 'BebasNeue-Regular',
    fontSize: theme.typography.title.fontSize,
    letterSpacing: 1,
  },
  grid: {
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
