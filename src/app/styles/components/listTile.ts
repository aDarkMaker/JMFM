import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const listTileStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.cloud,
    ...theme.shadow.subtle,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.lightFill,
    marginRight: theme.spacing.md,
  },
  body: {
    flex: 1,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.body.fontSize,
  },
  subtitle: {
    marginTop: 2,
    color: theme.colors.mist,
    fontSize: theme.typography.description.fontSize,
  },
  trailing: {
    marginLeft: theme.spacing.md,
  },
});
