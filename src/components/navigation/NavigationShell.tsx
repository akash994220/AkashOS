import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation, MainSection, WorkspaceSection } from '../../context/NavigationContext';
import { PWAInstallButton } from '../PWAInstallButton';
import { WorkspaceView } from '../workspace/WorkspaceView';
import { SettingsView } from '../settings/SettingsView';
import { GlassTransparencyControl } from '../theme/GlassTransparencyControl';
import { BottomCapsuleNavigation } from './BottomCapsuleNavigation';
import { GlobalOmniSearchModal } from './GlobalOmniSearchModal';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { 
  Briefcase,
  Settings as SettingsIcon, 
  ShieldCheck, 
  LogOut, 
  Palette,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Clapperboard,
  Wallet,
  Layers,
  Search,
  Plus,
  X,
  Command,
  ChevronRight,
  Sliders,
  Droplet,
  WifiOff,
  Network
} from 'lucide-react';

export type { MainSection };

const getSectionDisplayName = (section: MainSection, wPage: string): string => {
  if (section === 'workspace' && wPage !== 'hub') {
    if (wPage === 'daily_tasks') return 'Tasks';
    if (wPage === 'work_threads') return 'Work Threads';
    if (wPage === 'ideas_notes') return 'Ideas & Notes';
    if (wPage === 'content') return 'Content Creation';
    if (wPage === 'idea_tree') return 'Idea Tree';
    if (wPage === 'financial') return 'Financial Management';
    if (wPage === 'vault') return 'Secret Vault';
  }
  switch (section) {
    case 'workspace': return 'Workspace';
    case 'settings': return 'Settings';
    default: return section;
  }
};

export const NavigationShell: React.FC = () => {
  const { 
    theme, 
    themeId, 
    setThemeId, 
    availableThemes,
    transparencyIntensity,
    setTransparencyIntensity: _setTransparencyIntensity,
    setGlassPreset,
    isGlassTheme
  } = useTheme();
  const { user, signOut } = useAuth();
  const { 
    activeSection, 
    setActiveSection, 
    canGoBack, 
    goBack, 
    backLabel, 
    workspacePage,
    setWorkspacePage,
    openWorkspaceApp
  } = useNavigation();

  // Floating & overlay interaction states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTransparencyModalOpen, setIsTransparencyModalOpen] = useState(false);
  const { isOnline } = useNetworkStatus();

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cycle through all available themes cleanly
  const cycleTheme = () => {
    const currentIndex = availableThemes.findIndex((t) => t.id === themeId);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    setThemeId(availableThemes[nextIndex].id);
  };

  // Bottom capsule navigation items (only Workspace tab for now)
  const navItems = [
    { id: 'workspace' as const, label: 'Workspace', icon: Briefcase },
  ];

  // Workspace sub-apps for desktop sidebar & quick search jump
  const workspaceAppsList: { id: WorkspaceSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'daily_tasks', label: 'Tasks', icon: CheckCircle2 },
    { id: 'work_threads', label: 'Work Threads', icon: GitBranch },
    { id: 'ideas_notes', label: 'Ideas & Notes', icon: Lightbulb },
    { id: 'content', label: 'Content Studio', icon: Clapperboard },
    { id: 'idea_tree', label: 'Idea Tree', icon: Network },
    { id: 'financial', label: 'Financial Hub', icon: Wallet },
    { id: 'vault', label: 'Secret Vault', icon: ShieldCheck },
  ];

  return (
    <div
      style={{
        backgroundColor: theme.isGlass ? 'transparent' : theme.colors.bgPrimary,
        color: theme.colors.textPrimary,
        minHeight: '100vh',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)',
      }}
      className="relative flex flex-col md:flex-row md:!pb-0 overflow-x-hidden"
    >
      {/* DESKTOP SIDEBAR */}
      <aside
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRight: `1px solid ${theme.colors.borderLight}`,
          width: '240px',
        }}
        className="hidden md:flex flex-col shrink-0 min-h-screen sticky top-0 relative z-10"
      >
        {/* Brand Header */}
        <div
          style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, padding: theme.spacing.lg }}
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => {
            setActiveSection('workspace');
            setWorkspacePage('hub');
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              width: '32px',
              height: '32px',
            }}
            className="flex items-center justify-center font-bold text-sm shadow-sm"
          >
            A
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: theme.colors.textPrimary }}>
              AkashOS
            </h2>
            <p className="text-[10px] text-zinc-400 font-medium">Personal Productivity & Studio OS</p>
          </div>
        </div>

        {/* Primary Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}-desktop`}
                  onClick={() => {
                    setActiveSection(item.id);
                    if (item.id === 'workspace') {
                      setWorkspacePage('hub');
                    }
                  }}
                  style={{
                    minHeight: '40px',
                    borderRadius: theme.radius.md,
                    backgroundColor: isActive ? theme.colors.accentLight : 'transparent',
                    color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                    fontWeight: isActive ? '600' : '400',
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-zinc-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop Workspace Apps Sub-Menu */}
          <div className="pt-4 mt-3 border-t border-zinc-100 space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Workspace Apps</span>
            </div>
            {workspaceAppsList.map((app) => {
              const isAppActive = activeSection === 'workspace' && workspacePage === app.id;
              const AppIcon = app.icon;
              return (
                <button
                  key={app.id}
                  id={`sidebar-app-${app.id}`}
                  onClick={() => openWorkspaceApp(app.id)}
                  style={{
                    minHeight: '34px',
                    borderRadius: theme.radius.md,
                    backgroundColor: isAppActive ? theme.colors.bgSecondary : 'transparent',
                    color: isAppActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                    fontWeight: isAppActive ? '600' : '400',
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 cursor-pointer"
                >
                  <AppIcon className={`w-3.5 h-3.5 ${isAppActive ? 'text-blue-600' : 'text-zinc-400'}`} />
                  <span className="truncate">{app.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Desktop Sidebar Footer */}
        <div
          style={{ borderTop: `1px solid ${theme.colors.borderLight}`, padding: theme.spacing.md }}
          className="space-y-3"
        >
          <button
            onClick={cycleTheme}
            className="w-full flex items-center justify-between text-[11px] p-2 rounded-lg border border-black/5 hover:border-black/10 bg-zinc-100/60 hover:bg-zinc-200/70 cursor-pointer transition-all"
            title="Click to cycle theme"
          >
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <Palette className="w-3.5 h-3.5 text-zinc-600" />
              <span className="capitalize">{theme.name}</span>
            </span>
            <span className="font-poppins text-[9px] px-1.5 py-0.5 rounded-full bg-white/90 text-zinc-700 font-bold shadow-2xs">
              Cycle
            </span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-zinc-600 truncate max-w-[110px]">
              {user?.email || 'Guest User'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveSection('settings')}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Settings & Appearance"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => signOut()}
                className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Header Bar */}
        <header
          style={{
            backgroundColor: theme.colors.bgCard,
            borderBottom: `1px solid ${theme.colors.borderLight}`,
            height: '56px',
            padding: `0 ${theme.spacing.lg}`,
          }}
          className="flex items-center justify-between sticky top-0 z-30 shadow-xs"
        >
          {/* Back Button & Mobile Title / Desktop Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            {canGoBack && (
              <button
                id="header-back-button"
                onClick={goBack}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.md,
                  borderColor: theme.colors.borderLight,
                  minHeight: '34px',
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border hover:bg-zinc-200/80 transition-all cursor-pointer shadow-2xs mr-1 shrink-0 group active:scale-95"
                title={`Go back to ${backLabel}`}
                aria-label={`Go back to ${backLabel}`}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-900 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sm:hidden">Back</span>
              </button>
            )}

            <div className="md:hidden flex items-center gap-2 min-w-0">
              {!canGoBack && (
                <div
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.sm,
                    width: '24px',
                    height: '24px',
                  }}
                  className="flex items-center justify-center font-bold text-xs shrink-0"
                >
                  A
                </div>
              )}
              <span className="text-sm font-bold truncate max-w-[130px] xs:max-w-[180px]" style={{ color: theme.colors.textPrimary }}>
                {getSectionDisplayName(activeSection, workspacePage)}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 truncate">
              <span className="font-semibold text-zinc-600">AkashOS</span>
              <span>/</span>
              <span
                onClick={() => {
                  if (activeSection === 'workspace' && workspacePage !== 'hub') {
                    setWorkspacePage('hub');
                  }
                }}
                className={`capitalize ${activeSection === 'workspace' && workspacePage !== 'hub' ? 'text-zinc-500 hover:text-zinc-800 cursor-pointer' : 'font-semibold text-zinc-800'}`}
              >
                {activeSection}
              </span>
              {activeSection === 'workspace' && workspacePage !== 'hub' && (
                <>
                  <span>/</span>
                  <span className="font-bold text-zinc-900">
                    {getSectionDisplayName('workspace', workspacePage)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Offline Syncing Indicator */}
            {!isOnline && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/30 text-[10px] font-bold shrink-0 animate-pulse"
                title="Working offline: changes will sync automatically to cloud when connection returns"
              >
                <WifiOff className="w-3 h-3 text-amber-700" />
                <span className="hidden xs:inline">Offline Mode</span>
              </div>
            )}

            {/* Quick Theme Switcher */}
            <button
              id="theme-quick-toggle-btn"
              onClick={cycleTheme}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100/90 hover:bg-zinc-200/90 cursor-pointer transition-colors text-zinc-700 shrink-0 border border-black/5 active:scale-95 min-h-[32px]"
              title={`Cycle Theme (Current: ${theme.name})`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline text-zinc-500 font-normal">Theme:</span>
              <span className="text-[11px] sm:text-xs font-bold text-zinc-900">
                {theme.name}
              </span>
            </button>

            {/* Quick Glass Transparency Toggle (for both glass themes) */}
            <button
              id="glass-transparency-quick-btn"
              onClick={() => setIsTransparencyModalOpen(true)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors shrink-0 border active:scale-95 min-h-[32px] ${
                isGlassTheme
                  ? 'bg-blue-50/90 text-blue-800 border-blue-200/80 hover:bg-blue-100/90'
                  : 'bg-zinc-100/90 text-zinc-600 border-black/5 hover:bg-zinc-200/90'
              }`}
              title={`Glass Transparency Intensity (${transparencyIntensity}%)`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline text-zinc-500 font-normal">Glass:</span>
              <span className="text-[11px] sm:text-xs font-bold">
                {transparencyIntensity}%
              </span>
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Mobile Settings & Sign Out */}
            <button
              onClick={() => setActiveSection('settings')}
              className="md:hidden p-1.5 rounded-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => signOut()}
              className="md:hidden p-1.5 rounded-full text-zinc-500 hover:text-red-600 hover:bg-zinc-100 min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* View Component Render */}
        <main className="flex-1 overflow-x-hidden">
          {activeSection === 'workspace' && <WorkspaceView />}
          {activeSection === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* MOBILE FLOATING GLASS NAVIGATION CAPSULE (4 Configured Workspace Tabs + Settings) */}
      <div className="md:hidden">
        <BottomCapsuleNavigation />
      </div>

      {/* GLOBAL OMNI-SEARCH & COMMAND PALETTE (CMD+K / CTRL+K) */}
      <GlobalOmniSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* QUICK GLASS TRANSPARENCY MODAL */}
      {isTransparencyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Glass Transparency Intensity Settings"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-950/65 backdrop-blur-md"
          onClick={() => setIsTransparencyModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-3xl overflow-hidden shadow-2xl"
          >
            <GlassTransparencyControl
              compact={true}
              onClose={() => setIsTransparencyModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

