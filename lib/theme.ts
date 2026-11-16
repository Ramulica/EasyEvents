export type ThemeColors = {
  ink: string;
  inkSoft: string;
  mist: string;
  white: string;
  ocean: string;
  oceanDeep: string;
  aqua: string;
  aquaSoft: string;
  coral: string;
  coralSoft: string;
  sand: string;
  line: string;
  success: string;
  danger: string;
  warning: string;
  heroGradient: [string, string, string];
};

export const lightColors: ThemeColors = {
  ink: '#13262F',
  inkSoft: '#3A5360',
  mist: '#F3F8F7',
  white: '#FFFFFF',
  ocean: '#0B4F5C',
  oceanDeep: '#083944',
  aqua: '#1FA6A0',
  aquaSoft: '#D7F3F1',
  coral: '#E85D4C',
  coralSoft: '#FDE8E4',
  sand: '#E8DFD0',
  line: '#D5E2E0',
  success: '#1F8A70',
  danger: '#C0392B',
  warning: '#C9852C',
  heroGradient: ['#0B4F5C', '#1FA6A0', '#E85D4C'],
};

export const darkColors: ThemeColors = {
  ink: '#E8F2F1',
  inkSoft: '#9BB4BC',
  mist: '#0A1216',
  white: '#142027',
  ocean: '#2F9E96',
  oceanDeep: '#D5EFEC',
  aqua: '#4EC9C1',
  aquaSoft: '#11343A',
  // Soft teal primary for dark mode (replaces coral/orange CTAs)
  coral: '#3DB8A8',
  coralSoft: '#16363A',
  sand: '#1C2A31',
  line: '#2A3B43',
  success: '#45C4A0',
  danger: '#E07A7A',
  warning: '#D2B06A',
  heroGradient: ['#0A1216', '#12353A', '#2F9E96'],
};

/** Default light palette for module-level StyleSheets; prefer useTheme() in components. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fonts = {
  display: 'Fraunces_700Bold',
  displayMedium: 'Fraunces_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const shadows = {
  soft: {
    shadowColor: '#083944',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};
