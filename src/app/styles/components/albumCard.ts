import {StyleSheet} from 'react-native';
import {theme} from '../../theme';

export const albumCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: '48%',
    marginBottom: theme.spacing.lg,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.cloud,
    ...theme.shadow.subtle,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: theme.colors.lightFill,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: theme.colors.mist,
    fontSize: theme.typography.description.fontSize,
  },
  body: {
    padding: theme.spacing.sm,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: 'AlimamaShuHeiTi-Bold',
    fontSize: theme.typography.body.fontSize,
    lineHeight: 20,
  },
  meta: {
    marginTop: theme.spacing.xs,
    color: theme.colors.mist,
    fontSize: theme.typography.description.fontSize,
  },
  footer: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    marginRight: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.control,
    backgroundColor: theme.colors.lightFill,
  },
  tagText: {
    color: theme.colors.mist,
    fontSize: theme.typography.chip.fontSize,
  },
  chapter: {
    color: theme.colors.signal,
    fontSize: theme.typography.chip.fontSize,
    marginLeft: 'auto',
  },
});
