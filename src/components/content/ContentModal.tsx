import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { 
  ContentItem, 
  ContentCategory, 
  ContentFormat, 
  ContentStatus, 
  PostedPlatform,
  CustomDataField 
} from '../../types/content';
import { detectAndConvertClipboard } from '../../lib/smartFormatDetector';
import { 
  X, 
  Plus, 
  Video, 
  Smartphone, 
  Check, 
  FolderPlus, 
  Trash2, 
  Sparkles,
  CheckCircle2, 
  Calendar, 
  Share2,
  Maximize2,
  Minimize2,
  Copy,
  FileText,
  Layers,
  Hash,
  Link2,
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks, extractAllLinks } from '../../lib/linkUtils';

interface ContentModalProps {
  isOpen: boolean;
  item: Partial<ContentItem> | null;
  categories: ContentCategory[];
  allTags: string[];
  initialFormat?: ContentFormat;
  initialCategoryId?: string;
  onSave: (itemData: Partial<ContentItem>) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  onClose: () => void;
  onCreateCategory: (name: string, parentCategoryId: string | null) => Promise<string | void>;
}

export const ContentModal: React.FC<ContentModalProps> = ({
  isOpen,
  item,
  categories,
  allTags,
  initialFormat,
  initialCategoryId,
  onSave,
  onDelete,
  onClose,
  onCreateCategory,
}) => {
  const { theme } = useTheme();

  // Core fields
  const [title, setTitle] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [format, setFormat] = useState<ContentFormat>('long_form');
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [postedTo, setPostedTo] = useState<PostedPlatform[]>([]);
  const [postedDate, setPostedDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Raw Tags Box State (No comma separated column, empty formatted box for raw data)
  const [rawTags, setRawTags] = useState('');
  const [tagsCopied, setTagsCopied] = useState(false);

  // Custom Data State (Title & Body cards)
  const [customData, setCustomData] = useState<CustomDataField[]>([]);

  // Widescreen & Zen Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Inline Category Creation State
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // Initialize form state
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setScriptText(item.script_text || '');
      // If raw_tags exists, use it; otherwise fallback to joining existing tags
      setRawTags(
        item.raw_tags !== undefined
          ? item.raw_tags
          : (item.tags && item.tags.length > 0 ? item.tags.join(', ') : '')
      );
      setCustomData(item.custom_data && Array.isArray(item.custom_data) ? item.custom_data : []);
      setCategoryId(item.category_id || initialCategoryId || categories[0]?.id || '');
      setFormat(item.format || initialFormat || 'long_form');
      setStatus(item.status || 'draft');
      setPostedTo(item.posted_to || []);
      setPostedDate(item.posted_date || new Date().toISOString().split('T')[0]);
    } else {
      setTitle('');
      setScriptText('');
      setRawTags('');
      setCustomData([]);
      setCategoryId(initialCategoryId || categories[0]?.id || '');
      setFormat(initialFormat || 'long_form');
      setStatus('draft');
      setPostedTo([]);
      setPostedDate(new Date().toISOString().split('T')[0]);
    }
    setIsCreatingCat(false);
    setNewCatName('');
  }, [item, isOpen, initialFormat, initialCategoryId, categories]);

  // Detected links in script & title - called unconditionally at top level
  const detectedScriptLinks = useMemo(() => {
    return extractAllLinks(`${title} ${scriptText}`);
  }, [title, scriptText]);

  if (!isOpen) return null;

  // Platform checkbox toggle
  const togglePlatform = (p: PostedPlatform) => {
    if (postedTo.includes(p)) {
      setPostedTo(postedTo.filter((x) => x !== p));
    } else {
      setPostedTo([...postedTo, p]);
    }
  };

  // Inline Category Creator
  const handleInlineCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSubmittingCat(true);
    try {
      const createdId = await onCreateCategory(newCatName.trim(), null);
      if (createdId) {
        setCategoryId(createdId);
      }
      setNewCatName('');
      setIsCreatingCat(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Custom Data Handlers
  const handleAddCustomData = () => {
    const newField: CustomDataField = {
      id: `cd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      body: '',
    };
    setCustomData((prev) => [...prev, newField]);
  };

  const handleUpdateCustomData = (id: string, field: 'title' | 'body', value: string) => {
    setCustomData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleDeleteCustomData = (id: string) => {
    setCustomData((prev) => prev.filter((c) => c.id !== id));
  };

  // Copy Raw Tags
  const handleCopyTags = () => {
    if (!rawTags.trim()) return;
    navigator.clipboard.writeText(rawTags.trim());
    setTagsCopied(true);
    setTimeout(() => setTagsCopied(false), 2000);
  };

  // Parse raw tags into string array for search/filter indexing
  const parseTagsFromRaw = (raw: string): string[] => {
    if (!raw.trim()) return [];
    return raw
      .split(/[\n,]+/)
      .map((t) => t.trim().replace(/^#+/, '').trim())
      .filter((t) => t.length > 0);
  };

  // Word & character stats
  const scriptWordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const scriptCharCount = scriptText.length;
  const parsedTagCount = parseTagsFromRaw(rawTags).length;

  // Save handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const targetCatId = categoryId || categories[0]?.id || 'uncategorized';
      const parsedTags = parseTagsFromRaw(rawTags);

      const payload: Partial<ContentItem> = {
        title: title.trim(),
        script_text: scriptText.trim(),
        tags: parsedTags,
        raw_tags: rawTags,
        custom_data: customData.filter((c) => c.title.trim() || c.body.trim()),
        category_id: targetCatId,
        format,
        status,
        posted_to: status === 'posted' ? postedTo : [],
      };

      if (status === 'posted') {
        payload.posted_date = postedDate || new Date().toISOString().split('T')[0];
      }

      if (item?.id) {
        payload.id = item.id;
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Failed to save content item:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.colors.bgElevated,
          borderRadius: isFullscreen ? '0.75rem' : '1.25rem',
          boxShadow: theme.shadows.lg,
          border: `1px solid ${theme.colors.borderLight}`,
          maxWidth: isFullscreen ? '99vw' : '1180px',
          width: isFullscreen ? '99vw' : '96vw',
          height: isFullscreen ? '98vh' : '92vh',
        }}
        className="flex flex-col overflow-hidden shadow-2xl relative transition-all duration-200"
      >
        {/* Header Bar */}
        <div
          style={{
            borderBottom: `1px solid ${theme.colors.borderLight}`,
            backgroundColor: theme.colors.bgSecondary,
          }}
          className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-zinc-200/70 text-indigo-600 shrink-0">
              {format === 'long_form' ? (
                <Video className="w-4 h-4 text-blue-600" />
              ) : (
                <Smartphone className="w-4 h-4 text-purple-600" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 truncate">
                {item?.id ? 'Edit Content Studio Item' : 'New Content Item Studio'}
              </h2>
              <p className="text-[11px] text-zinc-500 truncate hidden sm:block">
                Broad scripting canvas, raw tags box & modular custom data cards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zen Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-white/80 transition-colors cursor-pointer border border-transparent hover:border-zinc-200"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Widescreen Studio'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <div className="w-px h-4 bg-zinc-300 mx-0.5" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-full cursor-pointer transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Broad Dual-Column Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* LEFT / PRIMARY COLUMN: SCRIPTING, TITLE & CATEGORY (7 of 12 cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-5">
              {/* Content Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Content Title / Video Topic *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5 Habits That Changed My Life (Full Breakdown)..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  style={{
                    color: theme.colors.textPrimary,
                  }}
                  className="w-full text-lg sm:text-xl font-extrabold placeholder:text-zinc-400 bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                />
              </div>

              {/* Format Toggle & Category Selector Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Format Switcher */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Content Format *
                  </label>
                  <div
                    style={{
                      backgroundColor: theme.colors.bgSecondary,
                      borderRadius: theme.radius.md,
                      border: `1px solid ${theme.colors.borderLight}`,
                    }}
                    className="grid grid-cols-2 p-1 gap-1 select-none"
                  >
                    <button
                      type="button"
                      onClick={() => setFormat('long_form')}
                      style={{
                        backgroundColor: format === 'long_form' ? '#FFFFFF' : 'transparent',
                        color: format === 'long_form' ? '#1D4ED8' : theme.colors.textMuted,
                        borderRadius: theme.radius.sm,
                        boxShadow: format === 'long_form' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        fontWeight: format === 'long_form' ? '700' : '500',
                        minHeight: '34px',
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs py-1.5 cursor-pointer transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Long Form</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormat('short_form')}
                      style={{
                        backgroundColor: format === 'short_form' ? '#FFFFFF' : 'transparent',
                        color: format === 'short_form' ? '#7C3AED' : theme.colors.textMuted,
                        borderRadius: theme.radius.sm,
                        boxShadow: format === 'short_form' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        fontWeight: format === 'short_form' ? '700' : '500',
                        minHeight: '34px',
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs py-1.5 cursor-pointer transition-all"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Short Form</span>
                    </button>
                  </div>
                </div>

                {/* 2. Category Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700">
                      Category *
                    </label>
                    {!isCreatingCat && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingCat(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New</span>
                      </button>
                    )}
                  </div>

                  {isCreatingCat ? (
                    <div className="flex items-center gap-1.5 p-1 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                      <input
                        type="text"
                        placeholder="Category name..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        autoFocus
                        className="flex-1 px-2.5 py-1 text-xs bg-white rounded-lg border border-indigo-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleInlineCreateCategory}
                        disabled={isSubmittingCat || !newCatName.trim()}
                        className="px-2 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isSubmittingCat ? '...' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCat(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: theme.colors.borderLight,
                        minHeight: '42px',
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-zinc-900 border rounded-xl focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          📁 {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 3. Expansive Script / Draft Body Canvas */}
              <div className="space-y-1.5 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Script, Outline & Draft Body</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    {scriptWordCount} words • {scriptCharCount} chars
                  </span>
                </div>

                {/* Detected Links Quick Access Bar (Always active when script contains links) */}
                {detectedScriptLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-wider pl-1 pr-1 shrink-0">
                      <Link2 className="w-3.5 h-3.5 text-[#2563eb]" />
                      <span>Links ({detectedScriptLinks.length}):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {detectedScriptLinks.map((link) => (
                        <LinkWithPreview
                          key={link.id}
                          url={link.url}
                          domain={link.domain}
                          path={link.path}
                          variant="badge"
                          stopPropagation={true}
                        >
                          <span className="max-w-[170px] truncate text-[#2563eb] font-bold">{link.domain}{link.path ? link.path.slice(0, 14) : ''}</span>
                        </LinkWithPreview>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative flex-1 flex flex-col">
                  <textarea
                    rows={isFullscreen ? 18 : 12}
                    placeholder="Draft your video hook, core message, talking points, full script, or captions here...&#10;&#10;✨ Smart Paste Active: Formatted headlines, bullet points, and AI responses are automatically preserved!"
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    onPaste={(e) => {
                      const result = detectAndConvertClipboard(e.clipboardData);
                      if (result.hasFormatting) {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const prev = scriptText;
                        const inserted = result.convertedText;
                        const updated = prev.substring(0, start) + inserted + prev.substring(end);
                        setScriptText(updated);
                        if (result.suggestedTitle && !title.trim()) {
                          setTitle(result.suggestedTitle);
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: theme.colors.borderLight,
                      color: theme.colors.textPrimary,
                    }}
                    className="w-full p-4 text-xs sm:text-sm leading-relaxed border rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y font-sans shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT / META COLUMN: STATUS, RAW TAGS BOX & CUSTOM DATA (5 of 12 cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-5 border-t lg:border-t-0 lg:border-l lg:pl-6 border-zinc-200">
              
              {/* Status Switcher & Publication Details */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-700">
                  Publication Status
                </label>
                <div
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.borderLight}`,
                  }}
                  className="grid grid-cols-3 p-1 gap-1 select-none text-center"
                >
                  {(['draft', 'ready', 'posted'] as ContentStatus[]).map((st) => {
                    const isCurrent = status === st;
                    const labels = { draft: 'Draft', ready: 'Ready', posted: 'Posted' };
                    const colors = {
                      draft: { text: '#92400E', bg: '#FFFBEB' },
                      ready: { text: '#3730A3', bg: '#EEF2FF' },
                      posted: { text: '#065F46', bg: '#ECFDF5' },
                    };
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(st)}
                        style={{
                          backgroundColor: isCurrent ? colors[st].bg : 'transparent',
                          color: isCurrent ? colors[st].text : theme.colors.textMuted,
                          fontWeight: isCurrent ? '700' : '400',
                          borderRadius: theme.radius.sm,
                          minHeight: '32px',
                        }}
                        className="text-xs py-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        {labels[st]}
                      </button>
                    );
                  })}
                </div>

                {/* Published Details if posted */}
                {status === 'posted' && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Published Platforms & Date</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['youtube', 'tiktok', 'facebook', 'instagram'] as PostedPlatform[]).map((p) => {
                        const isChecked = postedTo.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePlatform(p)}
                            className={`px-2.5 py-1 text-[11px] rounded-full font-semibold border cursor-pointer capitalize transition-all ${
                              isChecked
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="text-[11px] font-semibold text-emerald-800">Date:</span>
                      <input
                        type="date"
                        value={postedDate}
                        onChange={(e) => setPostedDate(e.target.value)}
                        className="px-2 py-1 text-xs bg-white rounded-lg border border-emerald-300 text-emerald-900 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* RAW TAGS BOX (No comma separated column, empty formatted box for raw data) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Raw Tags & Keywords Box</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {parsedTagCount > 0 && (
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {parsedTagCount} {parsedTagCount === 1 ? 'tag' : 'tags'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyTags}
                      disabled={!rawTags.trim()}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 shadow-2xs"
                      title="Copy raw tags to clipboard"
                    >
                      {tagsCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-500" />
                          <span>Copy Tags</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  placeholder="Paste tags raw here (e.g. comma-separated, #hashtags, newline lists, or YouTube SEO tags)..."
                  value={rawTags}
                  onChange={(e) => setRawTags(e.target.value)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: theme.colors.borderLight,
                    color: theme.colors.textPrimary,
                  }}
                  className="w-full p-3 text-xs leading-relaxed border rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono resize-y shadow-2xs"
                />
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Paste raw tags directly in any format. We keep your exact text and index them automatically.
                </p>
              </div>

              {/* CUSTOM DATA SECTION (Title & Body cards with "+ Add Custom Data") */}
              <div className="space-y-3 pt-2 border-t border-zinc-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-zinc-800">Custom Data & Notes</span>
                    {customData.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                        {customData.length}
                      </span>
                    )}
                  </div>

                  {/* PROMINENT "+ Add Custom Data" BUTTON */}
                  <button
                    type="button"
                    onClick={handleAddCustomData}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/90 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Add Custom Data</span>
                  </button>
                </div>

                {/* Custom Data Card List */}
                {customData.length === 0 ? (
                  <div
                    onClick={handleAddCustomData}
                    className="p-4 rounded-xl border border-dashed border-zinc-300 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/20 text-center cursor-pointer transition-colors space-y-1"
                  >
                    <p className="text-xs font-medium text-zinc-600">
                      No custom data added yet.
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Click <span className="font-semibold text-indigo-600">+ Add Custom Data</span> to attach hooks, thumbnail prompts, sponsor notes, or research links.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {customData.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-zinc-200/90 bg-white shadow-2xs space-y-2 relative group hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder={`Custom Data Title (e.g. Thumbnail Prompt, Hook Option ${idx + 1})...`}
                            value={item.title}
                            onChange={(e) => handleUpdateCustomData(item.id, 'title', e.target.value)}
                            className="w-full text-xs font-bold text-zinc-900 bg-transparent placeholder:text-zinc-400 focus:outline-none border-b border-zinc-100 pb-1 focus:border-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomData(item.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Delete this custom data block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          placeholder="Body: Details, prompts, talking points, markdown, or links..."
                          value={item.body}
                          onChange={(e) => handleUpdateCustomData(item.id, 'body', e.target.value)}
                          onPaste={(e) => {
                            const result = detectAndConvertClipboard(e.clipboardData);
                            if (result.hasFormatting) {
                              e.preventDefault();
                              const textarea = e.currentTarget;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const prev = item.body;
                              const inserted = result.convertedText;
                              const updated = prev.substring(0, start) + inserted + prev.substring(end);
                              handleUpdateCustomData(item.id, 'body', updated);
                              if (result.suggestedTitle && !item.title.trim()) {
                                handleUpdateCustomData(item.id, 'title', result.suggestedTitle);
                              }
                            }
                          }}
                          className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white resize-y font-sans leading-relaxed text-zinc-800"
                        />

                        {/* Detected links in custom data block */}
                        {extractAllLinks(item.body).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {extractAllLinks(item.body).map((link) => (
                              <LinkWithPreview
                                key={link.id}
                                url={link.url}
                                domain={link.domain}
                                path={link.path}
                                variant="badge"
                                stopPropagation={true}
                              >
                                <span className="max-w-[150px] truncate text-[#2563eb] font-bold">{link.domain}</span>
                              </LinkWithPreview>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </form>

        {/* Footer: Delete (if editing), Cancel & Save buttons */}
        <div
          style={{
            borderTop: `1px solid ${theme.colors.borderLight}`,
            backgroundColor: theme.colors.bgSecondary,
          }}
          className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0"
        >
          {item?.id && onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete content "${title || 'Untitled'}"?`)) {
                  onDelete(item.id!);
                  onClose();
                }
              }}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium cursor-pointer transition-colors flex items-center gap-1 border border-transparent hover:border-red-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Content</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 cursor-pointer font-medium text-zinc-700 transition-all shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !title.trim()}
              style={{
                backgroundColor: theme.colors.accent,
                color: theme.colors.accentText,
                borderRadius: theme.radius.md,
                minHeight: '36px',
              }}
              className="px-5 py-2 text-xs rounded-xl font-semibold cursor-pointer disabled:opacity-50 hover:opacity-90 shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Content Item'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
