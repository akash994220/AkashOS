import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../theme/ThemeContext';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { 
  ContentTree, 
  ContentTreeNode, 
  TreeNodeType, 
  TreeNodeStatus, 
  PostedPlatform,
  ContentCategory, 
  ContentItem, 
  ContentFormat 
} from '../../../types/content';
import { 
  createStarterTemplate, 
  exportTreeToMarkdown,
  exportTreeToJSON,
  duplicateSubtree,
  parseTreeFromJSON
} from './treeUtils';
import { TreeCanvasView } from './TreeCanvasView';
import { TreeOutlinerView } from './TreeOutlinerView';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import { TreeFileManagerModal } from './TreeFileManagerModal';
import { 
  FolderTree, 
  Plus, 
  LayoutList, 
  Network, 
  Download, 
  Share2, 
  Trash2, 
  Edit3, 
  Copy, 
  Sparkles, 
  Check, 
  ChevronDown, 
  Info, 
  RefreshCw, 
  HelpCircle, 
  X, 
  HardDrive, 
  Wand2, 
  Upload,
  Feather
} from 'lucide-react';

interface ContentTreeStudioProps {
  categories: ContentCategory[];
  onOpenContentItem?: (itemId: string) => void;
  onRefreshAll?: () => void;
}

export const ContentTreeStudio: React.FC<ContentTreeStudioProps> = ({
  categories,
  onOpenContentItem,
  onRefreshAll,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Trees State
  const [trees, setTrees] = useState<ContentTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // View Mode: Canvas (Mind Map) vs. Planning (Zen / No Clutter) vs. Outliner (Nested List)
  const [viewMode, setViewMode] = useState<'canvas' | 'planning' | 'outline'>('canvas');

  // Node Selection State (for highlighting/focus)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Explicit Info/Detail Drawer (ONLY opened when user explicitly clicks "Info")
  const [infoDrawerNodeId, setInfoDrawerNodeId] = useState<string | null>(null);

  // Track newly created node to autofocus inline title editing on the card
  const [newlyCreatedNodeId, setNewlyCreatedNodeId] = useState<string | null>(null);

  // Modals & Popups
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isNewTreeModalOpen, setIsNewTreeModalOpen] = useState(false);
  const [newTreeTitle, setNewTreeTitle] = useState('');
  const [newTreeTemplate, setNewTreeTemplate] = useState<'multi_platform' | 'youtube_waterfall' | 'blank'>('multi_platform');

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [copiedMd, setCopiedMd] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);
  const [showExplainer, setShowExplainer] = useState(true);

  // 1. Real-time subscription to user's content_trees
  useEffect(() => {
    if (!user || !db) return;

    const q = query(collection(db, 'content_trees'), where('owner_uid', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ContentTree[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            owner_uid: data.owner_uid,
            title: data.title || 'Untitled Idea Tree',
            description: data.description || '',
            category_id: data.category_id,
            nodes: data.nodes || [],
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
          };
        });

        // Sort by updated_at descending
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setTrees(list);

        // Auto-select first tree if none selected
        if (list.length > 0 && (!activeTreeId || !list.some((t) => t.id === activeTreeId))) {
          setActiveTreeId(list[0].id);
        }

        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'content_trees');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeTreeId]);

  // Current active tree
  const activeTree = useMemo(() => {
    return trees.find((t) => t.id === activeTreeId) || null;
  }, [trees, activeTreeId]);

  // Selected Node (for highlighting)
  const selectedNode = useMemo(() => {
    if (!activeTree || !selectedNodeId) return null;
    return activeTree.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeTree, selectedNodeId]);

  // Detail Node (for the information popup/drawer only)
  const detailNode = useMemo(() => {
    if (!activeTree || !infoDrawerNodeId) return null;
    return activeTree.nodes.find((n) => n.id === infoDrawerNodeId) || null;
  }, [activeTree, infoDrawerNodeId]);

  // Debounced background sync refs to avoid UI freezing
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNodesRef = useRef<{ treeId: string; nodes: ContentTreeNode[]; updatedAt: string } | null>(null);

  const saveToFirestore = useCallback(async (treeId: string, nodesToSave: ContentTreeNode[], updatedAt: string) => {
    if (!user) return;
    setSavingNotice(true);
    try {
      const treeRef = doc(db, 'content_trees', treeId);
      await updateDoc(treeRef, {
        nodes: nodesToSave,
        updated_at: updatedAt,
      });
    } catch (err) {
      console.error('Firestore save error:', err);
    } finally {
      setTimeout(() => setSavingNotice(false), 400);
    }
  }, [user]);

  // Helper to persist tree modifications with INSTANT optimistic UI updates (0ms lag)
  const updateTreeNodes = useCallback((updatedNodes: ContentTreeNode[], immediate = false) => {
    if (!user || !activeTree) return;
    const now = new Date().toISOString();

    // 1. Instant optimistic update in React memory (0ms lag, butter-smooth)
    setTrees((prev) =>
      prev.map((t) =>
        t.id === activeTree.id
          ? { ...t, nodes: updatedNodes, updated_at: now }
          : t
      )
    );

    // 2. Clear previous debounce timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    pendingNodesRef.current = { treeId: activeTree.id, nodes: updatedNodes, updatedAt: now };

    if (immediate) {
      saveToFirestore(activeTree.id, updatedNodes, now);
      pendingNodesRef.current = null;
    } else {
      // Debounce saving by 350ms so rapid node drags / keystrokes feel 100% fluid without spamming network
      saveTimerRef.current = setTimeout(() => {
        if (pendingNodesRef.current) {
          saveToFirestore(
            pendingNodesRef.current.treeId,
            pendingNodesRef.current.nodes,
            pendingNodesRef.current.updatedAt
          );
          pendingNodesRef.current = null;
        }
      }, 350);
    }
  }, [user, activeTree, saveToFirestore]);

  // Node Actions
  const handleUpdateNode = (nodeId: string, updates: Partial<ContentTreeNode>) => {
    if (!activeTree) return;
    const now = new Date().toISOString();
    const updated = activeTree.nodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, ...updates, updatedAt: now };
      }
      return n;
    });
    updateTreeNodes(updated);
  };

  const handleUpdateNodeTitle = (nodeId: string, title: string) => {
    handleUpdateNode(nodeId, { title });
  };

  const handleUpdateNodePlatform = (nodeId: string, platform: PostedPlatform | 'all') => {
    const format: ContentFormat = platform === 'tiktok' ? 'short_form' : 'long_form';
    handleUpdateNode(nodeId, { platform, format });
  };

  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    handleUpdateNode(nodeId, { x, y });
  };

  const handleUpdateNodeColor = (nodeId: string, color: string) => {
    handleUpdateNode(nodeId, { color });
  };

  const handleAddChildNode = (parentId: string, type: TreeNodeType) => {
    if (!activeTree) return;
    const now = new Date().toISOString();
    const newNodeId = `node_${Date.now()}`;
    const parentNode = activeTree.nodes.find((n) => n.id === parentId);

    const defaultTitle =
      type === 'trunk'
        ? 'New Angle or Chapter'
        : type === 'branch'
        ? 'Video or Post Idea'
        : 'Opening Hook or Note';

    // 1. Calculate parent's current coordinates
    const parentX = parentNode?.x ?? 60;
    const parentY = parentNode?.y ?? 60;

    // 2. Position by the right side of the summoning branch
    // 250px (node width) + 80px (horizontal spacing) = 330px
    const childX = parentX + 330;

    // 3. Find existing sibling children of this parent
    const existingSiblings = activeTree.nodes.filter((n) => n.parentId === parentId);
    let childY: number;

    if (existingSiblings.length === 0) {
      // First child: summon directly level with the parent branch!
      childY = parentY;
    } else {
      // Sibling children already exist: summon neatly right below the lowest sibling
      const maxSiblingY = Math.max(
        ...existingSiblings.map((s) => (s.y !== undefined ? s.y : parentY))
      );
      childY = maxSiblingY + 128; // 100px node height + 28px vertical spacing
    }

    const newNode: ContentTreeNode = {
      id: newNodeId,
      parentId,
      title: defaultTitle,
      type,
      platform: parentNode?.platform || 'all',
      format: parentNode?.format || (type === 'leaf' ? 'short_form' : 'long_form'),
      status: 'seed',
      x: childX,
      y: childY,
      order: existingSiblings.length,
      createdAt: now,
      updatedAt: now,
    };

    // Auto-expand parent if collapsed
    const updated = activeTree.nodes.map((n) => {
      if (n.id === parentId && n.isCollapsed) {
        return { ...n, isCollapsed: false };
      }
      return n;
    });

    updateTreeNodes([...updated, newNode], true);
    setSelectedNodeId(newNodeId);
    setNewlyCreatedNodeId(newNodeId);
    setInfoDrawerNodeId(null);
  };

  const handleAddSiblingNode = (referenceNodeId: string) => {
    if (!activeTree) return;
    const refNode = activeTree.nodes.find((n) => n.id === referenceNodeId);
    if (!refNode || refNode.parentId === null) return;
    handleAddChildNode(refNode.parentId, refNode.type);
  };

  const handleAddRootNode = (x?: number, y?: number, title?: string) => {
    if (!activeTree) return;
    const now = new Date().toISOString();
    const newRootId = `node_${Date.now()}`;
    const rootNodes = activeTree.nodes.filter((n) => n.parentId === null);
    const defaultX = x ?? 60;
    const defaultY =
      y ??
      (rootNodes.length > 0
        ? Math.max(...rootNodes.map((r) => r.y ?? 60)) + 140
        : 60);

    const newNode: ContentTreeNode = {
      id: newRootId,
      parentId: null,
      title: title || 'New Idea',
      type: 'root',
      status: 'seed',
      x: defaultX,
      y: defaultY,
      order: rootNodes.length,
      createdAt: now,
      updatedAt: now,
    };
    updateTreeNodes([...activeTree.nodes, newNode], true);
    setSelectedNodeId(newRootId);
    setNewlyCreatedNodeId(newRootId);
    setInfoDrawerNodeId(null);
  };

  const handleDuplicateSubtree = (nodeId: string) => {
    if (!activeTree) return;
    const updated = duplicateSubtree(activeTree.nodes, nodeId);
    updateTreeNodes(updated);
  };

  const handleAutoTidy = () => {
    if (!activeTree) return;
    // Clearing custom x and y coordinates makes computeTreeLayout re-align all nodes neatly
    const cleaned = activeTree.nodes.map((n) => {
      const { x, y, ...rest } = n;
      return rest as ContentTreeNode;
    });
    updateTreeNodes(cleaned);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeTree) return;
    // Recursively collect all descendant node IDs to delete
    const toDelete = new Set<string>([nodeId]);
    let added = true;
    while (added) {
      added = false;
      activeTree.nodes.forEach((n) => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }

    const updated = activeTree.nodes.filter((n) => !toDelete.has(n.id));
    updateTreeNodes(updated);
    if (selectedNodeId && toDelete.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  const handleToggleCollapse = (nodeId: string) => {
    if (!activeTree) return;
    const updated = activeTree.nodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, isCollapsed: !n.isCollapsed };
      }
      return n;
    });
    updateTreeNodes(updated);
  };

  const handleCollapseAll = () => {
    if (!activeTree) return;
    // Find all nodes that are parents
    const parentIds = new Set(activeTree.nodes.filter((n) => n.parentId).map((n) => n.parentId!));
    const updated = activeTree.nodes.map((n) => {
      if (parentIds.has(n.id)) {
        return { ...n, isCollapsed: true };
      }
      return n;
    });
    updateTreeNodes(updated);
  };

  const handleExpandAll = () => {
    if (!activeTree) return;
    const updated = activeTree.nodes.map((n) => {
      if (n.isCollapsed) {
        return { ...n, isCollapsed: false };
      }
      return n;
    });
    updateTreeNodes(updated);
  };

  // 1-Click Quick Harvest to Content Studio
  const handleQuickHarvest = async (node: ContentTreeNode) => {
    if (!user) return;
    const defaultCatId = categories[0]?.id || 'uncategorized';
    const docId = `item_tree_${Date.now()}`;
    const payload: ContentItem = {
      id: docId,
      owner_uid: user.uid,
      category_id: defaultCatId,
      format: node.format || (node.platform === 'tiktok' ? 'short_form' : 'long_form'),
      title: node.title,
      script_text: node.notes || '',
      tags: [node.type, ...(node.platform && node.platform !== 'all' ? [node.platform] : [])],
      raw_tags: node.platform || '',
      custom_data: [],
      status: 'draft',
      posted_to: node.platform && node.platform !== 'all' ? [node.platform] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'content_items', docId), payload);
      handleUpdateNode(node.id, { status: 'harvested' });
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_items/${docId}`);
      throw err;
    }
  };

  // Harvest with selected Category
  const handleHarvestToStudio = async (node: ContentTreeNode, categoryId: string) => {
    if (!user) return;
    const docId = `item_tree_${Date.now()}`;
    const payload: ContentItem = {
      id: docId,
      owner_uid: user.uid,
      category_id: categoryId || categories[0]?.id || 'uncategorized',
      format: node.format || (node.platform === 'tiktok' ? 'short_form' : 'long_form'),
      title: node.title,
      script_text: node.notes || '',
      tags: [node.type, ...(node.platform && node.platform !== 'all' ? [node.platform] : [])],
      raw_tags: node.platform || '',
      custom_data: [],
      status: 'draft',
      posted_to: node.platform && node.platform !== 'all' ? [node.platform] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'content_items', docId), payload);
      handleUpdateNode(node.id, { status: 'harvested' });
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_items/${docId}`);
      throw err;
    }
  };

  // Create New Tree Handler
  const handleCreateNewTree = async () => {
    if (!user || !newTreeTitle.trim()) return;
    const newTree = createStarterTemplate(
      newTreeTemplate,
      newTreeTitle.trim(),
      user.uid,
      categories[0]?.id
    );

    try {
      await setDoc(doc(db, 'content_trees', newTree.id), newTree);
      setActiveTreeId(newTree.id);
      setIsNewTreeModalOpen(false);
      setNewTreeTitle('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_trees/${newTree.id}`);
    }
  };

  // Duplicate an entire tree file
  const handleDuplicateTreeFile = async (treeToClone: ContentTree) => {
    if (!user) return;
    const newTreeId = `tree_${Date.now()}`;
    const cloned: ContentTree = {
      ...treeToClone,
      id: newTreeId,
      title: `${treeToClone.title} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'content_trees', newTreeId), cloned);
      setActiveTreeId(newTreeId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_trees/${newTreeId}`);
    }
  };

  // Import JSON tree
  const handleImportTree = async (importedTree: ContentTree) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'content_trees', importedTree.id), importedTree);
      setActiveTreeId(importedTree.id);
      setIsFileManagerOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_trees/${importedTree.id}`);
    }
  };

  // Rename Tree Handler
  const handleRenameTree = async () => {
    if (!user || !activeTree || !renameValue.trim()) return;
    try {
      await updateDoc(doc(db, 'content_trees', activeTree.id), {
        title: renameValue.trim(),
        updated_at: new Date().toISOString(),
      });
      setIsRenameModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `content_trees/${activeTree.id}`);
    }
  };

  // Delete Tree Handler
  const handleDeleteTree = async (treeIdToDelete?: string, titlePrompt?: string) => {
    if (!user) return;
    const targetId = treeIdToDelete || activeTree?.id;
    if (!targetId) return;
    const title = titlePrompt || activeTree?.title || 'Idea Tree';

    if (confirm(`Delete the tree "${title}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'content_trees', targetId));
        if (targetId === activeTreeId) {
          setActiveTreeId(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `content_trees/${targetId}`);
      }
    }
  };

  // Download JSON file
  const handleDownloadJSON = (tree: ContentTree) => {
    const jsonStr = exportTreeToJSON(tree);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (tree.title || 'idea_tree')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  // Copy Markdown Outline
  const handleCopyMarkdown = () => {
    if (!activeTree) return;
    const md = exportTreeToMarkdown(activeTree);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
        <span className="text-xs font-semibold">Loading Idea Trees...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Friendly How It Works Banner */}
      {showExplainer && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 shadow-2xs relative">
          <button
            onClick={() => setShowExplainer(false)}
            className="absolute right-3 top-3 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                Flexible Idea Tree & Mind Mapping
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                ✨ <span className="font-semibold text-zinc-900">Movable Canvas:</span> Drag cards freely anywhere, pan, and zoom. <br className="hidden sm:inline" />
                🖱️ <span className="font-semibold text-zinc-900">Right-Click Menus:</span> Right-click any card to branch, rename, color-code, or duplicate. <br className="hidden sm:inline" />
                💾 <span className="font-semibold text-zinc-900">Tree Files Vault:</span> Auto-saved to cloud + download and import offline <span className="font-mono text-zinc-800">.json</span> files anytime!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tree Selector & Mode Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
        {/* Left: Tree Dropdown & Renaming */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeTreeId || ''}
                onChange={(e) => {
                  setActiveTreeId(e.target.value);
                  setSelectedNodeId(null);
                }}
                className="font-bold text-xs sm:text-sm text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl px-3 py-1.5 pr-8 appearance-none cursor-pointer focus:outline-hidden"
              >
                {trees.map((t) => (
                  <option key={t.id} value={t.id}>
                    🌳 {t.title} ({t.nodes.length} branches)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {activeTree && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRenameValue(activeTree.title);
                    setIsRenameModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 cursor-pointer"
                  title="Rename tree"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteTree()}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Delete tree"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tree Files Vault Button */}
          <button
            type="button"
            onClick={() => setIsFileManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
            title="Manage all tree files, export/import JSON, and backups"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Files Vault ({trees.length})</span>
          </button>

          {savingNotice ? (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" />
              <span>Saving...</span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
              Cloud Synced
            </span>
          )}
        </div>

        {/* Right: View Switcher & Action Buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          {/* View Mode Switcher: Studio Map vs. Zen Planning vs. Outliner */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                viewMode === 'canvas'
                  ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Studio Map (Interactive diagram with platform icons and workflow metadata)"
            >
              <Network className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Studio Map</span>
              <span className="sm:hidden">Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('planning')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                viewMode === 'planning'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Zen Planning Mode (Pure Title + Description notes only, no clutter)"
            >
              <Feather className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zen Planning</span>
              <span className="sm:hidden">Planning</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('outline')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                viewMode === 'outline'
                  ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Hierarchical list outliner"
            >
              <LayoutList className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">List Outline</span>
              <span className="sm:hidden">List</span>
            </button>
          </div>

          {/* Quick Save JSON Button */}
          {activeTree && (
            <button
              type="button"
              onClick={() => handleDownloadJSON(activeTree)}
              className="p-1.5 px-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Save & Download tree as a .json file"
            >
              {downloadSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">JSON</span>
            </button>
          )}

          {/* Export Outline Button */}
          {activeTree && (
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="p-1.5 px-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Copy outline as text"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Copy Text</span>
            </button>
          )}

          {/* New Tree Button */}
          <button
            type="button"
            onClick={() => {
              setNewTreeTitle('');
              setNewTreeTemplate('multi_platform');
              setIsNewTreeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Tree</span>
          </button>
        </div>
      </div>

      {/* Main Canvas or Outline View */}
      {activeTree ? (
        <div className="relative">
          {viewMode === 'canvas' || viewMode === 'planning' ? (
            <TreeCanvasView
              nodes={activeTree.nodes}
              categories={categories}
              selectedNodeId={selectedNodeId}
              newlyCreatedNodeId={newlyCreatedNodeId}
              isPlanningMode={viewMode === 'planning'}
              onTogglePlanningMode={() => setViewMode(viewMode === 'planning' ? 'canvas' : 'planning')}
              onClearNewlyCreatedNodeId={() => setNewlyCreatedNodeId(null)}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              onOpenNodeDetails={(nodeId) => setInfoDrawerNodeId(nodeId)}
              onAddChildNode={handleAddChildNode}
              onAddSiblingNode={handleAddSiblingNode}
              onToggleCollapse={handleToggleCollapse}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
              onUpdateNodeTitle={handleUpdateNodeTitle}
              onUpdateNodeNotes={(nodeId, notes) => handleUpdateNode(nodeId, { notes })}
              onUpdateNodePlatform={handleUpdateNodePlatform}
              onUpdateNodePosition={handleUpdateNodePosition}
              onUpdateNodeColor={handleUpdateNodeColor}
              onDuplicateSubtree={handleDuplicateSubtree}
              onDeleteNode={handleDeleteNode}
              onQuickHarvest={handleQuickHarvest}
              onAutoTidy={handleAutoTidy}
              onAddRootNode={handleAddRootNode}
              onOpenFileManager={() => setIsFileManagerOpen(true)}
              onQuickSaveJSON={() => activeTree && handleDownloadJSON(activeTree)}
              onQuickCopyMarkdown={handleCopyMarkdown}
            />
          ) : (
            <TreeOutlinerView
              nodes={activeTree.nodes}
              categories={categories}
              selectedNodeId={selectedNodeId}
              newlyCreatedNodeId={newlyCreatedNodeId}
              onClearNewlyCreatedNodeId={() => setNewlyCreatedNodeId(null)}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              onOpenNodeDetails={(nodeId) => setInfoDrawerNodeId(nodeId)}
              onAddChildNode={handleAddChildNode}
              onAddSiblingNode={handleAddSiblingNode}
              onToggleCollapse={handleToggleCollapse}
              onUpdateNodeTitle={handleUpdateNodeTitle}
              onUpdateNodeNotes={(nodeId, notes) => handleUpdateNode(nodeId, { notes })}
              onDeleteNode={handleDeleteNode}
              onQuickHarvest={handleQuickHarvest}
            />
          )}

          {/* Floating Details Drawer (ONLY open when user explicitly clicks "Info" / "More Information") */}
          {detailNode && (
            <NodeDetailDrawer
              node={detailNode}
              allCategories={categories}
              onClose={() => setInfoDrawerNodeId(null)}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onAddChildNode={handleAddChildNode}
              onHarvestToStudio={handleHarvestToStudio}
            />
          )}
        </div>
      ) : (
        <div className="p-12 text-center border border-zinc-200 rounded-2xl bg-white space-y-3">
          <FolderTree className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-800">No Idea Trees Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Plant a new idea tree to brainstorm pillar topics, break them into multi-platform branches, and export them into production.
          </p>
          <button
            type="button"
            onClick={() => setIsNewTreeModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-sm hover:bg-slate-800"
          >
            Create Your First Tree
          </button>
        </div>
      )}

      {/* TREE FILE VAULT & SAVE MANAGER MODAL */}
      <TreeFileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        trees={trees}
        activeTreeId={activeTreeId}
        onSelectTree={(treeId) => setActiveTreeId(treeId)}
        onCreateNewTree={() => setIsNewTreeModalOpen(true)}
        onDuplicateTree={handleDuplicateTreeFile}
        onDeleteTree={handleDeleteTree}
        onImportTree={handleImportTree}
      />

      {/* CREATE NEW TREE MODAL */}
      {isNewTreeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <FolderTree className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-zinc-900">New Idea Tree</h3>
              </div>
              <button
                onClick={() => setIsNewTreeModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 block">
                  Main Topic or Question
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newTreeTitle}
                  onChange={(e) => setNewTreeTitle(e.target.value)}
                  placeholder="e.g. How to Automate YouTube Content in 2026"
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Starter Templates Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 block">
                  Starting Architecture
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'multi_platform' as const,
                      title: '🎬 Multi-Platform Repurposing',
                      desc: '1 Main Video → 2 Angles → YouTube, TikTok, and Instagram posts.',
                    },
                    {
                      id: 'youtube_waterfall' as const,
                      title: '📺 Long Video to Shorts Waterfall',
                      desc: 'Cornerstone long-form video broken down into chapter shorts.',
                    },
                    {
                      id: 'blank' as const,
                      title: '🌱 Clean Blank Canvas',
                      desc: 'Starts with 1 idea node and lets you branch out freely.',
                    },
                  ].map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => setNewTreeTemplate(tpl.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        newTreeTemplate === tpl.id
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <span className="text-xs font-bold text-zinc-900 block">{tpl.title}</span>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">{tpl.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsNewTreeModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTreeTitle.trim()}
                onClick={handleCreateNewTree}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Create Tree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME TREE MODAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95">
            <h3 className="text-xs font-bold text-zinc-900">Rename Idea Tree</h3>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameTree()}
              className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!renameValue.trim()}
                onClick={handleRenameTree}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
