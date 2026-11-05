import React from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  CheckSquare, 
  ListOrdered, 
  Heading1, 
  Quote, 
  Undo2, 
  Redo2,
  Calendar,
  Sparkles
} from 'lucide-react';

export interface EditorToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onBullet: () => void;
  onChecklist?: () => void;
  onNumberedList?: () => void;
  onHeading?: () => void;
  onQuote?: () => void;
  onDateStamp?: () => void;
  onSmartFormat?: () => void;
  isSmartFormatEnabled?: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
  canRedo?: boolean;
  onRedo?: () => void;
  className?: string;
  showUndoRedo?: boolean;
  compact?: boolean;
}

/**
 * Lightweight, unified toolbar for text editors across Notes, Threads, and Workspace.
 * Provides instant 1-click Bold, Italic, and Bulleted List formatting, with optional Undo/Redo,
 * plus Smart Format detection for copied text from AI chat, MS Word, and websites.
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onBold,
  onItalic,
  onBullet,
  onChecklist,
  onNumberedList,
  onHeading,
  onQuote,
  onDateStamp,
  onSmartFormat,
  isSmartFormatEnabled = true,
  canUndo = false,
  onUndo,
  canRedo = false,
  onRedo,
  className = '',
  showUndoRedo = true,
  compact = false,
}) => {
  return (
    <div
      className={`flex items-center flex-wrap gap-1 text-xs select-none ${className}`}
      role="toolbar"
      aria-label="Text Formatting Tools"
    >
      {/* Undo & Redo (optional) */}
      {showUndoRedo && onUndo && (
        <>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z / Cmd+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5 text-zinc-700" />
            {!compact && <span className="hidden xs:inline">Undo</span>}
          </button>

          {onRedo && (
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5 text-zinc-700" />
              {!compact && <span className="hidden xs:inline">Redo</span>}
            </button>
          )}

          <div className="w-px h-4 bg-zinc-200 mx-1 shrink-0" />
        </>
      )}

      {/* PRIMARY REQUESTED CORE FORMATTING: Bold, Italic, Bulleted List */}
      <button
        type="button"
        onClick={onBold}
        className="p-1.5 px-2.5 rounded-lg text-zinc-800 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
        title="Bold (**text**) • Ctrl+B"
        aria-label="Bold text"
      >
        <Bold className="w-3.5 h-3.5" />
        <span className="text-[11px]">Bold</span>
      </button>

      <button
        type="button"
        onClick={onItalic}
        className="p-1.5 px-2.5 rounded-lg text-zinc-800 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 italic flex items-center gap-1 cursor-pointer transition-all active:scale-95"
        title="Italic (*text*) • Ctrl+I"
        aria-label="Italic text"
      >
        <Italic className="w-3.5 h-3.5" />
        <span className="text-[11px]">Italic</span>
      </button>

      <button
        type="button"
        onClick={onBullet}
        className="p-1.5 px-2.5 rounded-lg text-zinc-800 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
        title="Bulleted List (• Point)"
        aria-label="Bulleted list"
      >
        <List className="w-3.5 h-3.5 text-zinc-700" />
        <span className="text-[11px]">Bullet</span>
      </button>

      {/* OPTIONAL EXTENSIONS: Checklist, Number, Heading, Quote, Date */}
      {onChecklist && (
        <button
          type="button"
          onClick={onChecklist}
          className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          title="Interactive Checklist ([ ])"
          aria-label="Checklist"
        >
          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
          {!compact && <span className="text-[11px] hidden sm:inline">Checklist</span>}
        </button>
      )}

      {onNumberedList && (
        <button
          type="button"
          onClick={onNumberedList}
          className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          title="Numbered List (1. Point)"
          aria-label="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5 text-zinc-600" />
          {!compact && <span className="text-[11px] hidden sm:inline">1. List</span>}
        </button>
      )}

      {onHeading && (
        <button
          type="button"
          onClick={onHeading}
          className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          title="Heading (#)"
          aria-label="Heading"
        >
          <Heading1 className="w-3.5 h-3.5" />
          <span className="text-[11px]">H1</span>
        </button>
      )}

      {onQuote && (
        <button
          type="button"
          onClick={onQuote}
          className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 cursor-pointer transition-all active:scale-95"
          title="Quote / Callout (>)"
          aria-label="Quote"
        >
          <Quote className="w-3.5 h-3.5 text-zinc-600" />
        </button>
      )}

      {onDateStamp && (
        <button
          type="button"
          onClick={onDateStamp}
          className="p-1.5 px-2 rounded-lg text-zinc-700 hover:bg-white hover:shadow-2xs border border-transparent hover:border-zinc-200 flex items-center gap-1 cursor-pointer transition-all text-xs active:scale-95"
          title="Insert Date Stamp"
          aria-label="Insert date stamp"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-600" />
          {!compact && <span className="hidden sm:inline text-[11px]">Date</span>}
        </button>
      )}

      {/* SMART FORMAT DETECTOR BUTTON */}
      {onSmartFormat && (
        <>
          <div className="w-px h-4 bg-zinc-200 mx-1 shrink-0" />
          <button
            type="button"
            onClick={onSmartFormat}
            className="p-1.5 px-2.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
            title="Auto-detect & format copied text into clean headlines, bullets, numbered lists & checklists"
            aria-label="Smart Format"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px]">Smart Format</span>
          </button>
        </>
      )}
    </div>
  );
};

/**
 * Universal cursor-aware text formatter helper for textareas.
 * Intelligently wraps selected text or inserts prefix at start of the line.
 */
export const applyFormatting = (
  textarea: HTMLTextAreaElement | null,
  type: 'bold' | 'italic' | 'bullet' | 'checklist' | 'number' | 'h1' | 'quote' | 'datestamp',
  onTextChange: (newText: string) => void
) => {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  let newStart = start;
  let newEnd = end;

  if (type === 'bold') {
    const wrap = `**${selectedText || 'bold text'}**`;
    replacement = text.substring(0, start) + wrap + text.substring(end);
    newStart = start + 2;
    newEnd = selectedText ? end + 2 : start + 11;
  } else if (type === 'italic') {
    const wrap = `*${selectedText || 'italic text'}*`;
    replacement = text.substring(0, start) + wrap + text.substring(end);
    newStart = start + 1;
    newEnd = selectedText ? end + 1 : start + 12;
  } else if (type === 'bullet') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = text.substring(0, lineStart) + '• ' + text.substring(lineStart);
    newStart = newEnd = start + 2;
  } else if (type === 'checklist') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = text.substring(0, lineStart) + '[ ] ' + text.substring(lineStart);
    newStart = newEnd = start + 4;
  } else if (type === 'number') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = text.substring(0, lineStart) + '1. ' + text.substring(lineStart);
    newStart = newEnd = start + 3;
  } else if (type === 'h1') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = text.substring(0, lineStart) + '# ' + text.substring(lineStart);
    newStart = newEnd = start + 2;
  } else if (type === 'quote') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = text.substring(0, lineStart) + '> ' + text.substring(lineStart);
    newStart = newEnd = start + 2;
  } else if (type === 'datestamp') {
    const stamp = `[${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] `;
    replacement = text.substring(0, start) + stamp + text.substring(end);
    newStart = newEnd = start + stamp.length;
  }

  onTextChange(replacement);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
  }, 0);
};
