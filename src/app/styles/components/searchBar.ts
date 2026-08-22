import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const searchBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    borderRadius: theme.radii.control,
    backgroundColor: theme.colors.lightFill,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: theme.typography.body.fontSize,
  },
});
