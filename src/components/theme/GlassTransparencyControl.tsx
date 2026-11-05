import React from 'react';
import { useTheme, GLASS_PRESETS, GlassIntensityPreset } from '../../theme/ThemeContext';
import { 
  Sliders, 
  Sparkles, 
  Layers, 
  RotateCcw, 
  Eye, 
  Check, 
  Droplet,
  Info
} from 'lucide-react';

interface GlassTransparencyControlProps {
  compact?: boolean;
  onClose?: () => void;
}

export const GlassTransparencyControl: React.FC<GlassTransparencyControlProps> = ({
  compact = false,
  onClose,
}) => {
  const {
    theme,
    themeId,
    setThemeId,
    transparencyIntensity,
    setTransparencyIntensity,
    glassPreset,
    setGlassPreset,
    isGlassTheme,
  } = useTheme();

  const isFloating = themeId === 'floating_glass';
  const isLiquid = themeId === 'glassmorphism';

  // Calculate optical descriptors
  const getIntensityLabel = (val: number) => {
    if (val <= 30) return 'Subtle Frost (High Opacity)';
    if (val <= 60) return 'Balanced (Standard Frosted)';
    if (val <= 85) return 'Clear Glass (Deep Liquid)';
    return 'Ultra Clear (Pure Crystal)';
  };

  return (
    <div
      style={{
        borderRadius: '1.5rem',
      }}
      className={`relative overflow-hidden transition-all ${
        compact
          ? 'p-4 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl'
          : 'p-4 sm:p-5 border border-black/5 bg-white/50 backdrop-blur-md rounded-2xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div
            style={{
              backgroundColor: isGlassTheme ? theme.colors.accentLight : 'rgba(0,0,0,0.05)',
              color: isGlassTheme ? theme.colors.accent : '#71717A',
            }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          >
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                style={{ color: theme.colors.textPrimary, fontFamily: theme.typography.fontSans }}
                className="text-xs sm:text-sm font-bold tracking-tight"
              >
                Glass Transparency Intensity
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                {transparencyIntensity}%
              </span>
            </div>
            {!compact && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Customize acrylic transparency, refraction depth & frosted blur for both glass themes
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setTransparencyIntensity(50)}
            title="Reset to Balanced default (50%)"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-black/5 rounded-full cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {compact && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl text-zinc-600 hover:bg-black/5 cursor-pointer transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Non-glass theme warning / switcher banner */}
      {!isGlassTheme && (
        <div className="mt-3 p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Switch to a glass theme to see real-time transparency updates:</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setThemeId('floating_glass')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors shadow-2xs"
            >
              Floating Glass
            </button>
            <button
              type="button"
              onClick={() => setThemeId('glassmorphism')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-blue-900 border border-blue-200 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              Liquid Glass
            </button>
          </div>
        </div>
      )}

      {/* Target Glass Theme Switcher Pill Selector (Flexible toggle for both glass themes) */}
      <div className="mt-3.5 flex items-center justify-between gap-2 bg-zinc-100/70 p-1 rounded-xl border border-black/5">
        <button
          type="button"
          onClick={() => setThemeId('floating_glass')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            isFloating
              ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Floating Glass</span>
          {isFloating && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
        </button>
        <button
          type="button"
          onClick={() => setThemeId('glassmorphism')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            isLiquid
              ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Liquid Glass</span>
          {isLiquid && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 mb-1.5">
          <span>Quick Presets</span>
          <span className="font-normal text-zinc-400 capitalize">{getIntensityLabel(transparencyIntensity)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {GLASS_PRESETS.map((preset) => {
            const isPresetActive = glassPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                id={`glass-preset-${preset.id}`}
                onClick={() => {
                  setGlassPreset(preset.id as GlassIntensityPreset);
                  if (!isGlassTheme) {
                    setThemeId('floating_glass');
                  }
                }}
                className={`px-2.5 py-2 rounded-lg text-left border text-xs cursor-pointer transition-all ${
                  isPresetActive
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold ring-2 ring-blue-500/20'
                    : 'border-black/5 bg-white/70 hover:bg-white text-zinc-700 font-medium'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold truncate">{preset.label}</span>
                  {isPresetActive && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 font-poppins tabular-nums font-medium">
                  {preset.intensity}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flexible Continuous Range Slider */}
      <div className="mt-4 pt-3 border-t border-black/5">
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className="text-zinc-600 flex items-center gap-1.5">
            <Droplet className="w-3.5 h-3.5 text-blue-600" />
            Continuous Opacity / Translucency
          </span>
          <span className="font-poppins tabular-nums text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
            {transparencyIntensity}%
          </span>
        </div>

        <div className="relative flex items-center">
          <input
            id="glass-transparency-slider"
            type="range"
            min={10}
            max={95}
            step={1}
            value={transparencyIntensity}
            onChange={(e) => {
              setTransparencyIntensity(Number(e.target.value));
              if (!isGlassTheme) {
                setThemeId('floating_glass');
              }
            }}
            className="w-full h-2 bg-gradient-to-r from-zinc-300 via-blue-200 to-blue-500 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-poppins tabular-nums mt-1.5 px-0.5">
          <span>10% (Opaque Frost)</span>
          <span>50% (Balanced)</span>
          <span>95% (Crystal Pure)</span>
        </div>
      </div>

      {/* Real-time Glass Optical Simulation Preview Card */}
      <div className="mt-3.5 p-3 rounded-xl overflow-hidden relative border border-black/5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-inner">
        <div className="relative z-10 flex items-center justify-between gap-3">
          {/* Simulated frosted card sitting over the vivid background */}
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderLight,
              backdropFilter: `blur(${Math.round(14 + (transparencyIntensity / 100) * 20)}px)`,
              WebkitBackdropFilter: `blur(${Math.round(14 + (transparencyIntensity / 100) * 20)}px)`,
              borderRadius: isFloating ? '9999px' : '14px',
            }}
            className="p-2.5 px-4 border shadow-lg flex items-center gap-2.5 transition-all duration-150"
          >
            <Eye className="w-4 h-4 text-zinc-800 shrink-0" />
            <div>
              <div className="text-[11px] font-bold text-zinc-900 leading-tight">
                Live Glass Optical Preview
              </div>
              <div className="text-[9px] text-zinc-600 font-medium">
                {isFloating ? 'Floating Glass' : 'Liquid Glass'} • {transparencyIntensity}% Translucency
              </div>
            </div>
          </div>

          <div className="text-right text-white drop-shadow-sm shrink-0">
            <span className="text-[10px] font-bold block uppercase tracking-wider opacity-90">
              Refraction
            </span>
            <span className="text-xs font-poppins tabular-nums font-bold">
              ~{Math.round(14 + (transparencyIntensity / 100) * 20)}px Blur
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
