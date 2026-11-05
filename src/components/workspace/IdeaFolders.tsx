import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { IdeaFolder } from '../../types/workspace';
import { 
  Plus, 
  X, 
  Trash2, 
  Edit3, 
  Inbox, 
  Sparkles, 
  Layers, 
  Check, 
  ChevronRight,
  FolderOpen
} from 'lucide-react';

export const APP_COLOR_PALETTES: Record<string, { bg: string; text: string; light: string; border: string; label: string }> = {
  indigo: { bg: '#4F46E5', text: '#3730A3', light: '#EEF2FF', border: '#C7D2FE', label: 'Indigo' },
  emerald: { bg: '#059669', text: '#065F46', light: '#ECFDF5', border: '#A7F3D0', label: 'Emerald' },
  amber: { bg: '#D97706', text: '#92400E', light: '#FFFBEB', border: '#FDE68A', label: 'Amber' },
  rose: { bg: '#E11D48', text: '#9F1239', light: '#FFF1F2', border: '#FECDD3', label: 'Rose' },
  violet: { bg: '#7C3AED', text: '#5B21B6', light: '#F5F3FF', border: '#DDD6FE', label: 'Violet' },
  cyan: { bg: '#0891B2', text: '#155E75', light: '#ECFEFF', border: '#A5F3FC', label: 'Cyan' },
  slate: { bg: '#475569', text: '#1E293B', light: '#F1F5F9', border: '#CBD5E1', label: 'Slate' },
};

export const APP_ICON_OPTIONS = [
  { icon: '💡', label: 'Idea / Lightbulb' },
  { icon: '⚡', label: 'Architecture / Tech' },
  { icon: '🚀', label: 'Project / Launch' },
  { icon: '🎨', label: 'Design / Creative' },
  { icon: '📚', label: 'Research / Books' },
  { icon: '📝', label: 'Drafts / Journal' },
  { icon: '💼', label: 'Work / Business' },
  { icon: '🎯', label: 'Goals / Focus' },
  { icon: '🛠️', label: 'Tools / Systems' },
  { icon: '🧠', label: 'Brainstorm / Strategy' },
  { icon: '📊', label: 'Analytics / Metrics' },
  { icon: '🌐', label: 'Web / Resources' },
];

interface IdeaFoldersProps {
  folders: IdeaFolder[];
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, icon?: string, color?: string, description?: string) => Promise<void>;
  onUpdateFolder?: (folderId: string, updates: Partial<IdeaFolder>) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  unfiledCount?: number;
  totalNotesCount?: number;
  notesCountByFolder?: Record<string, number>;
}

export const IdeaFolders: React.FC<IdeaFoldersProps> = ({
  folders,
  currentFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  unfiledCount = 0,
  totalNotesCount = 0,
  notesCountByFolder = {},
}) => {
  const { theme } = useTheme();

  // Modal State for Create / Edit App Space
  const [showModal, setShowModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [appIcon, setAppIcon] = useState('💡');
  const [appColor, setAppColor] = useState('indigo');
  const [appDescription, setAppDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active App data (if an app is selected)
  const activeApp = currentFolderId
    ? folders.find((f) => (f.folder_id || f.id) === currentFolderId)
    : null;

  const openCreateModal = () => {
    setEditingFolderId(null);
    setAppName('');
    setAppIcon('💡');
    setAppColor('indigo');
    setAppDescription('');
    setShowModal(true);
  };

  const openEditModal = (folder: IdeaFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFolderId(folder.folder_id || folder.id || null);
    setAppName(folder.folder_name || '');
    setAppIcon(folder.icon || '💡');
    setAppColor(folder.color || 'indigo');
    setAppDescription(folder.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingFolderId && onUpdateFolder) {
        await onUpdateFolder(editingFolderId, {
          folder_name: appName.trim(),
          icon: appIcon,
          color: appColor,
          description: appDescription.trim(),
        });
      } else {
        await onCreateFolder(appName.trim(), appIcon, appColor, appDescription.trim());
      }
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save app space:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPalette = APP_COLOR_PALETTES[appColor] || APP_COLOR_PALETTES.indigo;

  return (
    <div className="space-y-3">
      {/* SECTION TITLE & APP SHELF HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
            Workspace Note Apps & Spaces
          </span>
          <span className="text-[11px] px-2 py-0.2 rounded-full bg-zinc-100 text-zinc-600 font-semibold">
            {folders.length + 1} Apps
          </span>
        </div>

        <button
          type="button"
          id="new-workspace-app-btn"
          onClick={openCreateModal}
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderRadius: theme.radius.md,
            minHeight: '32px',
          }}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-zinc-600" />
          <span>New App Space</span>
        </button>
      </div>

      {/* INTERACTIVE APPS GRID / DOCK SHELF */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {/* 1. Primary "All Notes" App Tile */}
        <div
          id="app-tile-all"
          onClick={() => onSelectFolder(null)}
          style={{
            backgroundColor: currentFolderId === null ? '#F8FAFC' : theme.colors.bgCard,
            borderColor: currentFolderId === null ? theme.colors.accent : theme.colors.borderLight,
            borderRadius: theme.radius.lg,
            borderWidth: currentFolderId === null ? '2px' : '1px',
          }}
          className={`p-3 transition-all cursor-pointer shadow-xs hover:border-zinc-400 group relative flex flex-col justify-between select-none ${
            currentFolderId === null ? 'ring-2 ring-zinc-900/5' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div
              style={{
                backgroundColor: currentFolderId === null ? '#1E293B' : '#F1F5F9',
                color: currentFolderId === null ? '#FFFFFF' : '#475569',
                borderRadius: theme.radius.md,
              }}
              className="w-8 h-8 flex items-center justify-center text-sm font-bold shadow-2xs group-hover:scale-105 transition-transform shrink-0"
            >
              <Layers className="w-4 h-4" />
            </div>

            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {totalNotesCount}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-zinc-900 truncate">
              All Notes
            </h4>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
              Entire collection
            </p>
          </div>

          {currentFolderId === null && (
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </div>

        {/* 2. Inbox / Scratchpad App Tile */}
        <div
          id="app-tile-inbox"
          onClick={() => onSelectFolder('__inbox__')}
          style={{
            backgroundColor: currentFolderId === '__inbox__' ? '#F8FAFC' : theme.colors.bgCard,
            borderColor: currentFolderId === '__inbox__' ? theme.colors.accent : theme.colors.borderLight,
            borderRadius: theme.radius.lg,
            borderWidth: currentFolderId === '__inbox__' ? '2px' : '1px',
          }}
          className={`p-3 transition-all cursor-pointer shadow-xs hover:border-zinc-400 group relative flex flex-col justify-between select-none ${
            currentFolderId === '__inbox__' ? 'ring-2 ring-zinc-900/5' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div
              style={{
                backgroundColor: currentFolderId === '__inbox__' ? '#1E293B' : '#F1F5F9',
                color: currentFolderId === '__inbox__' ? '#FFFFFF' : '#475569',
                borderRadius: theme.radius.md,
              }}
              className="w-8 h-8 flex items-center justify-center text-sm font-bold shadow-2xs group-hover:scale-105 transition-transform shrink-0"
            >
              <Inbox className="w-4 h-4" />
            </div>

            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {unfiledCount}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-zinc-900 truncate">
              Inbox / Unfiled
            </h4>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
              Quick scratchpad
            </p>
          </div>

          {currentFolderId === '__inbox__' && (
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </div>

        {/* 2. Custom Workspace App Tiles */}
        {folders.map((folder) => {
          const folderId = folder.folder_id || folder.id || '';
          const isSelected = currentFolderId === folderId;
          const palette = APP_COLOR_PALETTES[folder.color || 'indigo'] || APP_COLOR_PALETTES.indigo;
          const noteCount = notesCountByFolder[folderId] || 0;
          const displayIcon = folder.icon || '💡';

          return (
            <div
              key={folderId}
              id={`app-tile-${folderId}`}
              onClick={() => onSelectFolder(folderId)}
              style={{
                backgroundColor: isSelected ? palette.light : theme.colors.bgCard,
                borderColor: isSelected ? palette.bg : theme.colors.borderLight,
                borderRadius: theme.radius.lg,
                borderWidth: isSelected ? '2px' : '1px',
              }}
              className={`p-3 transition-all cursor-pointer shadow-xs hover:border-zinc-400 group relative flex flex-col justify-between select-none ${
                isSelected ? 'ring-2 ring-zinc-900/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div
                  style={{
                    backgroundColor: palette.light,
                    borderColor: palette.border,
                    borderRadius: theme.radius.md,
                  }}
                  className="w-8 h-8 border flex items-center justify-center text-base shadow-2xs group-hover:scale-105 transition-transform shrink-0"
                >
                  <span>{displayIcon}</span>
                </div>

                {/* Pill count & Quick actions */}
                <div className="flex items-center gap-1">
                  <span
                    style={{
                      backgroundColor: palette.light,
                      color: palette.text,
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-zinc-200/50"
                  >
                    {noteCount}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => openEditModal(folder, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-900 text-zinc-400 transition-opacity rounded hover:bg-black/5"
                    title="Edit App Space"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-900 truncate">
                  {folder.folder_name}
                </h4>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                  {folder.description || `${noteCount} notes stored`}
                </p>
              </div>

              {isSelected && (
                <div
                  style={{ backgroundColor: palette.bg }}
                  className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                />
              )}
            </div>
          );
        })}

        {/* 3. Add App Card */}
        <button
          type="button"
          onClick={openCreateModal}
          style={{
            borderRadius: theme.radius.lg,
            border: `1px dashed ${theme.colors.borderLight}`,
            backgroundColor: 'transparent',
          }}
          className="p-3 flex flex-col items-center justify-center text-center gap-1 hover:border-zinc-400 hover:bg-zinc-50/50 transition-all cursor-pointer min-h-[92px] group"
        >
          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-800 transition-colors">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-600 group-hover:text-zinc-900">
            Create App
          </span>
        </button>
      </div>

      {/* ACTIVE APP BANNER & CONTROLS (when inside a custom app) */}
      {activeApp && (() => {
        const palette = APP_COLOR_PALETTES[activeApp.color || 'indigo'] || APP_COLOR_PALETTES.indigo;
        const count = notesCountByFolder[activeApp.folder_id || activeApp.id || ''] || 0;
        return (
          <div
            style={{
              backgroundColor: palette.light,
              borderColor: palette.border,
              borderRadius: theme.radius.md,
            }}
            className="p-2.5 sm:p-3 border flex items-center justify-between gap-3 shadow-2xs transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: palette.border,
                  borderRadius: theme.radius.md,
                }}
                className="w-9 h-9 border flex items-center justify-center text-lg shadow-2xs shrink-0"
              >
                <span>{activeApp.icon || '💡'}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold truncate text-zinc-900">
                    {activeApp.folder_name}
                  </h3>
                  <span
                    style={{ backgroundColor: palette.bg, color: '#FFFFFF' }}
                    className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
                  >
                    Active App
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                  {activeApp.description || `Viewing ${count} ${count === 1 ? 'note' : 'notes'} inside this workspace app`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(activeApp)}
                className="p-1.5 text-xs text-zinc-600 hover:text-zinc-900 bg-white/80 hover:bg-white rounded border border-zinc-200/60 transition-colors cursor-pointer flex items-center gap-1 font-medium shadow-2xs"
                title="Edit App Details"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete App "${activeApp.folder_name}"? Notes inside will become unfiled inbox items.`)) {
                    onDeleteFolder(activeApp.folder_id || activeApp.id || '');
                  }
                }}
                className="p-1.5 text-xs text-red-600 hover:text-red-700 bg-white/80 hover:bg-white rounded border border-zinc-200/60 transition-colors cursor-pointer flex items-center gap-1 font-medium shadow-2xs"
                title="Delete App"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onSelectFolder(null)}
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentText,
                  borderRadius: theme.radius.sm,
                }}
                className="px-2.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>View All</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* CREATE / EDIT APP SPACE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.lg,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '440px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-600" />
                <h3 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                  {editingFolderId ? 'Edit Workspace App' : 'Create New Workspace App'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* LIVE PREVIEW CARD */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Interactive App Preview
              </label>
              <div
                style={{
                  backgroundColor: selectedPalette.light,
                  borderColor: selectedPalette.border,
                  borderRadius: theme.radius.md,
                }}
                className="p-3 border flex items-center gap-3 shadow-2xs"
              >
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: selectedPalette.border,
                    borderRadius: theme.radius.md,
                  }}
                  className="w-10 h-10 border flex items-center justify-center text-xl shadow-2xs shrink-0"
                >
                  <span>{appIcon}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-900 truncate">
                    {appName.trim() || 'App Space Name'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {appDescription.trim() || 'Workspace collection for quick notes'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* App Name */}
              <div>
                <label className="text-xs font-semibold block mb-1 text-zinc-700">
                  App Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Architecture & Tech, Content Pipeline, Books..."
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '40px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none text-zinc-900"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold block mb-1 text-zinc-700">
                  App Icon
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {APP_ICON_OPTIONS.map((item) => {
                    const isSelected = appIcon === item.icon;
                    return (
                      <button
                        key={item.icon}
                        type="button"
                        onClick={() => setAppIcon(item.icon)}
                        style={{
                          backgroundColor: isSelected ? selectedPalette.light : theme.colors.bgSecondary,
                          borderColor: isSelected ? selectedPalette.bg : 'transparent',
                          borderRadius: theme.radius.md,
                        }}
                        className={`h-9 border text-base flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${
                          isSelected ? 'ring-2 ring-zinc-900/10' : ''
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Palette Picker */}
              <div>
                <label className="text-xs font-semibold block mb-1 text-zinc-700">
                  Color Theme
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(APP_COLOR_PALETTES).map(([key, palette]) => {
                    const isSelected = appColor === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAppColor(key)}
                        style={{
                          backgroundColor: palette.bg,
                          borderRadius: theme.radius.full,
                        }}
                        className={`w-7 h-7 flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-110 shadow-2xs ${
                          isSelected ? 'ring-2 ring-offset-2 ring-zinc-800' : ''
                        }`}
                        title={palette.label}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="text-xs font-semibold block mb-1 text-zinc-700">
                  Description / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. System diagrams, sprint ideas, and research snippets"
                  value={appDescription}
                  onChange={(e) => setAppDescription(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '40px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none text-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ minHeight: '36px' }}
                  className="px-3.5 py-1.5 text-xs rounded border hover:bg-zinc-50 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !appName.trim()}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '36px',
                  }}
                  className="px-4 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingFolderId
                    ? 'Save Changes'
                    : 'Create App Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
