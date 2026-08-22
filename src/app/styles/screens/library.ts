import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const libraryStyles = StyleSheet.create({
  list: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  gridGap: {
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'space-between',
  },
});
