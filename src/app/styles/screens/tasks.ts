import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const tasksStyles = StyleSheet.create({
  list: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  taskCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.cloud,
    ...theme.shadow.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.body.fontSize,
  },
  status: {
    color: theme.colors.mist,
    fontSize: theme.typography.description.fontSize,
  },
  progress: {
    marginTop: theme.spacing.sm,
  },
  actions: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.lightFill,
  },
});
