import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ResizablePopupWrapperProps {
  scope: string; // e.g. 'tasks', 'threads', 'ideas', 'financial', 'global'
  popupId: string; // e.g. 'task_details', 'capsule_details', 'thread_create', 'financial_entry'
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  isSettingsOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const ResizablePopupWrapper: React.FC<ResizablePopupWrapperProps> = ({
  scope,
  popupId,
  defaultWidth = 560,
  minWidth = 400,
  maxWidth = 1140,
  isSettingsOpen = false,
  className = '',
  style = {},
  children,
}) => {
  // Resolve initial width from item-specific -> tab-scope -> legacy -> default
  const [width, setWidth] = useState<number>(() => {
    try {
      const itemKey = `popup_width_item_${scope}_${popupId}`;
      const tabKey = `popup_width_tab_${scope}`;
      const itemSaved = localStorage.getItem(itemKey);
      if (itemSaved) {
        const val = parseInt(itemSaved, 10);
        if (!isNaN(val) && val >= minWidth && val <= maxWidth) return val;
      }
      const tabSaved = localStorage.getItem(tabKey);
      if (tabSaved) {
        const val = parseInt(tabSaved, 10);
        if (!isNaN(val) && val >= minWidth && val <= maxWidth) return val;
      }
      // Legacy fallback for tasks
      if (scope === 'tasks') {
        const legacy = localStorage.getItem('daily_task_modal_width');
        if (legacy) {
          const val = parseInt(legacy, 10);
          if (!isNaN(val) && val >= minWidth && val <= maxWidth) return val;
        }
      }
    } catch {}
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [savedChoice, setSavedChoice] = useState<'all' | 'only_this' | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(defaultWidth);
  const currentWidthRef = useRef(width);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync ref with state
  useEffect(() => {
    currentWidthRef.current = width;
  }, [width]);

  // Listen to scope-wide updates from sibling popups in the same tab
  useEffect(() => {
    const handleScopeUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ scope: string; width: number }>;
      if (custom.detail && custom.detail.scope === scope) {
        // If this popup has an explicit item-specific override, do not override
        try {
          const itemKey = `popup_width_item_${scope}_${popupId}`;
          if (localStorage.getItem(itemKey)) return;
        } catch {}

        if (typeof custom.detail.width === 'number') {
          setWidth(custom.detail.width);
        }
      }
    };

    window.addEventListener('popup-width-updated', handleScopeUpdate);
    return () => {
      window.removeEventListener('popup-width-updated', handleScopeUpdate);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [scope, popupId]);

  // Butter-smooth drag-to-resize handler
  const handleStartResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsResizing(true);
    setShowApplyPrompt(false);
    setSavedChoice(null);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartXRef.current = clientX;
    dragStartWidthRef.current = currentWidthRef.current;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    let currentW = currentWidthRef.current;
    let rafId: number | null = null;

    const onPointerMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const currentX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const deltaX = currentX - dragStartXRef.current;
      const availableWidth = window.innerWidth;
      const maxAllowed = Math.min(maxWidth, Math.max(minWidth, availableWidth - (isSettingsOpen ? 370 : 48)));
      const targetW = Math.max(minWidth, Math.min(maxAllowed, Math.round(dragStartWidthRef.current + deltaX)));

      if (targetW === currentW) return;
      currentW = targetW;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setWidth(targetW);
      });
    };

    const onPointerUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      isDraggingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      // If user dragged noticeably (more than 3px), present "All" vs "Only this" options
      if (Math.abs(currentW - dragStartWidthRef.current) >= 3) {
        setShowApplyPrompt(true);
      }
    };

    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  // Choice 1: Save for all popups in this tab
  const handleSaveAll = () => {
    try {
      const tabKey = `popup_width_tab_${scope}`;
      const itemKey = `popup_width_item_${scope}_${popupId}`;
      localStorage.setItem(tabKey, width.toString());
      localStorage.removeItem(itemKey);
      if (scope === 'tasks') {
        localStorage.setItem('daily_task_modal_width', width.toString());
      }
      // Broadcast to sibling popups in the same tab
      window.dispatchEvent(
        new CustomEvent('popup-width-updated', {
          detail: { scope, width },
        })
      );
    } catch {}

    setSavedChoice('all');
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setShowApplyPrompt(false);
      setSavedChoice(null);
    }, 1200);
  };

  // Choice 2: Save only for this specific popup
  const handleSaveOnlyThis = () => {
    try {
      const itemKey = `popup_width_item_${scope}_${popupId}`;
      localStorage.setItem(itemKey, width.toString());
    } catch {}

    setSavedChoice('only_this');
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setShowApplyPrompt(false);
      setSavedChoice(null);
    }, 1200);
  };

  return (
    <div
      style={{
        width: `${width}px`,
        maxWidth: '94vw',
        ...style,
      }}
      className={`relative flex flex-col shrink-0 ${className}`}
    >
      {children}

      {/* CURVED PREMIUM FLOATING RESIZE HANDLE (Outside popup) */}
      <div
        onMouseDown={handleStartResize}
        onTouchStart={handleStartResize}
        className={`hidden sm:flex absolute -right-3.5 bottom-6 z-40 items-center justify-center cursor-ew-resize select-none transition-all group/resize-handle ${
          isResizing ? 'scale-110' : 'hover:scale-105 active:scale-95'
        }`}
        title="Drag horizontally to resize popup width"
      >
        <div
          className={`w-7 h-14 rounded-full flex flex-col items-center justify-center gap-1.5 transition-all shadow-xl backdrop-blur-md border ${
            isResizing
              ? 'bg-zinc-900 text-white border-zinc-900 ring-4 ring-zinc-900/15'
              : 'bg-white hover:bg-zinc-900 text-zinc-400 hover:text-white border-zinc-200/90 hover:border-zinc-900 shadow-md'
          }`}
        >
          <div className="w-1 h-2.5 rounded-full bg-current opacity-70 group-hover/resize-handle:opacity-100 transition-opacity" />
          <div className="w-1 h-2.5 rounded-full bg-current opacity-70 group-hover/resize-handle:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* POST-DRAG PROMPT: "All" vs "Only this" */}
      <AnimatePresence>
        {showApplyPrompt && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4, transition: { duration: 0.15 } }}
            className="absolute -right-3 sm:-right-4 bottom-22 z-50 bg-zinc-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-2xl border border-white/10 flex flex-col gap-2 min-w-[195px] select-none"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Apply width ({width}px):
              </span>
              <button
                type="button"
                onClick={() => setShowApplyPrompt(false)}
                className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveAll}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                  savedChoice === 'all'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={`Resize for all popups in the "${scope}" tab`}
              >
                {savedChoice === 'all' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>All</span>
              </button>

              <button
                type="button"
                onClick={handleSaveOnlyThis}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                  savedChoice === 'only_this'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Only resize this specific popup"
              >
                {savedChoice === 'only_this' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>Only this</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
