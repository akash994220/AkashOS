import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeDefinition } from './types';

// The "Minimalism" theme: clean, light, soft rounded corners, calm, uncluttered
export const minimalismTheme: ThemeDefinition = {
  id: 'minimalism',
  name: 'Minimalism',
  description: 'Clean, light, soft rounded corners, calm and uncluttered',
  colors: {
    bgPrimary: '#FAFAFA',
    bgSecondary: '#F4F4F5',
    bgTertiary: '#E4E4E7',
    bgCard: '#FFFFFF',
    bgElevated: '#FFFFFF',
    bgHover: '#F4F4F6',
    bgActive: '#EBECEF',
    textPrimary: '#18181B',
    textSecondary: '#52525B',
    textMuted: '#71717A',
    textInverse: '#FAFAFA',
    borderLight: '#E4E4E7',
    borderMedium: '#D4D4D8',
    borderFocus: '#18181B',
    accent: '#18181B',
    accentHover: '#27272A',
    accentLight: '#F4F4F5',
    accentText: '#FFFFFF',
    success: '#15803D',
    successBg: '#F0FDF4',
    warning: '#B45309',
    warningBg: '#FFFBEB',
    danger: '#B91C1C',
    dangerBg: '#FEF2F2',
    info: '#1D4ED8',
    infoBg: '#EFF6FF',
  },
  radius: {
    none: '0px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 2px 8px -1px rgba(15, 23, 42, 0.05)',
    md: '0 4px 14px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
    lg: '0 10px 25px -4px rgba(15, 23, 42, 0.10), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontSans: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, sans-serif",
    textXs: '12px',
    textSm: '14px',
    textBase: '16px',
    textLg: '18px',
    textXl: '20px',
    text2Xl: '24px',
  },
};

// The "Liquid Glass" theme: frosted glass surfaces, luminous ambient depth, and specular borders
export const glassmorphismTheme: ThemeDefinition = {
  id: 'glassmorphism',
  name: 'Liquid Glass',
  description: 'Frosted liquid glass surfaces, animated ambient depth, and specular luminous borders',
  isGlass: true,
  colors: {
    bgPrimary: 'transparent',
    bgSecondary: 'rgba(255, 255, 255, 0.78)',
    bgTertiary: 'rgba(241, 245, 249, 0.85)',
    bgCard: 'rgba(255, 255, 255, 0.88)',
    bgElevated: 'rgba(255, 255, 255, 0.96)',
    bgHover: 'rgba(255, 255, 255, 0.95)',
    bgActive: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',
    borderLight: 'rgba(255, 255, 255, 0.85)',
    borderMedium: 'rgba(226, 232, 240, 0.90)',
    borderFocus: '#2563EB',
    accent: '#0F172A',
    accentHover: '#1E293B',
    accentLight: 'rgba(255, 255, 255, 0.90)',
    accentText: '#FFFFFF',
    success: '#059669',
    successBg: 'rgba(16, 185, 129, 0.12)',
    warning: '#D97706',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    danger: '#DC2626',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.12)',
  },
  radius: {
    none: '0px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 2px 10px 0 rgba(0, 0, 0, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
    md: '0 6px 20px -2px rgba(0, 0, 0, 0.06), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1)',
    lg: '0 12px 32px -4px rgba(0, 0, 0, 0.08), inset 0 1px 2px 0 rgba(255, 255, 255, 1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontSans: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, sans-serif",
    textXs: '12px',
    textSm: '14px',
    textBase: '16px',
    textLg: '18px',
    textXl: '20px',
    text2Xl: '24px',
  },
};

// The "Floating Glass" theme: floating frosted capsules, translucent glass navigation, soft ambient shadows, and pill overlays
export const floatingGlassTheme: ThemeDefinition = {
  id: 'floating_glass',
  name: 'Floating Glass',
  description: 'Floating frosted capsules, translucent glass navigation, soft layered shadows, and pill overlays',
  isGlass: true,
  colors: {
    bgPrimary: 'transparent',
    bgSecondary: 'rgba(255, 255, 255, 0.65)',
    bgTertiary: 'rgba(241, 245, 249, 0.70)',
    bgCard: 'rgba(255, 255, 255, 0.72)',
    bgElevated: 'rgba(255, 255, 255, 0.85)',
    bgHover: 'rgba(255, 255, 255, 0.82)',
    bgActive: 'rgba(255, 255, 255, 0.95)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',
    borderLight: 'rgba(255, 255, 255, 0.70)',
    borderMedium: 'rgba(226, 232, 240, 0.75)',
    borderFocus: '#2563EB',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    accentLight: 'rgba(37, 99, 235, 0.12)',
    accentText: '#FFFFFF',
    success: '#059669',
    successBg: 'rgba(16, 185, 129, 0.14)',
    warning: '#D97706',
    warningBg: 'rgba(245, 158, 11, 0.14)',
    danger: '#DC2626',
    dangerBg: 'rgba(239, 68, 68, 0.14)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.14)',
  },
  radius: {
    none: '0px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 2px 8px 0 rgba(15, 23, 42, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.85)',
    md: '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.95)',
    lg: '0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 8px 20px -4px rgba(15, 23, 42, 0.06), inset 0 1px 2px 0 rgba(255, 255, 255, 1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontSans: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, sans-serif",
    textXs: '12px',
    textSm: '14px',
    textBase: '16px',
    textLg: '18px',
    textXl: '20px',
    text2Xl: '24px',
  },
};

// The "Liquid Wallpaper" theme: custom wallpaper image with frosted liquid glass and subtle edge refraction
export const liquidWallpaperTheme: ThemeDefinition = {
  id: 'liquid_wallpaper',
  name: 'Liquid Wallpaper',
  description: 'Custom wallpaper with frosted liquid glass and subtle edge refraction',
  isGlass: true,
  colors: {
    bgPrimary: 'transparent',
    bgSecondary: 'rgba(255, 255, 255, 0.70)',
    bgTertiary: 'rgba(241, 245, 249, 0.75)',
    bgCard: 'rgba(255, 255, 255, 0.78)',
    bgElevated: 'rgba(255, 255, 255, 0.88)',
    bgHover: 'rgba(255, 255, 255, 0.86)',
    bgActive: 'rgba(255, 255, 255, 0.95)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',
    borderLight: 'rgba(255, 255, 255, 0.75)',
    borderMedium: 'rgba(226, 232, 240, 0.80)',
    borderFocus: '#2563EB',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    accentLight: 'rgba(37, 99, 235, 0.12)',
    accentText: '#FFFFFF',
    success: '#059669',
    successBg: 'rgba(16, 185, 129, 0.14)',
    warning: '#D97706',
    warningBg: 'rgba(245, 158, 11, 0.14)',
    danger: '#DC2626',
    dangerBg: 'rgba(239, 68, 68, 0.14)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.14)',
  },
  radius: {
    none: '0px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 2px 8px 0 rgba(15, 23, 42, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.85)',
    md: '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.95)',
    lg: '0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 8px 20px -4px rgba(15, 23, 42, 0.06), inset 0 1px 2px 0 rgba(255, 255, 255, 1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontSans: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Poppins', 'Anek Bangla', 'Noorehuda', 'IndoPak', system-ui, sans-serif",
    textXs: '12px',
    textSm: '14px',
    textBase: '16px',
    textLg: '18px',
    textXl: '20px',
    text2Xl: '24px',
  },
};

// Theme registry: structure so more themes can be registered as additional entries without touching component code
export const THEME_REGISTRY: Record<string, ThemeDefinition> = {
  minimalism: minimalismTheme,
  glassmorphism: glassmorphismTheme,
  floating_glass: floatingGlassTheme,
  liquid_wallpaper: liquidWallpaperTheme,
};

export type GlassIntensityPreset = 'subtle' | 'balanced' | 'clear' | 'ultra_clear';

export interface GlassPresetOption {
  id: GlassIntensityPreset;
  label: string;
  intensity: number; // percentage: 20, 50, 75, 92
  description: string;
}

export const GLASS_PRESETS: GlassPresetOption[] = [
  { id: 'subtle', label: 'Subtle', intensity: 20, description: 'Soft frosted, higher opacity for reading' },
  { id: 'balanced', label: 'Balanced', intensity: 50, description: 'Default acrylic glass balance' },
  { id: 'clear', label: 'Clear', intensity: 75, description: 'Deep liquid glass refraction' },
  { id: 'ultra_clear', label: 'Ultra Clear', intensity: 92, description: 'High translucency crystal surface' },
];

/**
 * Feature-detect support for combining url() SVG filters with backdrop-filter.
 * If unsupported (notably Safari / iOS WebKit), gracefully fall back to standard blur.
 */
export const checkBackdropUrlFilterSupport = (): boolean => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || !CSS.supports) {
    return false;
  }
  const ua = navigator.userAgent;
  const isWebKit = /WebKit\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua) && !/Edg\//.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isWebKit || isIOS) {
    return false;
  }

  try {
    const supportsStandard = CSS.supports('backdrop-filter', 'url(#liquid-distortion) blur(10px)');
    const supportsWebkit = CSS.supports('-webkit-backdrop-filter', 'url(#liquid-distortion) blur(10px)');
    return Boolean(supportsStandard || supportsWebkit);
  } catch {
    return false;
  }
};

interface ThemeContextType {
  theme: ThemeDefinition;
  themeId: string;
  setThemeId: (id: string) => void;
  availableThemes: ThemeDefinition[];
  transparencyIntensity: number;
  setTransparencyIntensity: (value: number) => void;
  glassPreset: GlassIntensityPreset | 'custom';
  setGlassPreset: (preset: GlassIntensityPreset) => void;
  isGlassTheme: boolean;
  // Liquid Wallpaper additions
  wallpaperImage: string | null;
  setWallpaperImage: (base64: string | null) => void;
  isRefractionEnabled: boolean;
  setIsRefractionEnabled: (enabled: boolean) => void;
  supportsBackdropUrlFilter: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: minimalismTheme,
  themeId: 'minimalism',
  setThemeId: () => {},
  availableThemes: [minimalismTheme, glassmorphismTheme, floatingGlassTheme, liquidWallpaperTheme],
  transparencyIntensity: 50,
  setTransparencyIntensity: () => {},
  glassPreset: 'balanced',
  setGlassPreset: () => {},
  isGlassTheme: false,
  wallpaperImage: null,
  setWallpaperImage: () => {},
  isRefractionEnabled: true,
  setIsRefractionEnabled: () => {},
  supportsBackdropUrlFilter: false,
});

const computeGlassTheme = (
  baseTheme: ThemeDefinition,
  intensity: number
): ThemeDefinition => {
  if (!baseTheme.isGlass) return baseTheme;

  const t = Math.max(10, Math.min(95, intensity)) / 100;
  const isFloatingOrLiquid = baseTheme.id === 'floating_glass' || baseTheme.id === 'liquid_wallpaper';

  let cardAlpha: number;
  let panelAlpha: number;
  let elevatedAlpha: number;
  let borderAlpha: number;

  if (isFloatingOrLiquid) {
    cardAlpha = Number((0.85 - t * 0.50).toFixed(2));
    panelAlpha = Number((0.78 - t * 0.48).toFixed(2));
    // Elevated surfaces (modals, dialogs, dropdowns) maintain luminous frosted glass without flat stark white
    elevatedAlpha = Number((0.86 - t * 0.16).toFixed(2));
    borderAlpha = Number((0.82 - t * 0.42).toFixed(2));
  } else {
    cardAlpha = Number((0.94 - t * 0.42).toFixed(2));
    panelAlpha = Number((0.88 - t * 0.42).toFixed(2));
    elevatedAlpha = Number((0.90 - t * 0.14).toFixed(2));
    borderAlpha = Number((0.92 - t * 0.35).toFixed(2));
  }

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      bgCard: `rgba(255, 255, 255, ${cardAlpha})`,
      bgSecondary: `rgba(248, 250, 252, ${panelAlpha})`,
      bgTertiary: `rgba(241, 245, 249, ${panelAlpha})`,
      bgElevated: `rgba(255, 255, 255, ${elevatedAlpha})`,
      bgHover: `rgba(255, 255, 255, ${Math.min(0.98, cardAlpha + 0.12)})`,
      borderLight: `rgba(255, 255, 255, ${borderAlpha})`,
      borderMedium: `rgba(226, 232, 240, ${borderAlpha})`,
    },
  };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<string>(() => {
    const saved = localStorage.getItem('app_theme_id');
    if (saved && THEME_REGISTRY[saved]) {
      const introduced = localStorage.getItem('glassmorphism_v1_active');
      if (!introduced) {
        localStorage.setItem('glassmorphism_v1_active', 'true');
        localStorage.setItem('app_theme_id', 'glassmorphism');
        return 'glassmorphism';
      }
      return saved;
    }
    localStorage.setItem('glassmorphism_v1_active', 'true');
    localStorage.setItem('app_theme_id', 'glassmorphism');
    return 'glassmorphism';
  });

  const [transparencyIntensity, setTransparencyIntensityState] = useState<number>(() => {
    const saved = localStorage.getItem('app_glass_transparency');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 95) {
        return parsed;
      }
    }
    return 50; // default: Balanced (50%)
  });

  // Liquid Wallpaper stored background image (base64 string in localStorage)
  const [wallpaperImage, setWallpaperImageState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('app_liquid_wallpaper_image');
    } catch {
      return null;
    }
  });

  const setWallpaperImage = (base64: string | null) => {
    setWallpaperImageState(base64);
    try {
      if (base64) {
        localStorage.setItem('app_liquid_wallpaper_image', base64);
      } else {
        localStorage.removeItem('app_liquid_wallpaper_image');
      }
    } catch (e) {
      console.error('Error saving wallpaper to localStorage:', e);
    }
  };

  // Liquid edge-refraction toggle (stored in localStorage under 'app_liquid_refraction_enabled', default: true)
  const [isRefractionEnabled, setIsRefractionEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_liquid_refraction_enabled');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {}
    return true; // default: on
  });

  const setIsRefractionEnabled = (enabled: boolean) => {
    setIsRefractionEnabledState(enabled);
    try {
      localStorage.setItem('app_liquid_refraction_enabled', String(enabled));
    } catch (e) {
      console.error('Error saving refraction setting to localStorage:', e);
    }
  };

  // Hardware/Browser support for combining url() filter with backdrop-filter
  const [supportsBackdropUrlFilter] = useState<boolean>(() => checkBackdropUrlFilterSupport());

  const setTransparencyIntensity = (val: number) => {
    const clamped = Math.max(10, Math.min(95, Math.round(val)));
    setTransparencyIntensityState(clamped);
    localStorage.setItem('app_glass_transparency', String(clamped));
  };

  const setGlassPreset = (preset: GlassIntensityPreset) => {
    const match = GLASS_PRESETS.find((p) => p.id === preset);
    if (match) {
      setTransparencyIntensity(match.intensity);
    }
  };

  const glassPreset: GlassIntensityPreset | 'custom' = (() => {
    const match = GLASS_PRESETS.find((p) => Math.abs(p.intensity - transparencyIntensity) <= 2);
    return match ? match.id : 'custom';
  })();

  const setThemeId = (id: string) => {
    if (THEME_REGISTRY[id]) {
      setThemeIdState(id);
      localStorage.setItem('app_theme_id', id);
    }
  };

  const rawTheme = THEME_REGISTRY[themeId] || glassmorphismTheme;
  const currentTheme = computeGlassTheme(rawTheme, transparencyIntensity);
  const isGlassTheme = Boolean(currentTheme.isGlass);

  // Apply CSS custom properties dynamically so Tailwind utilities or native elements inherit them
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme.id);
    root.style.setProperty('--bg-primary', currentTheme.colors.bgPrimary);
    root.style.setProperty('--bg-secondary', currentTheme.colors.bgSecondary);
    root.style.setProperty('--bg-card', currentTheme.colors.bgCard);
    root.style.setProperty('--text-primary', currentTheme.colors.textPrimary);
    root.style.setProperty('--text-secondary', currentTheme.colors.textSecondary);
    root.style.setProperty('--border-light', currentTheme.colors.borderLight);
    root.style.setProperty('--accent', currentTheme.colors.accent);
    root.style.setProperty('--card-shadow', currentTheme.shadows.md);
    root.style.setProperty('--card-subtle-shadow', currentTheme.shadows.sm);
    root.style.setProperty('--card-subtle-shadow-hover', currentTheme.shadows.md);
    root.style.setProperty('--box-subtle-shadow', '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)');

    // Dynamic CSS variables for glass themes
    if (currentTheme.isGlass) {
      const t = Math.max(10, Math.min(95, transparencyIntensity)) / 100;
      const isFloating = currentTheme.id === 'floating_glass' || currentTheme.id === 'liquid_wallpaper';
      const isLiquid = currentTheme.id === 'liquid_wallpaper';

      const cardAlpha = isFloating
        ? (0.85 - t * 0.50).toFixed(2)
        : (0.94 - t * 0.42).toFixed(2);
      const panelAlpha = isFloating
        ? (0.78 - t * 0.48).toFixed(2)
        : (0.88 - t * 0.42).toFixed(2);
      const sidebarAlpha = isFloating
        ? (0.82 - t * 0.45).toFixed(2)
        : (0.92 - t * 0.40).toFixed(2);
      const headerAlpha = isFloating
        ? (0.84 - t * 0.45).toFixed(2)
        : (0.92 - t * 0.38).toFixed(2);
      const navAlpha = isFloating
        ? (0.88 - t * 0.42).toFixed(2)
        : (0.96 - t * 0.35).toFixed(2);
      const borderAlpha = isFloating
        ? (0.82 - t * 0.42).toFixed(2)
        : (0.92 - t * 0.35).toFixed(2);

      const baseBlur = isFloating ? 16 : 14;
      const cardBlur = Math.round(baseBlur + t * 20);

      root.style.setProperty('--glass-intensity', `${transparencyIntensity}%`);
      root.style.setProperty('--glass-card-bg', `rgba(255, 255, 255, ${cardAlpha})`);
      root.style.setProperty('--glass-card-blur', `${cardBlur}px`);
      root.style.setProperty('--glass-panel-bg', `rgba(248, 250, 252, ${panelAlpha})`);
      root.style.setProperty('--glass-sidebar-bg', `rgba(255, 255, 255, ${sidebarAlpha})`);
      root.style.setProperty('--glass-header-bg', `rgba(255, 255, 255, ${headerAlpha})`);
      root.style.setProperty('--glass-nav-bg', `rgba(255, 255, 255, ${navAlpha})`);
      root.style.setProperty('--glass-border', `rgba(255, 255, 255, ${borderAlpha})`);
      root.style.setProperty('--glass-border-strong', `rgba(255, 255, 255, ${Math.min(1, Number(borderAlpha) + 0.15)})`);
      root.style.setProperty('--glass-blur-heavy', `${cardBlur + 4}px`);
      root.style.setProperty('--glass-blur-nav', `${cardBlur + 6}px`);

      if (isLiquid) {
        const defaultNeutralGradient = 'radial-gradient(circle at 18% 18%, rgba(219, 234, 254, 0.95), transparent 45%), radial-gradient(circle at 82% 16%, rgba(243, 232, 255, 0.90), transparent 42%), radial-gradient(circle at 50% 84%, rgba(224, 242, 254, 0.90), transparent 50%), #E2E8F0';
        root.style.setProperty('--liquid-wallpaper-bg', wallpaperImage ? `url(${wallpaperImage})` : defaultNeutralGradient);
        root.style.setProperty('--liquid-card-backdrop', `blur(${cardBlur}px) saturate(160%)`);

        // Liquid optical edge refraction on top-level glass surfaces (bottom nav capsule, modals, top-level cards)
        const canUseRefraction = isRefractionEnabled && supportsBackdropUrlFilter;
        if (canUseRefraction) {
          root.style.setProperty('--liquid-surface-backdrop', `url(#liquid-distortion) blur(${cardBlur + 6}px) saturate(160%)`);
        } else {
          root.style.setProperty('--liquid-surface-backdrop', `blur(${cardBlur + 6}px) saturate(160%)`);
        }
      } else {
        root.style.removeProperty('--liquid-wallpaper-bg');
        root.style.removeProperty('--liquid-card-backdrop');
        root.style.removeProperty('--liquid-surface-backdrop');
      }
    }
  }, [currentTheme, transparencyIntensity, wallpaperImage, isRefractionEnabled, supportsBackdropUrlFilter]);

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        themeId,
        setThemeId,
        availableThemes: Object.values(THEME_REGISTRY),
        transparencyIntensity,
        setTransparencyIntensity,
        glassPreset,
        setGlassPreset,
        isGlassTheme,
        wallpaperImage,
        setWallpaperImage,
        isRefractionEnabled,
        setIsRefractionEnabled,
        supportsBackdropUrlFilter,
      }}
    >
      {/* SVG Filter Definition for Liquid Edge Refraction (Injected once near app root with unique id) */}
      <svg
        id="liquid-refraction-svg-root"
        aria-hidden="true"
        style={{
          position: 'fixed',
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          overflow: 'hidden',
          zIndex: -9999,
        }}
      >
        <defs>
          <filter
            id="liquid-distortion"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.02"
              numOctaves="2"
              result="turbulence"
            />
            <feGaussianBlur in="turbulence" stdDeviation="2.5" result="blurredTurbulence" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurredTurbulence"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Fixed Full-Viewport Wallpaper Layer (Active only when themeId === 'liquid_wallpaper') */}
      {themeId === 'liquid_wallpaper' && (
        <div
          id="liquid-wallpaper-viewport"
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none transition-all duration-300"
          style={{
            zIndex: 0,
            backgroundImage: wallpaperImage
              ? `url(${wallpaperImage})`
              : 'radial-gradient(circle at 18% 18%, rgba(219, 234, 254, 0.95), transparent 45%), radial-gradient(circle at 82% 16%, rgba(243, 232, 255, 0.90), transparent 42%), radial-gradient(circle at 50% 84%, rgba(224, 242, 254, 0.90), transparent 50%), #E2E8F0',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        />
      )}

      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  return useContext(ThemeContext);
}
