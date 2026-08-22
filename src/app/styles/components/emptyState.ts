import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const emptyStateStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.dataCard,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.lightFill,
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.title.fontSize,
  },
  hint: {
    marginTop: theme.spacing.sm,
    color: theme.colors.mist,
    fontSize: theme.typography.body.fontSize,
    textAlign: 'center',
  },
});
