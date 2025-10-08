// WealthArena Design System Tokens
// Duolingo-inspired design with fox mascot

export const tokens = {
  color: {
    primary: '#58CC02',       // primary green (brand)
    accentBlue: '#1CB0F6',
    accentYellow: '#FFC800',
    danger: '#FF4B4B',
    neutral900: '#0F1720',    // text (dark mode / light mode mapping changes)
    neutral700: '#374151',
    neutral500: '#6B7280',
    neutral200: '#E5E7EB',
    white: '#FFFFFF',
  },
  // border radius & spacing (8px scale)
  radius: { sm: 8, md: 12, lg: 20, pill: 999, full: 9999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  // elevation shadows (use simple RN shadow for iOS + elevation for Android)
  elevation: { low: 2, med: 6, high: 12 },
  // typography
  font: {
    // Prefer Inter / Poppins — fallbacks included
    heading: 'System',
    body: 'System',
    mono: 'System',
    sizes: { h1: 26, h2: 20, h3: 18, body: 16, small: 13, xs: 11 },
    weights: { regular: '400' as const, semibold: '600' as const, bold: '700' as const },
  }
};

export const lightTheme = {
  bg: tokens.color.white,
  surface: '#F9FAFB',
  card: '#FFFFFF',
  cardHover: '#F3F4F6',
  text: tokens.color.neutral900,
  textMuted: '#6B7280',
  muted: '#9CA3AF',
  primary: tokens.color.primary,
  accent: tokens.color.accentBlue,
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: '#E5E7EB',
  yellow: '#FFC800',
};

export const darkTheme = {
  bg: '#071019',
  surface: '#0B1318',
  card: '#0F1720',
  cardHover: '#1A2332',
  text: '#E6EEF3',
  textMuted: '#9CA3AF',
  muted: '#9CA3AF',
  primary: '#4BC200', // slightly tuned for dark
  accent: tokens.color.accentBlue,
  success: '#10B981',
  warning: tokens.color.accentYellow,
  danger: tokens.color.danger,
  border: '#1F2937',
  yellow: tokens.color.accentYellow,
};

export type Theme = typeof lightTheme;

