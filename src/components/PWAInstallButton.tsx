import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../theme/ThemeContext';
import { Download, Share, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { theme } = useTheme();

  // If already running as standalone, don't display
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        style={{
          backgroundColor: theme.colors.accent,
          color: theme.colors.accentText,
          borderRadius: theme.radius.full,
          padding: '4px 10px',
          boxShadow: theme.shadows.sm,
          minHeight: '32px',
        }}
        className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90 active:scale-95 shrink-0"
        title="Install App (PWA)"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          style={{
            backgroundColor: theme.colors.bgSecondary,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.full,
            border: `1px solid ${theme.colors.borderLight}`,
            padding: '4px 10px',
            minHeight: '32px',
          }}
          className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors shrink-0"
          title="Install PWA on iOS"
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.lg,
                boxShadow: theme.shadows.lg,
                padding: theme.spacing.lg,
                maxWidth: '360px',
                width: '100%',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm" style={{ color: theme.colors.textPrimary }}>
                  Install on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full hover:bg-zinc-100"
                  style={{ color: theme.colors.textMuted }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: theme.colors.textSecondary }}>
                1. Tap the <strong>Share</strong> button in your Safari navigation bar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.md,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  minHeight: '44px',
                }}
                className="w-full text-xs font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
