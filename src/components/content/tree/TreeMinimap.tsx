import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LayoutNode } from './treeUtils';
import { TreeNodeStatus } from '../../../types/content';
import { Map, Minimize2, Maximize2, RotateCcw, Compass, Eye } from 'lucide-react';

interface TreeMinimapProps {
  nodes: LayoutNode[];
  selectedNodeId: string | null;
  worldWidth: number;
  worldHeight: number;
  zoom: number;
  pan: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
  onPanChange: (newPan: { x: number; y: number }) => void;
  onCenterAll: () => void;
}

const MINI_W = 210;
const MINI_H = 140;
const PAD = 40;

export const TreeMinimap: React.FC<TreeMinimapProps> = React.memo(({
  nodes,
  selectedNodeId,
  worldWidth,
  worldHeight,
  zoom,
  pan,
  containerWidth,
  containerHeight,
  onPanChange,
  onCenterAll,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialPan: { x: number; y: number } } | null>(null);
  const minimapBoxRef = useRef<HTMLDivElement>(null);

  // Compute world bounding box based on nodes and fallback dimensions
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, width: Math.max(worldWidth, 800), height: Math.max(worldHeight, 600) };
    }
    let minX = 0;
    let minY = 0;
    let maxX = worldWidth;
    let maxY = worldHeight;

    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });

    const w = Math.max(maxX - minX + PAD * 2, 600);
    const h = Math.max(maxY - minY + PAD * 2, 400);

    return { minX, minY, width: w, height: h };
  }, [nodes, worldWidth, worldHeight]);

  // Scale factor to fit the world into the minimap
  const scale = useMemo(() => {
    const scaleX = (MINI_W - 16) / bounds.width;
    const scaleY = (MINI_H - 24) / bounds.height;
    return Math.min(scaleX, scaleY);
  }, [bounds]);

  const drawW = bounds.width * scale;
  const drawH = bounds.height * scale;
  const offsetX = (MINI_W - drawW) / 2;
  const offsetY = (MINI_H - drawH) / 2 + 4;

  // Convert world point to minimap point
  const toMiniX = useCallback(
    (wx: number) => offsetX + (wx - bounds.minX + PAD) * scale,
    [offsetX, bounds.minX, scale]
  );
  const toMiniY = useCallback(
    (wy: number) => offsetY + (wy - bounds.minY + PAD) * scale,
    [offsetY, bounds.minY, scale]
  );

  // Current visible viewport in world coordinates
  const visWorldX = -pan.x / zoom;
  const visWorldY = -pan.y / zoom;
  const visWorldW = containerWidth / zoom;
  const visWorldH = containerHeight / zoom;

  // Viewport window box in minimap coordinates
  const viewportBox = useMemo(() => {
    const vx = toMiniX(visWorldX);
    const vy = toMiniY(visWorldY);
    const vw = visWorldW * scale;
    const vh = visWorldH * scale;

    return {
      x: vx,
      y: vy,
      width: Math.max(vw, 12),
      height: Math.max(vh, 8),
    };
  }, [toMiniX, toMiniY, visWorldX, visWorldY, visWorldW, visWorldH, scale]);

  // Pan canvas to center on a clicked point in the minimap
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking directly on viewport or while dragging, ignore
    if (isDraggingViewport || (e.target as HTMLElement).closest('.minimap-viewport')) {
      return;
    }
    if (!minimapBoxRef.current) return;
    const rect = minimapBoxRef.current.getBoundingClientRect();
    const clickMx = e.clientX - rect.left;
    const clickMy = e.clientY - rect.top;

    // Convert minimap click to world coordinate
    const targetWx = (clickMx - offsetX) / scale + bounds.minX - PAD;
    const targetWy = (clickMy - offsetY) / scale + bounds.minY - PAD;

    // Center screen on target world coordinate
    const newPanX = containerWidth / 2 - targetWx * zoom;
    const newPanY = containerHeight / 2 - targetWy * zoom;

    onPanChange({
      x: Math.round(newPanX),
      y: Math.round(newPanY),
    });
  };

  // Viewport window drag start
  const handleViewportMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingViewport(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialPan: { ...pan },
    };
  };

  // Window listeners for dragging the viewport box smoothly
  useEffect(() => {
    if (!isDraggingViewport) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dxMini = e.clientX - dragStartRef.current.clientX;
      const dyMini = e.clientY - dragStartRef.current.clientY;

      // Delta in world coordinates
      const dxWorld = dxMini / scale;
      const dyWorld = dyMini / scale;

      // New pan position
      const newPanX = dragStartRef.current.initialPan.x - dxWorld * zoom;
      const newPanY = dragStartRef.current.initialPan.y - dyWorld * zoom;

      onPanChange({
        x: Math.round(newPanX),
        y: Math.round(newPanY),
      });
    };

    const handleWindowMouseUp = () => {
      setIsDraggingViewport(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingViewport, scale, zoom, onPanChange]);

  // Color mapping helper for miniature node pills
  const getNodeColor = (color?: string) => {
    switch (color) {
      case 'emerald':
        return '#10B981';
      case 'indigo':
        return '#6366F1';
      case 'purple':
        return '#A855F7';
      case 'amber':
        return '#F59E0B';
      case 'rose':
        return '#F43F5E';
      case 'sky':
        return '#0EA5E9';
      default:
        return '#64748B';
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="absolute bottom-4 right-4 z-30 p-2.5 rounded-xl bg-white/95 hover:bg-white text-zinc-700 hover:text-indigo-600 shadow-lg border border-zinc-200/90 cursor-pointer backdrop-blur-md flex items-center gap-1.5 transition-all group"
        title="Open Tree Minimap"
      >
        <Compass className="w-4 h-4 text-indigo-600 group-hover:rotate-45 transition-transform duration-200" />
        <span className="text-xs font-bold hidden sm:inline">Minimap</span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-zinc-200/90 shadow-xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150">
      {/* Minimap Top Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-100 bg-zinc-50/70 text-[11px] font-bold text-zinc-600">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-600" />
          <span>Navigator</span>
          <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-200/70 px-1 rounded-sm">
            {nodes.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCenterAll}
            className="p-1 rounded hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-800 cursor-pointer"
            title="Center and fit all"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-800 cursor-pointer"
            title="Collapse minimap"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Interactive Minimap Area */}
      <div
        ref={minimapBoxRef}
        onClick={handleMinimapClick}
        style={{ width: `${MINI_W}px`, height: `${MINI_H}px` }}
        className="relative bg-slate-900/5 cursor-crosshair overflow-hidden"
        title="Click to jump or drag viewport box to pan"
      >
        {/* SVG Connectors & Node Dots */}
        <svg
          style={{ width: `${MINI_W}px`, height: `${MINI_H}px` }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Miniature Lines */}
          {nodes.map((node) => {
            if (!node.parentId) return null;
            const parent = nodes.find((n) => n.id === node.parentId);
            if (!parent) return null;

            const px = toMiniX(parent.x + parent.width);
            const py = toMiniY(parent.y + parent.height / 2);
            const cx = toMiniX(node.x);
            const cy = toMiniY(node.y + node.height / 2);

            return (
              <path
                key={`${parent.id}->${node.id}`}
                d={`M ${px} ${py} C ${(px + cx) / 2} ${py}, ${(px + cx) / 2} ${cy}, ${cx} ${cy}`}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />
            );
          })}

          {/* Miniature Node Dots */}
          {nodes.map((node) => {
            const nx = toMiniX(node.x);
            const ny = toMiniY(node.y);
            const nw = Math.max(node.width * scale, 6);
            const nh = Math.max(node.height * scale, 4);
            const isSelected = selectedNodeId === node.id;
            const fillColor = getNodeColor(node.color);

            return (
              <g key={node.id}>
                {isSelected && (
                  <rect
                    x={nx - 1.5}
                    y={ny - 1.5}
                    width={nw + 3}
                    height={nh + 3}
                    rx={2.5}
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                )}
                <rect
                  x={nx}
                  y={ny}
                  width={nw}
                  height={nh}
                  rx={1.5}
                  fill={fillColor}
                  opacity={isSelected ? 1 : 0.85}
                />
              </g>
            );
          })}
        </svg>

        {/* Viewport Camera Window (Draggable Rectangle) */}
        <div
          onMouseDown={handleViewportMouseDown}
          style={{
            left: `${viewportBox.x}px`,
            top: `${viewportBox.y}px`,
            width: `${viewportBox.width}px`,
            height: `${viewportBox.height}px`,
          }}
          className={`minimap-viewport absolute rounded-md border-2 border-indigo-600 bg-indigo-500/20 backdrop-blur-2xs transition-shadow shadow-xs ${
            isDraggingViewport ? 'cursor-grabbing shadow-md border-indigo-700 bg-indigo-500/30' : 'cursor-grab hover:bg-indigo-500/25'
          }`}
          title="Drag viewport window to pan canvas"
        >
          {/* Subtle center indicator */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
          </div>
        </div>
      </div>
    </div>
  );
});
