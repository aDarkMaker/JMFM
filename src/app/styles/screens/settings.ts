import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const settingsStyles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    color: theme.colors.mist,
    fontSize: theme.typography.chip.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.cloud,
    ...theme.shadow.subtle,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.body.fontSize,
  },
  value: {
    marginTop: 2,
    color: theme.colors.mist,
    fontSize: theme.typography.description.fontSize,
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.tile,
    color: theme.colors.ink,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.lightFill,
    textAlign: 'right',
  },
  pickerRow: {
    flex: 1,
    marginLeft: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  chip: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.control,
    backgroundColor: theme.colors.lightFill,
  },
  chipActive: {
    backgroundColor: theme.colors.signal,
  },
  chipText: {
    color: theme.colors.mist,
    fontSize: theme.typography.body.fontSize,
  },
  chipTextActive: {
    color: theme.colors.cloud,
  },
});
