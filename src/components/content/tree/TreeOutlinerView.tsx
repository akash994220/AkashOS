import React, { useState, useMemo } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { ContentTreeNode, TreeNodeType, TreeNodeStatus, PostedPlatform, ContentCategory } from '../../../types/content';
import { getFriendlyTierLabel } from './treeUtils';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Edit3, 
  Send,
  Check,
  Sparkles,
  FileText,
  AlignLeft,
  Edit2
} from 'lucide-react';

interface TreeOutlinerViewProps {
  nodes: ContentTreeNode[];
  categories: ContentCategory[];
  selectedNodeId: string | null;
  newlyCreatedNodeId?: string | null;
  onClearNewlyCreatedNodeId?: () => void;
  onSelectNode: (nodeId: string) => void;
  onOpenNodeDetails?: (nodeId: string) => void;
  onAddChildNode: (parentId: string, type: TreeNodeType) => void;
  onAddSiblingNode: (referenceNodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onUpdateNodeNotes?: (nodeId: string, notes: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onQuickHarvest: (node: ContentTreeNode) => Promise<void>;
}

export const TreeOutlinerView: React.FC<TreeOutlinerViewProps> = ({
  nodes,
  categories,
  selectedNodeId,
  newlyCreatedNodeId,
  onClearNewlyCreatedNodeId,
  onSelectNode,
  onOpenNodeDetails,
  onAddChildNode,
  onAddSiblingNode,
  onToggleCollapse,
  onUpdateNodeTitle,
  onUpdateNodeNotes,
  onDeleteNode,
  onQuickHarvest,
}) => {
  const { theme } = useTheme();

  // Active inline editing id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [harvestingNodeId, setHarvestingNodeId] = useState<string | null>(null);
  const [harvestSuccessNodeId, setHarvestSuccessNodeId] = useState<string | null>(null);

  // Automatically start inline editing when a new branch is created
  React.useEffect(() => {
    if (newlyCreatedNodeId) {
      setEditingId(newlyCreatedNodeId);
      const found = nodes.find((n) => n.id === newlyCreatedNodeId);
      setEditTitle(found?.title || '');
      if (onClearNewlyCreatedNodeId) {
        onClearNewlyCreatedNodeId();
      }
    }
  }, [newlyCreatedNodeId, nodes, onClearNewlyCreatedNodeId]);

  // Build nested hierarchy tree
  const childMap = useMemo(() => {
    const map = new Map<string, ContentTreeNode[]>();
    nodes.forEach((n) => {
      if (n.parentId) {
        const list = map.get(n.parentId) || [];
        list.push(n);
        map.set(n.parentId, list);
      }
    });
    // Sort by order
    map.forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [nodes]);

  const rootNode = useMemo(() => {
    return nodes.find((n) => n.parentId === null) || nodes[0];
  }, [nodes]);

  const handleStartEdit = (node: ContentTreeNode) => {
    setEditingId(node.id);
    setEditTitle(node.title);
  };

  const handleFinishEdit = (nodeId: string) => {
    if (editTitle.trim()) {
      onUpdateNodeTitle(nodeId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleTriggerQuickHarvest = async (e: React.MouseEvent, node: ContentTreeNode) => {
    e.stopPropagation();
    setHarvestingNodeId(node.id);
    try {
      await onQuickHarvest(node);
      setHarvestSuccessNodeId(node.id);
      setTimeout(() => setHarvestSuccessNodeId(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setHarvestingNodeId(null);
    }
  };

  const getPlatformChip = (platform?: PostedPlatform | 'all') => {
    switch (platform) {
      case 'youtube':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">🔴 YouTube</span>;
      case 'tiktok':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">📱 TikTok</span>;
      case 'instagram':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">📸 Instagram</span>;
      case 'facebook':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">📘 Facebook</span>;
      default:
        return null;
    }
  };

  const renderNodeRow = (node: ContentTreeNode, depth = 0) => {
    const isSelected = selectedNodeId === node.id;
    const children = childMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = Boolean(node.isCollapsed);
    const tierInfo = getFriendlyTierLabel(depth, node.type);
    const isHarvesting = harvestingNodeId === node.id;
    const isHarvestSuccess = harvestSuccessNodeId === node.id;

    return (
      <div key={node.id} className="flex flex-col">
        {/* Node Line Item */}
        <div
          onClick={() => onSelectNode(node.id)}
          style={{ paddingLeft: `${Math.max(depth * 28 + 12, 12)}px` }}
          className={`group flex items-center justify-between py-2.5 pr-4 rounded-xl border transition-all cursor-pointer ${
            isSelected
              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold shadow-2xs'
              : 'hover:bg-zinc-50 border-zinc-100 text-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
            {/* Collapse / Expand Caret */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-5 text-center text-zinc-300 font-bold">•</span>
            )}

            {/* Tier Badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${tierInfo.color}`}>
              <span>{tierInfo.emoji}</span>
              <span className="hidden sm:inline">{tierInfo.label}</span>
            </span>

            {/* Title & Description / Inline Input */}
            <div className="flex-1 min-w-0">
              {editingId === node.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleFinishEdit(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishEdit(node.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 text-xs font-semibold bg-white border border-indigo-400 rounded-lg outline-hidden text-zinc-900"
                />
              ) : (
                <div>
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(node);
                    }}
                    className="text-xs font-bold text-zinc-900 truncate block cursor-text"
                    title="Double-click to rename"
                  >
                    {node.title || 'Untitled Idea'}
                  </span>

                  {/* Inline Description / Notes */}
                  {editingNotesId === node.id ? (
                    <div onClick={(e) => e.stopPropagation()} className="mt-1">
                      <input
                        autoFocus
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        onBlur={() => {
                          if (onUpdateNodeNotes) onUpdateNodeNotes(node.id, editNotes.trim());
                          setEditingNotesId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (onUpdateNodeNotes) onUpdateNodeNotes(node.id, editNotes.trim());
                            setEditingNotesId(null);
                          }
                          if (e.key === 'Escape') setEditingNotesId(null);
                        }}
                        placeholder="Add description..."
                        className="w-full px-2 py-0.5 text-[11px] bg-amber-50/80 border border-amber-300 rounded text-zinc-800 outline-hidden"
                      />
                    </div>
                  ) : node.notes && node.notes.trim() ? (
                    <p
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNotesId(node.id);
                        setEditNotes(node.notes || '');
                      }}
                      className="text-[11px] text-zinc-500 line-clamp-1 hover:text-zinc-800 cursor-text mt-0.5"
                      title="Click to edit description"
                    >
                      {node.notes}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Platform Tag */}
            {getPlatformChip(node.platform)}

            {/* Child count hint */}
            {hasChildren && isCollapsed && (
              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-1.5 py-0.5 rounded-full">
                +{children.length} sub-ideas
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Send to studio button */}
            {isHarvestSuccess || node.status === 'harvested' ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Sent</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={isHarvesting}
                onClick={(e) => handleTriggerQuickHarvest(e, node)}
                className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                title="Send directly to Content Studio pipeline"
              >
                <Send className="w-2.5 h-2.5" />
                <span>{isHarvesting ? 'Sending...' : 'Send to Studio'}</span>
              </button>
            )}

            {/* Open details/notes button */}
            {onOpenNodeDetails && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNodeDetails(node.id);
                }}
                className="p-1 px-1.5 rounded-lg bg-zinc-100 hover:bg-indigo-50 text-zinc-600 hover:text-indigo-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Add script notes, tags, and detailed outline"
              >
                <FileText className="w-3 h-3" />
                <span className="hidden md:inline">Info</span>
              </button>
            )}

            {/* Add child branch */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const childType: TreeNodeType =
                  node.type === 'root' ? 'trunk' : node.type === 'trunk' ? 'branch' : 'leaf';
                onAddChildNode(node.id, childType);
              }}
              className="p-1 px-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Add sub-idea"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden md:inline">Branch</span>
            </button>

            {node.parentId !== null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this idea and its sub-ideas?')) {
                    onDeleteNode(node.id);
                  }
                }}
                className="p-1 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Children Render if not collapsed */}
        {!isCollapsed && hasChildren && (
          <div className="space-y-1 mt-1">
            {children.map((child) => renderNodeRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!rootNode) {
    return (
      <div className="p-8 text-center text-zinc-400 text-xs">
        No ideas found.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: theme.colors.borderLight,
      }}
      className="p-4 sm:p-6 border rounded-2xl space-y-3 min-h-[500px]"
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 text-xs text-zinc-500">
        <span className="font-bold text-zinc-800">Visual Idea Outline</span>
        <span className="text-[11px] text-zinc-400">Click to view details • Double-click to rename • Click Branch to grow</span>
      </div>

      <div className="space-y-1">
        {renderNodeRow(rootNode, 0)}
      </div>
    </div>
  );
};
