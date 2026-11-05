import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { 
  ContentTreeNode, 
  TreeNodeType, 
  TreeNodeStatus, 
  PostedPlatform, 
  ContentCategory 
} from '../../../types/content';
import { 
  computeTreeLayout, 
  getCurvedConnectorPath, 
  getFriendlyTierLabel, 
  getFriendlyStatusLabel,
  LayoutNode, 
  NODE_WIDTH, 
  NODE_HEIGHT 
} from './treeUtils';
import { TreeMinimap } from './TreeMinimap';
import { 
  Plus, 
  Minus,
  ChevronRight, 
  ChevronDown, 
  ChevronsDown,
  ChevronsUp,
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2,
  Minimize2,
  Send,
  Trash2,
  Edit2,
  Check,
  FileText,
  Sparkles,
  HelpCircle,
  X,
  Palette,
  Copy,
  Layers,
  Wand2,
  GripHorizontal,
  Search,
  HardDrive,
  Download,
  Grid,
  Move,
  MoreVertical,
  Sliders,
  Feather,
  AlignLeft,
  BookOpen
} from 'lucide-react';

interface ContextMenuState {
  type: 'node' | 'canvas';
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  nodeId?: string;
}

interface TreeCanvasViewProps {
  nodes: ContentTreeNode[];
  categories: ContentCategory[];
  selectedNodeId: string | null;
  newlyCreatedNodeId?: string | null;
  isPlanningMode?: boolean;
  onTogglePlanningMode?: () => void;
  onClearNewlyCreatedNodeId?: () => void;
  onSelectNode: (nodeId: string) => void;
  onOpenNodeDetails: (nodeId: string) => void;
  onAddChildNode: (parentId: string, type: TreeNodeType) => void;
  onAddSiblingNode?: (referenceNodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onUpdateNodeNotes?: (nodeId: string, notes: string) => void;
  onUpdateNodePlatform: (nodeId: string, platform: PostedPlatform | 'all') => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onUpdateNodeColor: (nodeId: string, color: string) => void;
  onDuplicateSubtree: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onQuickHarvest: (node: ContentTreeNode) => Promise<void>;
  onAutoTidy: () => void;
  onAddRootNode: (x?: number, y?: number, title?: string) => void;
  onOpenFileManager?: () => void;
  onQuickSaveJSON?: () => void;
  onQuickCopyMarkdown?: () => void;
}

export const COLOR_PALETTE: { id: string; label: string; bg: string; border: string; ring: string }[] = [
  { id: 'default', label: 'Classic White', bg: 'bg-white', border: 'border-zinc-200', ring: 'ring-zinc-400' },
  { id: 'emerald', label: 'Fresh Green', bg: 'bg-emerald-50/90', border: 'border-emerald-300', ring: 'ring-emerald-500' },
  { id: 'indigo', label: 'Royal Indigo', bg: 'bg-indigo-50/90', border: 'border-indigo-300', ring: 'ring-indigo-500' },
  { id: 'purple', label: 'Vibrant Purple', bg: 'bg-purple-50/90', border: 'border-purple-300', ring: 'ring-purple-500' },
  { id: 'amber', label: 'Warm Amber', bg: 'bg-amber-50/90', border: 'border-amber-300', ring: 'ring-amber-500' },
  { id: 'rose', label: 'Coral Rose', bg: 'bg-rose-50/90', border: 'border-rose-300', ring: 'ring-rose-500' },
  { id: 'sky', label: 'Sky Blue', bg: 'bg-sky-50/90', border: 'border-sky-300', ring: 'ring-sky-500' },
];

export const TreeCanvasView: React.FC<TreeCanvasViewProps> = ({
  nodes,
  categories,
  selectedNodeId,
  newlyCreatedNodeId,
  isPlanningMode: initialPlanningMode = false,
  onTogglePlanningMode,
  onClearNewlyCreatedNodeId,
  onSelectNode,
  onOpenNodeDetails,
  onAddChildNode,
  onAddSiblingNode,
  onToggleCollapse,
  onCollapseAll,
  onExpandAll,
  onUpdateNodeTitle,
  onUpdateNodeNotes,
  onUpdateNodePlatform,
  onUpdateNodePosition,
  onUpdateNodeColor,
  onDuplicateSubtree,
  onDeleteNode,
  onQuickHarvest,
  onAutoTidy,
  onAddRootNode,
  onOpenFileManager,
  onQuickSaveJSON,
  onQuickCopyMarkdown,
}) => {
  const { theme } = useTheme();

  // Planning / Zen Mode state (Clean Title + Description cards only)
  const [isPlanningMode, setIsPlanningMode] = useState(initialPlanningMode);

  useEffect(() => {
    setIsPlanningMode(initialPlanningMode);
  }, [initialPlanningMode]);

  // Canvas Viewport transform: zoom & pan
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 50, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState<'dots' | 'grid' | 'clean'>('dots');

  // Right Click Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // In-place title editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // In-place description / notes editing state
  const [editingNotesNodeId, setEditingNotesNodeId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState('');

  // Luminous highlight state for newly summoned branches
  const [highlightedNewNodeId, setHighlightedNewNodeId] = useState<string | null>(null);

  // High-performance rAF throttling refs for 60fps/120fps pan & drag
  const panRafRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
  }, []);

  // Automatically start inline editing and smoothly pan to newly summoned branch
  useEffect(() => {
    if (newlyCreatedNodeId) {
      setEditingNodeId(newlyCreatedNodeId);
      setHighlightedNewNodeId(newlyCreatedNodeId);
      const found = nodes.find((n) => n.id === newlyCreatedNodeId);
      setEditingText(found?.title || '');

      // Auto-pan viewport if newly created node is offscreen or near screen edge
      if (found && containerRef.current && found.x !== undefined && found.y !== undefined) {
        const rect = containerRef.current.getBoundingClientRect();
        const screenX = found.x * zoom + pan.x;
        const screenY = found.y * zoom + pan.y;

        if (screenX > rect.width - 290 || screenX < 40 || screenY > rect.height - 180 || screenY < 40) {
          const targetPanX = Math.round(rect.width * 0.45 - found.x * zoom);
          const targetPanY = Math.round(rect.height * 0.45 - found.y * zoom);
          setPan({ x: targetPanX, y: targetPanY });
        }
      }

      const timer = setTimeout(() => {
        setHighlightedNewNodeId(null);
      }, 5000);

      if (onClearNewlyCreatedNodeId) {
        onClearNewlyCreatedNodeId();
      }

      return () => clearTimeout(timer);
    }
  }, [newlyCreatedNodeId, nodes, zoom, pan, onClearNewlyCreatedNodeId]);

  // Dragging individual node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Quick platform picker popover
  const [platformPickerNodeId, setPlatformPickerNodeId] = useState<string | null>(null);

  // Harvesting feedback state
  const [harvestingNodeId, setHarvestingNodeId] = useState<string | null>(null);
  const [harvestSuccessNodeId, setHarvestSuccessNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Layout positions
  const { layoutNodes, width: canvasWidth, height: canvasHeight } = useMemo(() => {
    return computeTreeLayout(nodes, true);
  }, [nodes]);

  // If currently dragging a node, override its layout position dynamically
  const displayedNodes = useMemo(() => {
    if (!draggingNodeId || !dragCurrentPos) return layoutNodes;
    return layoutNodes.map((n) => {
      if (n.id === draggingNodeId) {
        return {
          ...n,
          x: dragCurrentPos.x,
          y: dragCurrentPos.y,
        };
      }
      return n;
    });
  }, [layoutNodes, draggingNodeId, dragCurrentPos]);

  // Map of parent-to-children for connector lines
  const parentNodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    displayedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [displayedNodes]);

  // Connectors
  const connectors = useMemo(() => {
    const lines: { id: string; path: string; status: TreeNodeStatus }[] = [];
    displayedNodes.forEach((node) => {
      if (node.parentId && parentNodeMap.has(node.parentId)) {
        const parent = parentNodeMap.get(node.parentId)!;
        const path = getCurvedConnectorPath(parent, node);
        lines.push({
          id: `${parent.id}->${node.id}`,
          path,
          status: node.status,
        });
      }
    });
    return lines;
  }, [displayedNodes, parentNodeMap]);

  // Multi-touch gestures (Pinch zoom & 1-finger drag / pan)
  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch' | 'node_drag';
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    dragNodeId: string | null;
    dragOffset: { x: number; y: number };
    longPressTimer: any;
    hasMovedSignificantly: boolean;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPan: { x: 0, y: 0 },
    initialDist: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    dragNodeId: null,
    dragOffset: { x: 0, y: 0 },
    longPressTimer: null,
    hasMovedSignificantly: false,
  });

  const getTouchesDistance = (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Close context menu on click anywhere or on Escape
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) setContextMenu(null);
      if (platformPickerNodeId) setPlatformPickerNodeId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        if (platformPickerNodeId) setPlatformPickerNodeId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, platformPickerNodeId]);

  // Global window mousemove & mouseup listeners for seamless drag-and-drop
  useEffect(() => {
    if (!draggingNodeId) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const rawY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      const posX = Math.max(10, Math.round(rawX));
      const posY = Math.max(10, Math.round(rawY));

      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = requestAnimationFrame(() => {
        setDragCurrentPos({ x: posX, y: posY });
      });
    };

    const handleWindowMouseUp = () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      if (draggingNodeId && dragCurrentPos) {
        onUpdateNodePosition(draggingNodeId, dragCurrentPos.x, dragCurrentPos.y);
      }
      setDraggingNodeId(null);
      setDragCurrentPos(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
  }, [draggingNodeId, dragCurrentPos, dragOffset, pan, zoom, onUpdateNodePosition]);

  // Canvas Mouse Down: handles panning when clicking background
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left-click only for panning
    if (
      (e.target as HTMLElement).closest('.tree-node-card') || 
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input')
    ) {
      return;
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const nextX = e.clientX - startPan.x;
    const nextY = e.clientY - startPan.y;

    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    panRafRef.current = requestAnimationFrame(() => {
      setPan({ x: nextX, y: nextY });
    });
  };

  const handleCanvasMouseUp = () => {
    if (panRafRef.current) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // TOUCH GESTURE HANDLERS (Pinch-to-zoom, 1-finger canvas pan, long-press)
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    // 2 fingers: pinch-to-zoom
    if (e.touches.length === 2) {
      if (touchStateRef.current.longPressTimer) {
        clearTimeout(touchStateRef.current.longPressTimer);
        touchStateRef.current.longPressTimer = null;
      }
      const dist = getTouchesDistance(e.touches[0], e.touches[1]);
      touchStateRef.current = {
        ...touchStateRef.current,
        mode: 'pinch',
        initialDist: dist,
        initialZoom: zoom,
        initialPan: { ...pan },
        hasMovedSignificantly: true,
      };
      return;
    }

    // 1 finger
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = touch.target as HTMLElement;

      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('.no-drag')
      ) {
        return;
      }

      const nodeCard = target.closest('.tree-node-card') as HTMLElement;
      if (nodeCard) {
        // Node touch handled separately by handleNodeTouchStart
        return;
      }

      // Empty canvas background touch
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const touchX = touch.clientX;
      const touchY = touch.clientY;

      touchStateRef.current = {
        mode: 'pan',
        startX: touchX,
        startY: touchY,
        startPan: { ...pan },
        initialDist: 0,
        initialZoom: zoom,
        initialPan: { ...pan },
        dragNodeId: null,
        dragOffset: { x: 0, y: 0 },
        hasMovedSignificantly: false,
        longPressTimer: setTimeout(() => {
          if (!touchStateRef.current.hasMovedSignificantly) {
            if (navigator.vibrate) navigator.vibrate(40);
            const canvasX = Math.round((touchX - rect.left - pan.x) / zoom);
            const canvasY = Math.round((touchY - rect.top - pan.y) / zoom);
            setContextMenu({
              type: 'canvas',
              screenX: touchX - rect.left,
              screenY: touchY - rect.top,
              canvasX,
              canvasY,
            });
          }
        }, 500),
      };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    // 2-finger Pinch Zoom
    if (e.touches.length === 2 && touchStateRef.current.mode === 'pinch') {
      const newDist = getTouchesDistance(e.touches[0], e.touches[1]);
      if (touchStateRef.current.initialDist > 0) {
        const ratio = newDist / touchStateRef.current.initialDist;
        const targetZoom = Math.min(Math.max(touchStateRef.current.initialZoom * ratio, 0.4), 2.2);
        setZoom(Number(targetZoom.toFixed(2)));
      }
      return;
    }

    // 1-finger Move
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStateRef.current.startX;
      const deltaY = touch.clientY - touchStateRef.current.startY;

      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        touchStateRef.current.hasMovedSignificantly = true;
        if (touchStateRef.current.longPressTimer) {
          clearTimeout(touchStateRef.current.longPressTimer);
          touchStateRef.current.longPressTimer = null;
        }
      }

      if (touchStateRef.current.mode === 'pan') {
        const nextX = touchStateRef.current.startPan.x + deltaX;
        const nextY = touchStateRef.current.startPan.y + deltaY;
        if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
        panRafRef.current = requestAnimationFrame(() => {
          setPan({ x: nextX, y: nextY });
        });
      } else if (touchStateRef.current.mode === 'node_drag' && touchStateRef.current.dragNodeId) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const rawX = (touch.clientX - rect.left - pan.x) / zoom - touchStateRef.current.dragOffset.x;
        const rawY = (touch.clientY - rect.top - pan.y) / zoom - touchStateRef.current.dragOffset.y;
        const posX = Math.max(10, Math.round(rawX));
        const posY = Math.max(10, Math.round(rawY));
        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          setDragCurrentPos({ x: posX, y: posY });
        });
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    if (touchStateRef.current.longPressTimer) {
      clearTimeout(touchStateRef.current.longPressTimer);
      touchStateRef.current.longPressTimer = null;
    }

    if (touchStateRef.current.mode === 'node_drag' && touchStateRef.current.dragNodeId && dragCurrentPos) {
      onUpdateNodePosition(touchStateRef.current.dragNodeId, dragCurrentPos.x, dragCurrentPos.y);
      if (navigator.vibrate) navigator.vibrate(20);
    }

    setDraggingNodeId(null);
    setDragCurrentPos(null);
    touchStateRef.current.mode = 'none';
    touchStateRef.current.dragNodeId = null;
  };

  // Node Drag Start: Mouse
  const handleNodeMouseDown = (e: React.MouseEvent, node: LayoutNode) => {
    if (e.button !== 0) return; // Left-click only
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('.no-drag')
    ) {
      return;
    }

    e.stopPropagation();
    if (!containerRef.current) return;

    onSelectNode(node.id);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: mouseCanvasX - node.x,
      y: mouseCanvasY - node.y,
    });
    setDragCurrentPos({ x: node.x, y: node.y });
  };

  // Node Touch Start: 1-finger hold or drag with haptic long-press
  const handleNodeTouchStart = (e: React.TouchEvent, node: LayoutNode) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const target = e.target as HTMLElement;

    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('.no-drag')
    ) {
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touchCanvasX = (touch.clientX - rect.left - pan.x) / zoom;
    const touchCanvasY = (touch.clientY - rect.top - pan.y) / zoom;

    onSelectNode(node.id);

    const dragOff = {
      x: touchCanvasX - node.x,
      y: touchCanvasY - node.y,
    };

    touchStateRef.current = {
      mode: 'node_drag',
      startX: touch.clientX,
      startY: touch.clientY,
      startPan: { ...pan },
      initialDist: 0,
      initialZoom: zoom,
      initialPan: { ...pan },
      dragNodeId: node.id,
      dragOffset: dragOff,
      hasMovedSignificantly: false,
      longPressTimer: setTimeout(() => {
        if (!touchStateRef.current.hasMovedSignificantly) {
          if (navigator.vibrate) navigator.vibrate(45);
          setContextMenu({
            type: 'node',
            screenX: touch.clientX - rect.left,
            screenY: touch.clientY - rect.top,
            canvasX: Math.round(touchCanvasX),
            canvasY: Math.round(touchCanvasY),
            nodeId: node.id,
          });
        }
      }, 450),
    };

    setDraggingNodeId(node.id);
    setDragOffset(dragOff);
    setDragCurrentPos({ x: node.x, y: node.y });
  };

  // Right-click on Canvas Background
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const canvasY = Math.round((e.clientY - rect.top - pan.y) / zoom);

    setContextMenu({
      type: 'canvas',
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
      canvasX,
      canvasY,
    });
  };

  // Right-click on Node Card
  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const canvasY = Math.round((e.clientY - rect.top - pan.y) / zoom);

    onSelectNode(nodeId);
    setContextMenu({
      type: 'node',
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
      canvasX,
      canvasY,
      nodeId,
    });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 50, y: 60 });
  };

  // Center / Fit to Screen
  const handleFitScreen = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 80) / canvasWidth;
    const scaleY = (clientHeight - 80) / canvasHeight;
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.15);
    setZoom(fitScale);
    setPan({ x: 30, y: 40 });
  };

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.min(Math.max(prev + delta, 0.4), 2.0));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.8,
        y: prev.y - e.deltaY * 0.8,
      }));
    }
  };

  // Inline rename submit
  const handleSaveTitle = (nodeId: string) => {
    if (editingText.trim()) {
      onUpdateNodeTitle(nodeId, editingText.trim());
    }
    setEditingNodeId(null);
  };

  // Inline notes/description submit
  const handleSaveNotes = (nodeId: string) => {
    if (onUpdateNodeNotes) {
      onUpdateNodeNotes(nodeId, editingNotesText);
    }
    setEditingNotesNodeId(null);
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

  const platforms: { id: PostedPlatform | 'all'; label: string; icon: string; bg: string }[] = [
    { id: 'all', label: 'General Idea', icon: '💡', bg: 'bg-zinc-100 text-zinc-700' },
    { id: 'youtube', label: 'YouTube Video', icon: '🔴', bg: 'bg-rose-100 text-rose-800' },
    { id: 'tiktok', label: 'TikTok / Short', icon: '📱', bg: 'bg-sky-100 text-sky-800' },
    { id: 'instagram', label: 'Instagram Post', icon: '📸', bg: 'bg-pink-100 text-pink-800' },
    { id: 'facebook', label: 'Facebook Post', icon: '📘', bg: 'bg-blue-100 text-blue-800' },
  ];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onTouchStart={handleCanvasTouchStart}
      onTouchMove={handleCanvasTouchMove}
      onTouchEnd={handleCanvasTouchEnd}
      onTouchCancel={handleCanvasTouchEnd}
      onWheel={handleWheel}
      onContextMenu={handleCanvasContextMenu}
      style={{
        backgroundColor: '#F8FAFC',
        borderColor: theme.colors.borderLight,
        touchAction: 'none',
      }}
      className={`relative w-full overflow-hidden border rounded-2xl select-none transition-all overscroll-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[620px] sm:h-[740px]'
      } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {/* Background Grid Types */}
      {backgroundStyle === 'dots' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#94A3B8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
      )}

      {backgroundStyle === 'grid' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <pattern id="line-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94A3B8" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#line-grid)" />
        </svg>
      )}

      {/* Floating Canvas Controls Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white shadow-md border border-zinc-200/90 text-zinc-700">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="px-2 py-1 text-xs font-mono font-bold rounded-lg hover:bg-zinc-100 cursor-pointer"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleFitScreen}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-zinc-100 cursor-pointer"
          title="Fit All Ideas on Screen"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Center</span>
        </button>
        <button
          onClick={onAutoTidy}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-indigo-50 text-indigo-700 cursor-pointer"
          title="Auto-Tidy layout (align all cards mathematically)"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto-Tidy</span>
        </button>
        <div className="w-[1px] h-4 bg-zinc-200 mx-0.5" />
        <button
          type="button"
          onClick={() => {
            const next = !isPlanningMode;
            setIsPlanningMode(next);
            if (onTogglePlanningMode) onTogglePlanningMode();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            isPlanningMode
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'hover:bg-zinc-100 text-zinc-700'
          }`}
          title={isPlanningMode ? 'Switch to Full Studio Mode (Show platforms & production metadata)' : 'Switch to Zen Planning Mode (Title + Description only, no clutter)'}
        >
          <Feather className="w-3.5 h-3.5" />
          <span>{isPlanningMode ? 'Zen Planning' : 'Planning Mode'}</span>
        </button>
        <div className="w-[1px] h-4 bg-zinc-200 mx-0.5" />
        {onCollapseAll && (
          <button
            onClick={onCollapseAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg hover:bg-zinc-100 text-zinc-700 cursor-pointer"
            title="Collapse all sub-branches to reduce diagram clutter"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden md:inline">Collapse</span>
          </button>
        )}
        {onExpandAll && (
          <button
            onClick={onExpandAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg hover:bg-zinc-100 text-zinc-700 cursor-pointer"
            title="Expand all branches to see complete diagram"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden md:inline">Expand</span>
          </button>
        )}
        <div className="w-[1px] h-4 bg-zinc-200 mx-0.5" />
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Search Bar */}
      <div className="absolute top-4 left-[340px] z-20 hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white shadow-md border border-zinc-200 text-xs">
        <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter branches..."
          className="w-32 bg-transparent text-xs text-zinc-800 placeholder-zinc-400 focus:outline-hidden"
        />
        {searchFilter && (
          <button onClick={() => setSearchFilter('')} className="text-zinc-400 hover:text-zinc-700">
            ✕
          </button>
        )}
      </div>

      {/* Quick Guide Banner */}
      {showGuide && (
        <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-3 py-2 px-3.5 rounded-xl bg-slate-900/90 text-white text-xs shadow-lg backdrop-blur-xs max-w-lg animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="leading-snug">
            <span className="font-bold">Movable Cards:</span> Click & drag any card to position anywhere • <span className="font-bold text-amber-200">Right-click canvas</span> for quick tools • Click <span className="text-indigo-200 font-bold">Auto-Tidy</span> to re-align.
          </div>
          <button
            onClick={() => setShowGuide(false)}
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer ml-1"
            title="Dismiss tip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scalable & Pannable World Container (hardware-accelerated, zero-lag transform) */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          willChange: isPanning || draggingNodeId ? 'transform' : 'auto',
        }}
        className="absolute top-0 left-0 pointer-events-none"
      >
        {/* SVG Curved Branch Connectors (instant rendering without CSS transition lag) */}
        <svg
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          className="absolute inset-0 pointer-events-none"
        >
          {connectors.map((conn) => (
            <path
              key={conn.id}
              d={conn.path}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2.5"
              strokeDasharray={conn.status === 'harvested' ? 'none' : '4 3'}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Node Cards */}
        {displayedNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isDraggingThis = draggingNodeId === node.id;
          const isNewlyCreated = highlightedNewNodeId === node.id;
          const tierInfo = getFriendlyTierLabel(node.depth, node.type);
          const directChildren = nodes.filter((n) => n.parentId === node.id);
          const hasChildren = directChildren.length > 0;
          const isCollapsed = Boolean(node.isCollapsed);
          const childCount = node.descendantCount || directChildren.length;
          const isHarvesting = harvestingNodeId === node.id;
          const isHarvestSuccess = harvestSuccessNodeId === node.id;
          const isEditing = editingNodeId === node.id;

          const currentPlatform = platforms.find((p) => p.id === (node.platform || 'all')) || platforms[0];
          const colorSetting = COLOR_PALETTE.find((c) => c.id === node.color) || COLOR_PALETTE[0];

          // Search highlighting
          const matchesSearch = searchFilter
            ? node.title.toLowerCase().includes(searchFilter.toLowerCase())
            : true;

          return (
            <div
              key={node.id}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onTouchStart={(e) => handleNodeTouchStart(e, node)}
              onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
              className={`tree-node-card absolute pointer-events-auto rounded-xl border flex flex-col justify-between ${
                isPlanningMode ? 'p-2.5 bg-white' : 'p-2.5'
              } ${colorSetting.bg} ${colorSetting.border} ${
                isNewlyCreated
                  ? 'ring-4 ring-indigo-500/80 border-indigo-500 shadow-xl shadow-indigo-500/25 scale-[1.02] z-30 animate-in zoom-in-95 duration-200'
                  : isSelected
                  ? 'ring-2 ring-indigo-500 border-indigo-400 shadow-indigo-500/10'
                  : 'hover:border-zinc-400 shadow-xs'
              } ${isDraggingThis ? 'opacity-95 shadow-2xl ring-2 ring-indigo-500 scale-[1.03] z-50 cursor-grabbing' : 'z-10 cursor-grab hover:shadow-md'} ${
                !matchesSearch ? 'opacity-30' : 'opacity-100'
              } ${isCollapsed && hasChildren ? 'border-r-4 border-r-indigo-500' : ''}`}
            >
              {/* Interactive Collapse/Expand Badge Icon on Parent Nodes */}
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(node.id);
                  }}
                  className={`absolute -right-3 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center cursor-pointer transition-all duration-150 select-none shadow-sm ${
                    isCollapsed
                      ? 'px-1.5 h-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] border-2 border-white ring-2 ring-indigo-400/50 hover:scale-115'
                      : 'w-5 h-5 rounded-full bg-white hover:bg-indigo-50 text-zinc-600 hover:text-indigo-600 border border-zinc-300 hover:border-indigo-400 hover:scale-115'
                  }`}
                  title={
                    isCollapsed
                      ? `Click to expand ${childCount} hidden branches`
                      : `Click to collapse ${childCount} branches to reduce diagram clutter`
                  }
                >
                  {isCollapsed ? (
                    <span className="flex items-center gap-0.5">
                      <Plus className="w-2.5 h-2.5 stroke-[3]" />
                      <span>{childCount}</span>
                    </span>
                  ) : (
                    <Minus className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </button>
              )}

              {/* ZEN PLANNING CARD (Title + Description Only - Pure Distraction-Free Planning) */}
              {isPlanningMode ? (
                <div className="flex flex-col h-full justify-between gap-1">
                  {/* Planning Card Header: Title & 3-dots */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveTitle(node.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(node.id);
                            if (e.key === 'Escape') setEditingNodeId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-1.5 py-0.5 text-xs font-bold text-zinc-900 bg-amber-50 border border-amber-300 rounded outline-hidden"
                        />
                      ) : (
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingNodeId(node.id);
                            setEditingText(node.title);
                          }}
                          className="flex items-center justify-between group/title gap-1 cursor-text"
                          title="Double-click to rename title"
                        >
                          <p className="text-xs font-bold text-zinc-900 line-clamp-1 leading-tight">
                            {node.title || 'Untitled Idea'}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNodeId(node.id);
                              setEditingText(node.title);
                            }}
                            className="opacity-0 group-hover/title:opacity-100 text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer transition-opacity shrink-0"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isNewlyCreated && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-600 text-white animate-pulse shrink-0">
                          ✨ New Branch
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeContextMenu(e, node.id);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-black/5 active:bg-black/10 cursor-pointer min-w-[20px] min-h-[20px] flex items-center justify-center transition-colors shrink-0"
                        title="More actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Planning Card Body: Description / Concept Notes */}
                  <div className="flex-1 py-0.5 min-h-0">
                    {editingNotesNodeId === node.id ? (
                      <div onClick={(e) => e.stopPropagation()} className="space-y-1">
                        <textarea
                          autoFocus
                          value={editingNotesText}
                          onChange={(e) => setEditingNotesText(e.target.value)}
                          onBlur={() => handleSaveNotes(node.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingNotesNodeId(null);
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNotes(node.id);
                          }}
                          rows={2}
                          placeholder="Describe idea, key points, or planning notes..."
                          className="w-full text-[11px] text-zinc-800 bg-amber-50/70 border border-amber-300 rounded p-1 leading-snug outline-hidden resize-none"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNotesNodeId(node.id);
                          setEditingNotesText(node.notes || '');
                        }}
                        className="group/desc cursor-text rounded hover:bg-black/5 p-1 -m-1 transition-colors h-full flex flex-col justify-center"
                        title="Click to edit description"
                      >
                        {node.notes && node.notes.trim() ? (
                          <p className="text-[11px] text-zinc-600 line-clamp-2 leading-tight font-normal">
                            {node.notes}
                          </p>
                        ) : (
                          <p className="text-[10px] text-zinc-400 italic flex items-center gap-1 group-hover/desc:text-zinc-600">
                            <AlignLeft className="w-2.5 h-2.5 opacity-60 shrink-0" />
                            <span className="truncate">Add description...</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Planning Card Footer: Minimal Branch Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[10px]">
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {node.type === 'root' ? 'Topic' : node.type === 'trunk' ? 'Angle' : 'Branch'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const childType: TreeNodeType =
                          node.type === 'root' ? 'trunk' : node.type === 'trunk' ? 'branch' : 'leaf';
                        onAddChildNode(node.id, childType);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-slate-800 text-white font-bold text-[10px] cursor-pointer shadow-2xs transition-colors"
                      title="Add a sub-branch"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Branch</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* FULL STUDIO PRODUCTION CARD */
                <>
                  {/* Card Header: Drag Grip, Tier Badge, Platform Button & 3-Dots Menu */}
                  <div className="flex items-center justify-between gap-1">
                    {/* Drag Indicator & Level Pill */}
                    <div className="flex items-center gap-1 min-w-0">
                      <GripHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${tierInfo.color}`}>
                        <span>{tierInfo.emoji}</span>
                        <span className="truncate max-w-[70px] sm:max-w-[85px]">{tierInfo.label}</span>
                      </span>
                    </div>

                    {/* Right Header: Platform Badge + 3-Dots Quick Menu */}
                    <div className="flex items-center gap-1">
                      {/* Platform Badge / Switcher */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlatformPickerNodeId(platformPickerNodeId === node.id ? null : node.id);
                          }}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors ${currentPlatform.bg} hover:opacity-80`}
                          title="Change target platform"
                        >
                          <span>{currentPlatform.icon}</span>
                          <span className="max-w-[55px] sm:max-w-[70px] truncate">{currentPlatform.label}</span>
                        </button>

                        {/* Popover platform selector */}
                        {platformPickerNodeId === node.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 space-y-1 animate-in zoom-in-95"
                          >
                            <div className="text-[10px] font-bold text-zinc-400 px-1.5 py-0.5 uppercase">
                              Select Platform
                            </div>
                            {platforms.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  onUpdateNodePlatform(node.id, p.id);
                                  setPlatformPickerNodeId(null);
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-left cursor-pointer transition-colors ${
                                  (node.platform || 'all') === p.id
                                    ? 'bg-indigo-50 text-indigo-900 font-bold'
                                    : 'hover:bg-zinc-100 text-zinc-700 font-medium'
                                }`}
                              >
                                <span>{p.icon}</span>
                                <span>{p.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Newly summoned indicator */}
                      {isNewlyCreated && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-600 text-white animate-pulse shrink-0">
                          ✨ New
                        </span>
                      )}

                      {/* 3-Dots Quick Actions Menu Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeContextMenu(e, node.id);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-black/5 active:bg-black/10 cursor-pointer min-w-[22px] min-h-[22px] flex items-center justify-center transition-colors"
                        title="Open actions menu"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title / Inline Editable Area */}
                  <div className="my-auto py-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveTitle(node.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle(node.id);
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-1.5 py-0.5 text-xs font-bold text-zinc-900 bg-amber-50 border border-amber-300 rounded outline-hidden"
                      />
                    ) : (
                      <div
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingNodeId(node.id);
                          setEditingText(node.title);
                        }}
                        className="flex items-center justify-between group/title gap-1 cursor-text"
                        title="Double-click to rename"
                      >
                        <p className="text-xs font-bold text-zinc-900 line-clamp-2 leading-snug">
                          {node.title || 'Untitled Idea'}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNodeId(node.id);
                            setEditingText(node.title);
                          }}
                          className="opacity-0 group-hover/title:opacity-100 text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[10px]">
                    {/* 1-Click Send to Studio OR Collapsed Indicator */}
                    <div>
                      {isCollapsed && hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(node.id);
                          }}
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors"
                          title="Click to expand hidden branches"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{childCount} hidden</span>
                        </button>
                      ) : isHarvestSuccess || node.status === 'harvested' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                          <Check className="w-3 h-3" />
                          <span>Sent!</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isHarvesting}
                          onClick={(e) => handleTriggerQuickHarvest(e, node)}
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                          title="Send directly to Content Studio pipeline"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>{isHarvesting ? 'Sending...' : 'Send to Studio'}</span>
                        </button>
                      )}
                    </div>

                    {/* Right actions: Expand/collapse & Add Sub-Idea */}
                    <div className="flex items-center gap-1">
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(node.id);
                          }}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            isCollapsed
                              ? 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200'
                              : 'text-zinc-400 hover:bg-black/5 hover:text-zinc-700'
                          }`}
                          title={isCollapsed ? `Expand ${childCount} branches` : `Collapse ${childCount} branches`}
                        >
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* More info / details button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNodeDetails(node.id);
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-indigo-50 text-zinc-600 hover:text-indigo-700 text-[10px] font-semibold cursor-pointer transition-colors"
                        title="Add script notes, tags, and detailed outline"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Info</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const childType: TreeNodeType =
                            node.type === 'root' ? 'trunk' : node.type === 'trunk' ? 'branch' : 'leaf';
                          onAddChildNode(node.id, childType);
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-slate-800 text-white font-bold text-[10px] cursor-pointer shadow-2xs transition-colors"
                        title="Add a sub-idea branch"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Branch</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* CONTEXT MENU: Bottom Sheet on Mobile (<768px), Floating Popover on Desktop */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50 md:absolute md:inset-auto bg-black/40 md:bg-transparent backdrop-blur-2xs md:backdrop-blur-none flex flex-col justify-end md:block"
          onClick={() => setContextMenu(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              left: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${Math.min(contextMenu.screenX, (containerRef.current?.clientWidth || 800) - 240)}px` : undefined,
              top: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${Math.min(contextMenu.screenY, (containerRef.current?.clientHeight || 600) - 340)}px` : undefined,
            }}
            className="w-full md:w-60 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-zinc-200 p-3 md:p-1.5 text-xs animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto divide-y divide-zinc-100"
          >
            {/* Mobile Drag Indicator & Close button */}
            <div className="flex md:hidden items-center justify-between pb-2 mb-1 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-900">Branch Actions</span>
              <button
                type="button"
                onClick={() => setContextMenu(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          {/* 1. NODE CONTEXT MENU */}
          {contextMenu.type === 'node' && contextMenu.nodeId && (() => {
            const activeNode = nodes.find((n) => n.id === contextMenu.nodeId);
            if (!activeNode) return null;

            return (
              <>
                <div className="px-3 py-1.5">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Idea Actions
                  </div>
                  <div className="text-xs font-bold text-zinc-900 truncate">
                    {activeNode.title || 'Untitled Branch'}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      const childType: TreeNodeType =
                        activeNode.type === 'root' ? 'trunk' : activeNode.type === 'trunk' ? 'branch' : 'leaf';
                      onAddChildNode(activeNode.id, childType);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-800 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Add Sub-Branch</span>
                  </button>

                  {activeNode.parentId && onAddSiblingNode && (
                    <button
                      onClick={() => {
                        onAddSiblingNode(activeNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer font-medium"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Add Sibling Branch</span>
                    </button>
                  )}

                  {nodes.some((n) => n.parentId === activeNode.id) && (
                    <button
                      onClick={() => {
                        onToggleCollapse(activeNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                    >
                      {activeNode.isCollapsed ? (
                        <>
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Expand Branches ({nodes.filter((n) => n.parentId === activeNode.id).length})</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Collapse Branches</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onOpenNodeDetails(activeNode.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-indigo-700 hover:bg-indigo-50 cursor-pointer font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Open More Information</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingNodeId(activeNode.id);
                      setEditingText(activeNode.title);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Rename Idea</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingNotesNodeId(activeNode.id);
                      setEditingNotesText(activeNode.notes || '');
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    <AlignLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Edit Description</span>
                  </button>

                  <button
                    onClick={() => {
                      onQuickHarvest(activeNode);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-indigo-600 hover:bg-indigo-50 font-semibold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Content Studio</span>
                  </button>
                </div>

                {/* Color Palette Switcher */}
                <div className="p-2.5 space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400">Card Color Tag</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onUpdateNodeColor(activeNode.id, c.id);
                          setContextMenu(null);
                        }}
                        style={{ width: '20px', height: '20px' }}
                        className={`rounded-full border ${c.bg} ${c.border} cursor-pointer hover:scale-125 transition-transform ${
                          activeNode.color === c.id ? 'ring-2 ring-indigo-600' : ''
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      onDuplicateSubtree(activeNode.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Duplicate Branch</span>
                  </button>

                  {activeNode.parentId !== null && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this idea and all of its branches?')) {
                          onDeleteNode(activeNode.id);
                        }
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Branch</span>
                    </button>
                  )}
                </div>
              </>
            );
          })()}

          {/* 2. CANVAS BACKGROUND CONTEXT MENU */}
          {contextMenu.type === 'canvas' && (
            <>
              <div className="px-3 py-1.5 bg-zinc-50/70 rounded-t-2xl">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Canvas Menu
                </span>
                <span className="text-xs font-semibold text-zinc-600">
                  Position: ({contextMenu.canvasX}, {contextMenu.canvasY})
                </span>
              </div>

              {/* Idea Creation */}
              <div className="py-1">
                <button
                  onClick={() => {
                    onAddRootNode(contextMenu.canvasX, contextMenu.canvasY, 'New Idea');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-900 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer font-bold"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Add Idea Here</span>
                </button>
              </div>

              {/* Layout & Alignments */}
              <div className="py-1">
                <button
                  onClick={() => {
                    handleFitScreen();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Center & Fit Screen</span>
                </button>

                <button
                  onClick={() => {
                    onAutoTidy();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-indigo-700 hover:bg-indigo-50 font-semibold cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Tidy Tree Layout</span>
                </button>

                {onCollapseAll && (
                  <button
                    onClick={() => {
                      onCollapseAll();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                  >
                    <ChevronsDown className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Collapse All Branches</span>
                  </button>
                )}

                {onExpandAll && (
                  <button
                    onClick={() => {
                      onExpandAll();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                  >
                    <ChevronsUp className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Expand All Branches</span>
                  </button>
                )}
              </div>

              {/* Background Theme */}
              <div className="p-2.5 space-y-1">
                <div className="text-[10px] font-bold text-zinc-400">Canvas Grid</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'dots' as const, label: 'Dots' },
                    { id: 'grid' as const, label: 'Lines' },
                    { id: 'clean' as const, label: 'Plain' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => {
                        setBackgroundStyle(bg.id);
                        setContextMenu(null);
                      }}
                      className={`py-1 text-[11px] font-semibold rounded-md border text-center cursor-pointer transition-colors ${
                        backgroundStyle === bg.id
                          ? 'bg-zinc-900 text-white border-zinc-900 font-bold'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Files & Vault Options */}
              <div className="py-1">
                {onOpenFileManager && (
                  <button
                    onClick={() => {
                      onOpenFileManager();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tree Files & Vault</span>
                  </button>
                )}

                {onQuickSaveJSON && (
                  <button
                    onClick={() => {
                      onQuickSaveJSON();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Save as JSON File</span>
                  </button>
                )}

                {onQuickCopyMarkdown && (
                  <button
                    onClick={() => {
                      onQuickCopyMarkdown();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer font-medium"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Copy as Text Outline</span>
                  </button>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Bird's-Eye Minimap Overlay with Draggable Viewport Window */}
      <TreeMinimap
        nodes={displayedNodes}
        selectedNodeId={selectedNodeId}
        worldWidth={canvasWidth}
        worldHeight={canvasHeight}
        zoom={zoom}
        pan={pan}
        containerWidth={containerDimensions.width}
        containerHeight={containerDimensions.height}
        onPanChange={(newPan) => setPan(newPan)}
        onCenterAll={handleFitScreen}
      />
    </div>
  );
};
