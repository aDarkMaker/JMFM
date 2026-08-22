export const colors = {
  ink: '#0e1116',
  inkHover: '#1a1f28',
  cloud: '#ffffff',
  edge: '#e3e8ee',
  mist: '#5b6472',
  signal: '#2e7def',
  citrus: '#ff7a3d',
  meadow: '#2bc48a',
  lightFill: '#f3f6fa',
  placeholder: '#8a93a3',
} as const;

export const radii = {
  pill: 999,
  control: 999,
  checkbox: 8,
  tile: 14,
  card: 20,
  dataCard: 28,
} as const;

export const shadow = {
  subtle: {
    shadowColor: colors.ink,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 1,
    elevation: 1,
  },
  soft: {
    shadowColor: colors.ink,
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 8,
  },
} as const;

export const typography = {
  chip: {fontSize: 11, fontWeight: '500'},
  description: {fontSize: 12.5, fontWeight: '400'},
  auxiliary: {fontSize: 13, fontWeight: '400'},
  body: {fontSize: 15, fontWeight: '400'},
  price: {fontSize: 18, fontWeight: '700'},
  title: {fontSize: 20, fontWeight: '600'},
  hero: {fontSize: 36, fontWeight: '700'},
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const theme = {colors, radii, shadow, typography, spacing, easing} as const;
