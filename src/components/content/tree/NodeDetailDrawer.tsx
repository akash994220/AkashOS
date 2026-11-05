import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { ContentTreeNode, TreeNodeType, TreeNodeStatus, PostedPlatform, ContentFormat, ContentCategory } from '../../../types/content';
import { getFriendlyTierLabel } from './treeUtils';
import { 
  X, 
  Trash2, 
  Plus, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Video, 
  Smartphone, 
  Layers, 
  ExternalLink,
  ChevronRight,
  FolderOpen
} from 'lucide-react';

interface NodeDetailDrawerProps {
  node: ContentTreeNode | null;
  allCategories: ContentCategory[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<ContentTreeNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddChildNode: (parentId: string, type: TreeNodeType) => void;
  onHarvestToStudio: (node: ContentTreeNode, categoryId: string) => Promise<void>;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  allCategories,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onAddChildNode,
  onHarvestToStudio,
}) => {
  const { theme } = useTheme();

  // Local draft state for smooth typing
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<TreeNodeType>('branch');
  const [platform, setPlatform] = useState<PostedPlatform | 'all' | undefined>('all');
  const [format, setFormat] = useState<ContentFormat>('long_form');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestSuccess, setHarvestSuccess] = useState(false);

  // Sync state when selected node changes
  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setNotes(node.notes || '');
      setType(node.type || 'branch');
      setPlatform(node.platform || 'all');
      setFormat(node.format || (node.platform === 'tiktok' ? 'short_form' : 'long_form'));
      setHarvestSuccess(false);
    }
  }, [node?.id]);

  useEffect(() => {
    if (allCategories.length > 0 && !selectedCatId) {
      setSelectedCatId(allCategories[0].id);
    }
  }, [allCategories, selectedCatId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!node) return null;

  const handleTitleBlur = () => {
    if (title.trim() && title !== node.title) {
      onUpdateNode(node.id, { title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== node.notes) {
      onUpdateNode(node.id, { notes });
    }
  };

  const handlePlatformChange = (newPlatform: PostedPlatform | 'all') => {
    setPlatform(newPlatform);
    const newFormat: ContentFormat = newPlatform === 'tiktok' ? 'short_form' : format;
    setFormat(newFormat);
    onUpdateNode(node.id, { platform: newPlatform, format: newFormat });
  };

  const handleTriggerHarvest = async () => {
    const catToUse = selectedCatId || (allCategories[0]?.id ?? 'uncategorized');
    setIsHarvesting(true);
    try {
      await onHarvestToStudio(
        {
          ...node,
          title,
          notes,
          platform,
          format,
        },
        catToUse
      );
      setHarvestSuccess(true);
      setTimeout(() => setHarvestSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsHarvesting(false);
    }
  };

  const tierInfo = getFriendlyTierLabel(0, type);

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs sm:hidden animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Drawer / Bottom Sheet Container */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: theme.colors.borderLight,
        }}
        className="fixed inset-x-0 bottom-0 top-auto max-h-[88vh] sm:top-20 sm:bottom-4 sm:right-4 sm:left-auto sm:w-[390px] z-50 flex flex-col rounded-t-3xl sm:rounded-2xl border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right-4 duration-200"
      >
        {/* Mobile Drag Pill */}
        <div className="pt-2.5 pb-0.5 sm:hidden flex justify-center bg-zinc-50/80">
          <div className="w-12 h-1.5 bg-zinc-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900">Idea Details</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tierInfo.color}`}>
              {tierInfo.emoji} {tierInfo.label}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200/50 cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
            title="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-zinc-600 block">
            Idea Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="e.g. 3 Mistakes Beginners Make..."
            className="w-full px-3 py-2 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Platform Selection */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-zinc-600 block">
            Target Platform
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'all' as const, label: '💡 General Idea' },
              { id: 'youtube' as const, label: '🔴 YouTube' },
              { id: 'tiktok' as const, label: '📱 TikTok / Shorts' },
              { id: 'instagram' as const, label: '📸 Instagram' },
              { id: 'facebook' as const, label: '📘 Facebook' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePlatformChange(p.id)}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg text-left border cursor-pointer transition-all ${
                  (platform || 'all') === p.id
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Script Notes / Outline */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-zinc-600 block">
            Notes, Bullet Points & Outline
          </label>
          <textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Write key talking points, opening hook, or research links..."
            className="w-full p-2.5 text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 resize-none font-sans"
          />
        </div>

        {/* 1-Click Send to Studio */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Send to Content Studio</span>
            </span>
            {harvestSuccess && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Added to Pipeline!</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-zinc-500">
            Convert this idea into a production item in your content calendar.
          </p>

          <div className="space-y-1.5">
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-semibold text-zinc-800 bg-white border border-indigo-200 rounded-lg cursor-pointer"
            >
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  📁 {c.name}
                </option>
              ))}
              {allCategories.length === 0 && (
                <option value="uncategorized">Default (Uncategorized)</option>
              )}
            </select>

            <button
              type="button"
              disabled={isHarvesting || !title.trim()}
              onClick={handleTriggerHarvest}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>{isHarvesting ? 'Sending...' : 'Put in Production Calendar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
        {node.parentId !== null ? (
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this idea and its sub-branches?')) {
                onDeleteNode(node.id);
                onClose();
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        ) : (
          <span className="text-[10px] text-zinc-400">Main topic</span>
        )}

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
    </>
  );
};
