import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const sectionHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.title.fontSize,
  },
  action: {
    marginLeft: 'auto',
    color: theme.colors.signal,
    fontSize: theme.typography.body.fontSize,
  },
});
