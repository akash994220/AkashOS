import React, { useMemo } from 'react';
import { useNavigation, WorkspaceSection } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import {
  LayoutDashboard,
  CheckCircle2,
  GitBranch,
  Clapperboard,
  Network,
  Wallet,
  Lightbulb,
  ShieldCheck,
  Settings as SettingsIcon,
} from 'lucide-react';

export interface WorkspaceTabOption {
  id: WorkspaceSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const ALL_WORKSPACE_TAB_OPTIONS: WorkspaceTabOption[] = [
  { id: 'hub', label: 'Workspace Hub', shortLabel: 'Hub', icon: LayoutDashboard },
  { id: 'daily_tasks', label: 'Tasks', shortLabel: 'Tasks', icon: CheckCircle2 },
  { id: 'work_threads', label: 'Work Threads', shortLabel: 'Threads', icon: GitBranch },
  { id: 'vault', label: 'Secret Vault', shortLabel: 'Vault', icon: ShieldCheck },
  { id: 'financial', label: 'Financial Hub', shortLabel: 'Finance', icon: Wallet },
  { id: 'content', label: 'Content Studio', shortLabel: 'Content', icon: Clapperboard },
  { id: 'idea_tree', label: 'Idea Tree', shortLabel: 'Idea Tree', icon: Network },
  { id: 'ideas_notes', label: 'Ideas & Notes', shortLabel: 'Notes', icon: Lightbulb },
];

export const DEFAULT_CAPSULE_TABS: WorkspaceSection[] = [
  'hub',
  'daily_tasks',
  'work_threads',
  'financial',
];

export const BottomCapsuleNavigation: React.FC = () => {
  const { theme } = useTheme();
  const { userSettings } = useAuth();
  const { activeSection, setActiveSection, workspacePage, setWorkspacePage } = useNavigation();

  // Selected 4 custom tabs from user settings or fallback to defaults
  const activeFourTabs: WorkspaceSection[] = useMemo(() => {
    const custom = userSettings?.bottom_capsule_tabs;
    if (Array.isArray(custom) && custom.length === 4) {
      return custom as WorkspaceSection[];
    }
    return DEFAULT_CAPSULE_TABS;
  }, [userSettings?.bottom_capsule_tabs]);

  const handleTabClick = (tabId: WorkspaceSection) => {
    setActiveSection('workspace');
    setWorkspacePage(tabId);
  };

  const handleSettingsClick = () => {
    setActiveSection('settings');
  };

  return (
    <div
      style={{
        bottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 10px))',
      }}
      className="fixed left-0 right-0 z-40 px-3 flex justify-center pointer-events-none select-none"
    >
      <nav
        aria-label="Workspace Capsule Navigation"
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.full,
          boxShadow: theme.shadows.lg,
          height: '56px',
          minHeight: '56px',
        }}
        className="pointer-events-auto border px-1.5 py-1 flex items-center justify-between gap-1 max-w-[460px] w-full shadow-xl backdrop-blur-2xl transition-all"
      >
        {/* The 4 User-Configured Workspace Tabs */}
        {activeFourTabs.map((tabId) => {
          const tabMeta = ALL_WORKSPACE_TAB_OPTIONS.find((t) => t.id === tabId) || {
            id: tabId,
            label: tabId,
            shortLabel: tabId,
            icon: LayoutDashboard,
          };

          const isWorkspaceActive = activeSection === 'workspace';
          const isSelected = isWorkspaceActive && workspacePage === tabId;
          const TabIcon = tabMeta.icon;

          return (
            <button
              key={tabId}
              id={`capsule-tab-${tabId}`}
              onClick={() => handleTabClick(tabId)}
              aria-label={tabMeta.label}
              title={tabMeta.label}
              className={`flex-1 h-full flex flex-col items-center justify-center rounded-full transition-all duration-200 cursor-pointer group active:scale-95 ${
                isSelected ? 'font-bold' : 'hover:bg-zinc-100/60'
              }`}
              style={{
                backgroundColor: isSelected ? theme.colors.accentLight : 'transparent',
              }}
            >
              <div className="flex flex-col items-center justify-center gap-0.5">
                <TabIcon
                  className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors duration-200"
                  style={{
                    color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                  }}
                />
                <span
                  style={{
                    color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                    fontFamily: theme.typography.fontSans,
                  }}
                  className="text-[10px] sm:text-[11px] leading-tight tracking-tight truncate max-w-[64px]"
                >
                  {tabMeta.shortLabel}
                </span>
              </div>
            </button>
          );
        })}

        {/* Separator Line */}
        <div className="w-px h-6 bg-zinc-200/80 mx-0.5 shrink-0" />

        {/* Slot 5: Settings Tab */}
        {(() => {
          const isSettingsActive = activeSection === 'settings';
          return (
            <button
              id="capsule-tab-settings"
              onClick={handleSettingsClick}
              aria-label="Settings & Tab Customization"
              title="Settings (Customize Capsule)"
              className={`flex-1 h-full flex flex-col items-center justify-center rounded-full transition-all duration-200 cursor-pointer group active:scale-95 ${
                isSettingsActive ? 'font-bold' : 'hover:bg-zinc-100/60'
              }`}
              style={{
                backgroundColor: isSettingsActive ? theme.colors.accentLight : 'transparent',
              }}
            >
              <div className="flex flex-col items-center justify-center gap-0.5">
                <SettingsIcon
                  className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors duration-200"
                  style={{
                    color: isSettingsActive ? theme.colors.accent : theme.colors.textMuted,
                  }}
                />
                <span
                  style={{
                    color: isSettingsActive ? theme.colors.accent : theme.colors.textMuted,
                    fontFamily: theme.typography.fontSans,
                  }}
                  className="text-[10px] sm:text-[11px] leading-tight tracking-tight truncate max-w-[64px]"
                >
                  Settings
                </span>
              </div>
            </button>
          );
        })()}
      </nav>
    </div>
  );
};
