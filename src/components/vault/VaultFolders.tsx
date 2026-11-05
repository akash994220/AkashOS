import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { VaultFolder } from '../../types/vault';
import { Folder, ChevronRight, Plus, FolderPlus, X, Trash2 } from 'lucide-react';

interface VaultFoldersProps {
  section: 'credentials' | 'bank_cards' | 'custom';
  folders: VaultFolder[];
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
}

export const VaultFolders: React.FC<VaultFoldersProps> = ({
  section,
  folders,
  currentFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
}) => {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  // Compute breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Root' }];
    if (!currentFolderId) return crumbs;

    let curr = folders.find((f) => f.id === currentFolderId);
    const path: { id: string; name: string }[] = [];
    while (curr) {
      path.unshift({ id: curr.id, name: curr.folder_name });
      curr = curr.parent_folder_id ? folders.find((f) => f.id === curr?.parent_folder_id) : undefined;
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();
  // Child folders of current folder
  const currentChildFolders = folders.filter((f) => f.parent_folder_id === currentFolderId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      await onCreateFolder(newFolderName.trim(), currentFolderId);
      setNewFolderName('');
      setShowModal(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation Bar */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.lg,
          border: `1px solid ${theme.colors.borderLight}`,
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
        }}
        className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shadow-2xs"
      >
        <div className="flex items-center gap-1.5 text-xs py-1">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id || 'root'}>
                <button
                  type="button"
                  onClick={() => onSelectFolder(crumb.id)}
                  style={{
                    color: isLast ? theme.colors.textPrimary : theme.colors.textMuted,
                    fontWeight: isLast ? '600' : '400',
                  }}
                  className="hover:underline cursor-pointer flex items-center gap-1"
                >
                  {idx === 0 && <Folder className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{crumb.name}</span>
                </button>
                {!isLast && <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderRadius: theme.radius.full,
            minHeight: '32px',
          }}
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200 cursor-pointer font-medium shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>{currentFolderId ? 'New Sub-Group' : 'New Folder'}</span>
        </button>
      </div>

      {/* Child Folders Horizontal Pills / List */}
      {currentChildFolders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {currentChildFolders.map((child) => (
            <div
              key={child.id}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderLight}`,
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:border-zinc-400 cursor-pointer transition-colors shrink-0 group"
              onClick={() => onSelectFolder(child.id)}
            >
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium text-zinc-800">{child.folder_name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete folder "${child.folder_name}"?`)) {
                    onDeleteFolder(child.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 text-zinc-400 transition-opacity"
                title="Delete folder"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Folder Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.lg,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '360px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                {currentFolderId ? 'Create Sub-Group' : 'Create Vault Folder'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-zinc-100"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Work, Personal, Social..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs rounded border hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newFolderName.trim()}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '38px',
                  }}
                  className="px-4 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
