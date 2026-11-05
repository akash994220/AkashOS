import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation } from '../../context/NavigationContext';
import { AVAILABLE_CURRENCIES } from '../../lib/currency';
import { GlassTransparencyControl } from '../theme/GlassTransparencyControl';
import { useConnectedAccounts } from '../../context/ConnectedAccountsContext';
import { DataBackupModal } from './DataBackupModal';
import {
  ALL_WORKSPACE_TAB_OPTIONS,
  DEFAULT_CAPSULE_TABS,
} from '../navigation/BottomCapsuleNavigation';
import { WorkspaceSection } from '../../context/NavigationContext';
import { 
  Palette, 
  User, 
  LogOut, 
  Coins, 
  ChevronRight, 
  X, 
  Check,
  RefreshCw,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Sparkles,
  Layers,
  Share2,
  Database,
  Download,
  Upload,
  Image as ImageIcon,
  ImagePlus,
  Type,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    theme, 
    themeId, 
    setThemeId, 
    availableThemes,
    wallpaperImage,
    setWallpaperImage,
    isRefractionEnabled,
    setIsRefractionEnabled,
    supportsBackdropUrlFilter
  } = useTheme();
  const { user, userSettings, updateUserSettings, signOut } = useAuth();
  const { registerBackHandler } = useNavigation();
  const {
    status: accountStatus,
    connectYouTube,
    disconnectPlatform,
    loading: accountsLoading,
  } = useConnectedAccounts();

  const [connectingYouTube, setConnectingYouTube] = useState(false);
  const [disconnectingYouTube, setDisconnectingYouTube] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Liquid Wallpaper upload local state
  const wallpaperInputRef = React.useRef<HTMLInputElement | null>(null);
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [isProcessingWallpaper, setIsProcessingWallpaper] = useState(false);

  const handleWallpaperFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setWallpaperError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    setWallpaperError(null);
    setIsProcessingWallpaper(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setIsProcessingWallpaper(false);
        return;
      }

      // Optimize image resolution if exceeding 1920x1080 to keep localStorage performant
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1920;
          const maxH = 1080;
          let w = img.width;
          let h = img.height;

          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const optimized = canvas.toDataURL('image/jpeg', 0.86);
            setWallpaperImage(optimized);
          } else {
            setWallpaperImage(dataUrl);
          }
        } catch {
          setWallpaperImage(dataUrl);
        } finally {
          setIsProcessingWallpaper(false);
        }
      };
      img.onerror = () => {
        setWallpaperImage(dataUrl);
        setIsProcessingWallpaper(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setWallpaperError('Failed to read the selected image file.');
      setIsProcessingWallpaper(false);
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same file triggers change
    e.target.value = '';
  };

  // Modals state
  const [activeModal, setActiveModal] = useState<'theme' | 'currencies' | 'clean_cache' | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'export' | 'import'>('export');

  // Cache clean state
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState(false);

  // Register back handler to dismiss modal when user presses back
  useEffect(() => {
    if (showBackupModal) {
      return registerBackHandler(() => {
        setShowBackupModal(false);
        return true;
      });
    }
    if (activeModal !== null) {
      return registerBackHandler(() => {
        setActiveModal(null);
        return true;
      });
    }
  }, [showBackupModal, activeModal, registerBackHandler]);

  // Toggle currency selection
  const handleToggleCurrency = async (code: string) => {
    const current = userSettings?.display_currencies || ['USD', 'EUR'];
    let updated: string[];
    if (current.includes(code)) {
      updated = current.filter((c) => c !== code);
    } else {
      updated = [...current, code];
    }
    await updateUserSettings({ display_currencies: updated });
  };

  // Toggle or select a tab for the 4-slot bottom capsule
  const handleToggleCapsuleTab = async (tabId: WorkspaceSection) => {
    const currentTabs: WorkspaceSection[] = (userSettings?.bottom_capsule_tabs as WorkspaceSection[]) || DEFAULT_CAPSULE_TABS;
    let nextTabs: WorkspaceSection[];

    if (currentTabs.includes(tabId)) {
      // Cannot remove if already at min 1 tab
      if (currentTabs.length <= 1) return;
      nextTabs = currentTabs.filter((t) => t !== tabId);
    } else {
      if (currentTabs.length >= 4) {
        // Replace the last item to maintain exactly 4 slots
        nextTabs = [...currentTabs.slice(0, 3), tabId];
      } else {
        nextTabs = [...currentTabs, tabId];
      }
    }

    await updateUserSettings({ bottom_capsule_tabs: nextTabs });
  };

  const handleResetCapsuleTabs = async () => {
    await updateUserSettings({ bottom_capsule_tabs: DEFAULT_CAPSULE_TABS });
  };

  // Quick reload
  const handleQuickReload = () => {
    window.location.reload();
  };

  // Connected Accounts handlers
  const handleConnectYouTube = async () => {
    setAccountFeedback(null);
    setConnectingYouTube(true);
    try {
      await connectYouTube();
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err?.message || 'Failed to start YouTube connection.' });
    } finally {
      setConnectingYouTube(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    if (!confirm('Disconnect YouTube account? Stored tokens will be permanently cleared from Vault.')) return;
    setAccountFeedback(null);
    setDisconnectingYouTube(true);
    try {
      await disconnectPlatform('youtube');
      setAccountFeedback({ type: 'success', message: 'YouTube disconnected. Vault token cleared.' });
      setTimeout(() => setAccountFeedback(null), 3500);
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err?.message || 'Failed to disconnect YouTube.' });
    } finally {
      setDisconnectingYouTube(false);
    }
  };

  // Clean cache and hard reload
  const handleCleanCacheAndReload = async () => {
    setIsCleaningCache(true);
    setCleanSuccess(false);
    try {
      // 1. Delete all Service Worker CacheStorage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 2. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 3. Clear sessionStorage
      sessionStorage.clear();

      // 4. Preserve theme selection while wiping non-essential caches
      const savedTheme = localStorage.getItem('app_theme_id');
      localStorage.clear();
      if (savedTheme) {
        localStorage.setItem('app_theme_id', savedTheme);
      }

      setCleanSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 750);
    } catch (err) {
      console.error('Failed to clean cache completely:', err);
      window.location.reload();
    }
  };

  const displayCurrenciesLabel = (userSettings?.display_currencies || ['USD', 'EUR']).join(', ');

  return (
    <div
      id="settings-view"
      className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 pb-8 sm:pb-12"
      style={{ fontFamily: theme.typography.fontSans }}
    >
      <div>
        <h1
          className="text-xl md:text-2xl font-semibold tracking-tight"
          style={{ color: theme.colors.textPrimary }}
        >
          Settings
        </h1>
        <p className="text-xs md:text-sm mt-1" style={{ color: theme.colors.textMuted }}>
          Personal preferences, vault security, and display configuration
        </p>
      </div>

      {/* SECTION 1: APPEARANCE */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Appearance & Themes
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.md,
          }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.bgSecondary, color: theme.colors.textPrimary }}
              >
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold block" style={{ color: theme.colors.textPrimary }}>
                  Workspace Theme
                </span>
                <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Choose your visual atmosphere and material styling
                </span>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {theme.name}
            </span>
          </div>

          {/* Direct Theme Switch Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {availableThemes.map((t) => {
              const isSelected = themeId === t.id;
              const isGlassTheme = Boolean(t.isGlass);
              const isFloating = t.id === 'floating_glass';
              const isLiquidWallpaper = t.id === 'liquid_wallpaper';
              return (
                <button
                  key={t.id}
                  id={`theme-card-${t.id}`}
                  onClick={() => setThemeId(t.id)}
                  style={{
                    borderRadius: theme.radius.md,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.borderLight,
                  }}
                  className={`p-3 text-left border cursor-pointer transition-all relative overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-blue-500/20 bg-blue-50/25'
                      : 'hover:border-zinc-300 bg-white/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                          isLiquidWallpaper
                            ? 'bg-gradient-to-tr from-purple-400/30 via-pink-400/30 to-blue-500/30 border border-white/70 shadow-2xs'
                            : isFloating
                            ? 'bg-gradient-to-tr from-cyan-400/30 to-blue-500/30 border border-white/70 shadow-2xs'
                            : isGlassTheme
                            ? 'bg-gradient-to-tr from-blue-400/30 to-purple-400/30 border border-white/60 shadow-2xs'
                            : 'bg-zinc-100 border border-zinc-200'
                        }`}
                      >
                        {isLiquidWallpaper ? (
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                        ) : isFloating ? (
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                        ) : isGlassTheme ? (
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Palette className="w-3.5 h-3.5 text-zinc-700" />
                        )}
                      </div>
                      <span className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                        {t.name}
                      </span>
                    </div>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: theme.colors.accent, color: theme.colors.accentText }}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                    {t.description}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/5 text-zinc-600">
                      {isLiquidWallpaper
                        ? 'Liquid Wallpaper'
                        : isFloating
                        ? 'Floating Pill Glass'
                        : isGlassTheme
                        ? 'Frosted Glass'
                        : 'Clean Light'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-semibold text-blue-600">Active</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Transparency Intensity Toggle & Slider for All Glass Themes */}
          <div className="pt-3">
            <GlassTransparencyControl />
          </div>

          {/* LIQUID WALLPAPER STUDIO (Active when themeId === 'liquid_wallpaper') */}
          {themeId === 'liquid_wallpaper' && (
            <div
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-4 border mt-3 space-y-4 animate-in fade-in duration-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 leading-tight">
                      Liquid Wallpaper & Refraction
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Upload your background image and customize optical edge refraction
                    </p>
                  </div>
                </div>
                {wallpaperImage && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Custom Wallpaper
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={wallpaperInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleWallpaperFileSelect}
                className="hidden"
                id="liquid-wallpaper-file-input"
              />

              {/* Wallpaper Upload / Preview Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800">Background Wallpaper</span>
                  <span className="text-[11px] text-zinc-500">
                    {wallpaperImage ? 'Stored locally in browser' : 'Default: Neutral Liquid Gradient'}
                  </span>
                </div>

                {wallpaperImage ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/70 rounded-xl border border-zinc-200 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-black/10 shadow-xs shrink-0 bg-zinc-100">
                        <img
                          src={wallpaperImage}
                          alt="Custom Liquid Wallpaper"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-zinc-900">Custom Image Active</div>
                        <div className="text-[11px] text-zinc-500">
                          Frosted glass surfaces refract and blur this wallpaper
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => wallpaperInputRef.current?.click()}
                        disabled={isProcessingWallpaper}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWallpaperImage(null)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove wallpaper and restore default neutral gradient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-zinc-300 hover:border-blue-400 rounded-xl bg-white/50 hover:bg-white/80 transition-all cursor-pointer text-center space-y-1.5 group"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {isProcessingWallpaper ? (
                        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-zinc-800">
                      {isProcessingWallpaper ? 'Processing Image...' : 'Click to Upload Wallpaper Image'}
                    </div>
                    <div className="text-[11px] text-zinc-500 max-w-sm">
                      Supports PNG, JPG, or WebP. Without an image, a soft neutral gradient renders automatically.
                    </div>
                  </div>
                )}

                {wallpaperError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{wallpaperError}</span>
                  </div>
                )}
              </div>

              {/* Edge Refraction Distortion Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-black/5 gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900">
                      Liquid Edge Refraction
                    </span>
                    {supportsBackdropUrlFilter ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Hardware Refraction Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Safe Fallback: Plain Blur Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed max-w-md">
                    {supportsBackdropUrlFilter
                      ? 'Subtly bends and refracts the background wallpaper along top-level glass borders using SVG displacement.'
                      : 'Your browser engine does not support SVG filters inside backdrop-filter. Standard high-performance frosted blur is automatically used with no glitches.'}
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-liquid-refraction"
                  role="switch"
                  aria-checked={isRefractionEnabled}
                  onClick={() => setIsRefractionEnabled(!isRefractionEnabled)}
                  disabled={!supportsBackdropUrlFilter}
                  style={{
                    backgroundColor:
                      isRefractionEnabled && supportsBackdropUrlFilter
                        ? theme.colors.accent
                        : theme.colors.borderMedium,
                    borderRadius: theme.radius.full,
                  }}
                  className={`relative inline-flex h-6 w-11 items-center transition-colors cursor-pointer shrink-0 ${
                    !supportsBackdropUrlFilter ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={
                    !supportsBackdropUrlFilter
                      ? 'SVG backdrop-filter unsupported in this browser; safe fallback active'
                      : 'Toggle subtle liquid edge refraction'
                  }
                >
                  <span
                    style={{ borderRadius: theme.radius.full }}
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isRefractionEnabled && supportsBackdropUrlFilter ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: BOTTOM CAPSULE TABS CUSTOMIZATION */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Bottom Capsule Navigation (4 Tabs + Settings)
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            backdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
            WebkitBackdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
          }}
          className="p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <span>Configure 4 Quick-Access Workspace Tabs</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {((userSettings?.bottom_capsule_tabs as WorkspaceSection[]) || DEFAULT_CAPSULE_TABS).length}/4 Selected
                </span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Choose the 4 workspace features you want pinned directly in the bottom navigation capsule. The 5th slot is dedicated to Settings.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetCapsuleTabs}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Tab Options Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {ALL_WORKSPACE_TAB_OPTIONS.map((opt) => {
              const currentTabs: WorkspaceSection[] =
                (userSettings?.bottom_capsule_tabs as WorkspaceSection[]) || DEFAULT_CAPSULE_TABS;
              const isSelected = currentTabs.includes(opt.id);
              const orderIndex = currentTabs.indexOf(opt.id);
              const Icon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleCapsuleTab(opt.id)}
                  style={{
                    borderRadius: theme.radius.md,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.borderLight,
                  }}
                  className={`p-3 text-left border cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between min-h-[82px] ${
                    isSelected
                      ? 'ring-2 ring-blue-500/20 bg-blue-50/30'
                      : 'hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-200/70 text-zinc-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded-full">
                        Slot #{orderIndex + 1}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-medium">Add</span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="text-xs font-bold text-zinc-900 leading-tight">{opt.label}</div>
                    <div className="text-[10px] text-zinc-400 leading-none mt-0.5">Quick access tab</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-3 flex items-center justify-between">
            <span>Tip: Tapping an unselected tab when 4 are active will swap the 4th slot automatically.</span>
            <span className="font-semibold text-zinc-600">Slot #5: Always Settings</span>
          </div>
        </div>
      </div>

      {/* SECTION: TYPOGRAPHY & SCRIPTS */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Typography & Scripts
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            backdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
            WebkitBackdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
          }}
          className="p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                Multilingual Typography & Numbers
              </h3>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Active System
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* English & Numbers: Poppins */}
            <div
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.borderLight,
              }}
              className="p-3 border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">English & Digits</span>
                <span className="text-[10px] font-semibold text-zinc-500 bg-white/80 px-1.5 py-0.5 rounded border border-black/5">
                  Poppins
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-snug">
                Geometric sans-serif for UI, notes, and counting timers.
              </p>
              <div className="pt-1.5 border-t border-black/5 flex items-center justify-between text-xs font-poppins tabular-nums font-bold text-zinc-900">
                <span>Timers:</span>
                <span className="text-blue-700 bg-white px-2 py-0.5 rounded border border-zinc-200">
                  01:24:58 · ৳50,000
                </span>
              </div>
            </div>

            {/* Bangla: Anek Bangla */}
            <div
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.borderLight,
              }}
              className="p-3 border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">বাংলা (Bangla)</span>
                <span className="text-[10px] font-semibold text-zinc-500 bg-white/80 px-1.5 py-0.5 rounded border border-black/5">
                  Anek Bangla
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-snug font-bangla">
                বাংলা পাঠ্য ও সংখ্যার জন্য মার্জিত টাইপোগ্রাফি।
              </p>
              <div className="pt-1.5 border-t border-black/5 flex items-center justify-between text-xs font-bangla text-zinc-900">
                <span>নমুনা:</span>
                <span className="font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded border border-zinc-200">
                  আমার সোনার বাংলা
                </span>
              </div>
            </div>

            {/* Arabic: Noorehuda / IndoPak */}
            <div
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.borderLight,
              }}
              className="p-3 border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">العربية (Arabic)</span>
                <span className="text-[10px] font-semibold text-zinc-500 bg-white/80 px-1.5 py-0.5 rounded border border-black/5">
                  Noorehuda / IndoPak
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-snug font-arabic" dir="rtl">
                خط نورهدى و إندوپاك الأصيل للقرآن الكريم والقراءة.
              </p>
              <div className="pt-1.5 border-t border-black/5 flex items-center justify-between text-xs font-arabic text-zinc-900" dir="rtl">
                <span className="font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ACCOUNT */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Account
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
          }}
          className="divide-y divide-zinc-100"
        >
          {/* Email row */}
          <div
            id="setting-row-email"
            className="flex items-center justify-between p-4"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.bgSecondary, color: theme.colors.textPrimary }}
              >
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
                Email
              </span>
            </div>
            <span className="text-sm select-all" style={{ color: theme.colors.textSecondary }}>
              {user?.email || 'Guest / Not Signed In'}
            </span>
          </div>

          {/* Log out row */}
          <button
            id="setting-row-logout"
            onClick={signOut}
            className="w-full flex items-center justify-between p-4 transition-colors hover:bg-red-50/50 cursor-pointer text-left"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.dangerBg, color: theme.colors.danger }}
              >
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium" style={{ color: theme.colors.danger }}>
                Log out
              </span>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
          </button>
        </div>
      </div>

      {/* SECTION: CONNECTED ACCOUNTS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: theme.colors.textMuted }}
          >
            Connected Accounts & Publishing
          </div>
          {accountStatus?.youtubeQuota && (
            <div className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
              {accountStatus.youtubeQuota.used} of ~{accountStatus.youtubeQuota.limit} YouTube uploads used today
            </div>
          )}
        </div>

        {/* Feedback message banner */}
        {accountFeedback && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              accountFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {accountFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{accountFeedback.message}</span>
            </div>
            <button
              onClick={() => setAccountFeedback(null)}
              className="text-xs text-zinc-400 hover:text-zinc-700 ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
          }}
          className="divide-y divide-zinc-100"
        >
          {/* YouTube Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">YouTube Channel</span>
                  {accountStatus?.youtube?.connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      Not Connected
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {accountStatus?.youtube?.connected ? (
                    <span className="text-zinc-700">
                      Connected as <strong className="text-zinc-900">{accountStatus.youtube.channelTitle || 'Channel'}</strong> · Stored in Vault
                    </span>
                  ) : (
                    <span>Direct publish long-form videos & Shorts via YouTube Data API v3</span>
                  )}
                </div>
                {/* Quota bar if connected */}
                {accountStatus?.youtube?.connected && (
                  <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-2">
                    <span className="font-medium">Daily Quota:</span>
                    <span className="font-bold text-zinc-800">{accountStatus.youtubeQuota?.used || 0} of ~100 used today</span>
                    <span className="text-zinc-400">· resets daily (00:00 UTC)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {accountStatus?.youtube?.connected ? (
                <button
                  type="button"
                  onClick={handleDisconnectYouTube}
                  disabled={disconnectingYouTube}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {disconnectingYouTube ? (
                    <span className="inline-block w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectYouTube}
                  disabled={connectingYouTube || accountsLoading}
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    borderRadius: theme.radius.md,
                  }}
                  className="text-xs font-bold px-3.5 py-2 hover:bg-red-600 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {connectingYouTube ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  )}
                  <span>Connect YouTube</span>
                </button>
              )}
            </div>
          </div>

          {/* Facebook & Instagram Row (Stage 2 preview) */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/40">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">Facebook Page & Instagram Business</span>
                  <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-200/70 px-2 py-0.5 rounded-full">
                    Next Phase
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Meta Graph API integration ready for Facebook Pages and linked Instagram Business accounts.
                </div>
              </div>
            </div>
            <div className="shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-400 bg-zinc-100 cursor-not-allowed"
                title="Building YouTube end-to-end first"
              >
                Connect Facebook Page
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: FINANCIAL */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Financial
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
          }}
        >
          <button
            id="setting-row-currencies"
            onClick={() => setActiveModal('currencies')}
            className="w-full flex items-center justify-between p-4 transition-colors hover:bg-zinc-50/50 cursor-pointer"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.bgSecondary, color: theme.colors.textPrimary }}
              >
                <Coins className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
                Display Currencies
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm truncate max-w-[160px]" style={{ color: theme.colors.textSecondary }}>
                {displayCurrenciesLabel || 'None (BDT only)'}
              </span>
              <ChevronRight className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 5: DATA & UNIVERSAL BACKUPS */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          Data & Universal Backups
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
          }}
          className="divide-y divide-zinc-100"
        >
          {/* Export & Import Row */}
          <div
            id="setting-row-backup"
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
            style={{ minHeight: '64px' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 border border-blue-100"
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-900 block">
                  Export & Import Data (Full Backup)
                </span>
                <span className="text-xs text-zinc-500 leading-relaxed block mt-0.5 max-w-md">
                  Universal loss-less export of all notes, folders, threads, tasks, pipeline items, and vault records, with single-click restore into place.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                id="btn-settings-open-export"
                type="button"
                onClick={() => {
                  setBackupModalTab('export');
                  setShowBackupModal(true);
                }}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.borderLight,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.md,
                }}
                className="px-3.5 py-1.5 text-xs font-semibold border hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export</span>
              </button>

              <button
                id="btn-settings-open-import"
                type="button"
                onClick={() => {
                  setBackupModalTab('import');
                  setShowBackupModal(true);
                }}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  borderRadius: theme.radius.md,
                }}
                className="px-3.5 py-1.5 text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: SYSTEM & CACHE */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold tracking-wider uppercase px-1"
          style={{ color: theme.colors.textMuted }}
        >
          System & Storage
        </div>
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
          }}
          className="divide-y divide-zinc-100"
        >
          {/* Quick Reload Row */}
          <div
            id="setting-row-reload"
            className="w-full flex items-center justify-between p-4"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.bgSecondary, color: theme.colors.textPrimary }}
              >
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block" style={{ color: theme.colors.textPrimary }}>
                  Reload App
                </span>
                <span className="text-xs text-zinc-500">
                  Quick reload without resetting stored cache
                </span>
              </div>
            </div>
            <button
              id="quick-reload-btn"
              onClick={handleQuickReload}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                minHeight: '36px',
              }}
              className="px-3.5 py-1.5 text-xs font-semibold border hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
              <span>Reload</span>
            </button>
          </div>

          {/* Clean Cache & Reload Row */}
          <button
            id="setting-row-clean-cache"
            onClick={() => setActiveModal('clean_cache')}
            className="w-full flex items-center justify-between p-4 transition-colors hover:bg-zinc-50/50 cursor-pointer text-left"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-600"
              >
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block text-zinc-900">
                  Reload & Clean Cache
                </span>
                <span className="text-xs text-zinc-500">
                  Purge service workers, temporary caches & force hard reset
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/50">
                Clean Cache
              </span>
              <ChevronRight className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
            </div>
          </button>
        </div>
      </div>

      {/* MODAL 1: THEME POPUP */}
      {activeModal === 'theme' && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '400px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="modal-surface space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: theme.colors.textPrimary }}>
                Appearance Theme
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
                style={{ color: theme.colors.textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {availableThemes.map((t) => {
                const isSelected = themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setThemeId(t.id);
                      setActiveModal(null);
                    }}
                    style={{
                      borderRadius: theme.radius.md,
                      backgroundColor: isSelected ? theme.colors.bgSecondary : 'transparent',
                      border: `1px solid ${isSelected ? theme.colors.accent : theme.colors.borderLight}`,
                      padding: theme.spacing.md,
                    }}
                    className="w-full flex items-center justify-between cursor-pointer transition-all hover:border-zinc-400"
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                        {t.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: theme.colors.textSecondary }}>
                        {t.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: theme.colors.accent, color: theme.colors.accentText }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DISPLAY CURRENCIES POPUP */}
      {activeModal === 'currencies' && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '420px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: theme.spacing.lg,
            }}
            className="modal-surface space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold" style={{ color: theme.colors.textPrimary }}>
                  Display Currencies
                </h2>
                <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
                  BDT is the base currency. Selected currencies appear as reference.
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
                style={{ color: theme.colors.textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permanent Base Currency Indicator */}
            <div
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: `1px solid ${theme.colors.borderLight}`,
              }}
              className="flex items-center justify-between"
            >
              <div>
                <span className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                  BDT (Bangladeshi Taka)
                </span>
                <span className="text-xs block" style={{ color: theme.colors.textMuted }}>
                  Base Currency • Cannot be removed
                </span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">
                BASE
              </span>
            </div>

            {/* List of selectable currencies */}
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {AVAILABLE_CURRENCIES.map((c) => {
                const isSelected = (userSettings?.display_currencies || ['USD', 'EUR']).includes(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() => handleToggleCurrency(c.code)}
                    style={{
                      borderRadius: theme.radius.md,
                      border: `1px solid ${isSelected ? theme.colors.accent : theme.colors.borderLight}`,
                      backgroundColor: isSelected ? theme.colors.bgSecondary : 'transparent',
                      minHeight: '44px',
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-poppins tabular-nums font-bold w-10" style={{ color: theme.colors.textPrimary }}>
                        {c.code}
                      </span>
                      <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        {c.name} ({c.symbol})
                      </span>
                    </div>
                    <div
                      className="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                      style={{
                        borderColor: isSelected ? theme.colors.accent : theme.colors.borderMedium,
                        backgroundColor: isSelected ? theme.colors.accent : 'transparent',
                        color: theme.colors.accentText,
                      }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              style={{
                backgroundColor: theme.colors.accent,
                color: theme.colors.accentText,
                borderRadius: theme.radius.md,
                minHeight: '44px',
              }}
              className="w-full text-xs font-medium py-2.5 hover:opacity-90 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: CLEAN CACHE & RELOAD POPUP */}
      {activeModal === 'clean_cache' && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '440px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="modal-surface space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold" style={{ color: theme.colors.textPrimary }}>
                  Reload & Clean Cache
                </h2>
              </div>
              <button
                onClick={() => !isCleaningCache && setActiveModal(null)}
                disabled={isCleaningCache}
                className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                style={{ color: theme.colors.textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-zinc-600 space-y-2.5 leading-relaxed">
              <p>
                This cleans all local service worker caches, clears temporary browser state, and forces a fresh reload of the application.
              </p>
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/60 rounded-lg flex items-start gap-2 text-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Cloud Data Safe:</strong> All transactions, budget logs, threads, and workspace notes in Firebase Firestore will NOT be touched or lost.
                </span>
              </div>
              <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-lg flex items-start gap-2 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Recommended if you notice any cached interface glitches, stale PWA state, or sync inconsistencies.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isCleaningCache}
                onClick={() => setActiveModal(null)}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.borderLight,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.md,
                  minHeight: '42px',
                }}
                className="flex-1 text-xs font-semibold border hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                id="confirm-clean-cache-btn"
                type="button"
                disabled={isCleaningCache}
                onClick={handleCleanCacheAndReload}
                style={{
                  backgroundColor: cleanSuccess ? '#059669' : '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: theme.radius.md,
                  minHeight: '42px',
                }}
                className="flex-1 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {isCleaningCache ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Cleaning...</span>
                  </>
                ) : cleanSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Reloading...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Clean & Reload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULL DATA BACKUP & RESTORE */}
      <DataBackupModal
        isOpen={showBackupModal}
        initialTab={backupModalTab}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
};
