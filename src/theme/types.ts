export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgCard: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  borderLight: string;
  borderMedium: string;
  borderFocus: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentText: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
}

export interface ThemeRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeShadows {
  none: string;
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  fontSans: string;
  fontMono: string;
  fontBangla?: string;
  fontArabic?: string;
  textXs: string;
  textSm: string;
  textBase: string;
  textLg: string;
  textXl: string;
  text2Xl: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isGlass?: boolean;
  colors: ThemeColors;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
}
