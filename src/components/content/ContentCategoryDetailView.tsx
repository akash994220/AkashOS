import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { ContentCategory, ContentItem, ContentFormat } from '../../types/content';
import { ContentCard } from './ContentCard';
import { 
  ArrowLeft, 
  Plus, 
  Folder, 
  Video, 
  Smartphone, 
  Layers, 
  Search, 
  ChevronRight,
  Sparkles,
  FileQuestion,
  Filter
} from 'lucide-react';

interface ContentCategoryDetailViewProps {
  category: ContentCategory;
  allCategories: ContentCategory[];
  items: ContentItem[];
  onBack: () => void;
  onSelectCategory: (categoryId: string) => void;
  onNewContent: (format: ContentFormat, categoryId: string) => void;
  onEditItem: (item: ContentItem) => void;
  onStatusCycle: (item: ContentItem) => void;
  onDuplicateItem: (item: ContentItem) => void;
  onDeleteItem: (itemId: string) => void;
}

export const ContentCategoryDetailView: React.FC<ContentCategoryDetailViewProps> = ({
  category,
  allCategories,
  items,
  onBack,
  onSelectCategory,
  onNewContent,
  onEditItem,
  onStatusCycle,
  onDuplicateItem,
  onDeleteItem,
}) => {
  const { theme } = useTheme();
  const [activeFormat, setActiveFormat] = useState<ContentFormat>('long_form');
  const [searchQuery, setSearchQuery] = useState('');

  // Items inside this category
  const categoryItems = items.filter((it) => it.category_id === category.id);
  const longItems = categoryItems.filter((it) => it.format === 'long_form');
  const shortItems = categoryItems.filter((it) => it.format === 'short_form');

  // Sub-categories nested under this category (IdeaFolder pattern)
  const childCategories = allCategories.filter((c) => c.parent_category_id === category.id);

  // Active items matching current format and search
  const displayedItems = (activeFormat === 'long_form' ? longItems : shortItems).filter((it) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (it.title || '').toLowerCase().includes(q);
    const scriptMatch = (it.script_text || '').toLowerCase().includes(q);
    const tagMatch = (it.tags || []).some((t) => t.toLowerCase().includes(q));
    return titleMatch || scriptMatch || tagMatch;
  });

  // Parent category if nested
  const parentCategory = category.parent_category_id
    ? allCategories.find((c) => c.id === category.parent_category_id)
    : null;

  return (
    <div className="space-y-4">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold flex-wrap">
          <button
            onClick={onBack}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.md,
              minHeight: '32px',
            }}
            className="px-2.5 py-1 text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>

          {parentCategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              <button
                onClick={() => onSelectCategory(parentCategory.id)}
                className="text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                {parentCategory.name}
              </button>
            </>
          )}

          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900 flex items-center gap-1">
            <Folder className="w-4 h-4 text-indigo-500" />
            <span>{category.name}</span>
          </span>
        </div>

        {/* Action: New Content */}
        <button
          type="button"
          onClick={() => onNewContent(activeFormat, category.id)}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.md,
            minHeight: '36px',
          }}
          className="px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New {activeFormat === 'long_form' ? 'Long Form' : 'Short Form'}</span>
        </button>
      </div>

      {/* Nested Sub-categories Strip (if any) */}
      {childCategories.length > 0 && (
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.md,
          }}
          className="p-2.5 border flex items-center gap-2 flex-wrap text-xs shadow-2xs"
        >
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">
            Sub-categories:
          </span>
          {childCategories.map((subcat) => (
            <button
              key={subcat.id}
              onClick={() => onSelectCategory(subcat.id)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.sm,
              }}
              className="px-2.5 py-1 text-xs hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer font-medium border border-zinc-200/60"
            >
              <Folder className="w-3 h-3 text-indigo-500" />
              <span>{subcat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Two-Tab Switcher: Long Form / Short Form (fixed-width, no horizontal scroll) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
          }}
          className="w-full sm:w-80 grid grid-cols-2 p-1 gap-1 select-none shadow-2xs"
        >
          {/* Long Form Tab */}
          <button
            type="button"
            onClick={() => setActiveFormat('long_form')}
            style={{
              backgroundColor: activeFormat === 'long_form' ? theme.colors.bgCard : 'transparent',
              color: activeFormat === 'long_form' ? theme.colors.textPrimary : theme.colors.textMuted,
              borderRadius: theme.radius.md,
              boxShadow: activeFormat === 'long_form' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: activeFormat === 'long_form' ? '600' : '400',
              minHeight: '34px',
            }}
            className="flex items-center justify-center gap-1.5 text-xs py-1.5 transition-all cursor-pointer"
          >
            <Video className="w-3.5 h-3.5 text-blue-600" />
            <span>Long Form</span>
            <span
              style={{
                backgroundColor: activeFormat === 'long_form' ? '#EFF6FF' : 'rgba(0,0,0,0.05)',
                color: activeFormat === 'long_form' ? '#1D4ED8' : theme.colors.textMuted,
              }}
              className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
            >
              {longItems.length}
            </span>
          </button>

          {/* Short Form Tab */}
          <button
            type="button"
            onClick={() => setActiveFormat('short_form')}
            style={{
              backgroundColor: activeFormat === 'short_form' ? theme.colors.bgCard : 'transparent',
              color: activeFormat === 'short_form' ? theme.colors.textPrimary : theme.colors.textMuted,
              borderRadius: theme.radius.md,
              boxShadow: activeFormat === 'short_form' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: activeFormat === 'short_form' ? '600' : '400',
              minHeight: '34px',
            }}
            className="flex items-center justify-center gap-1.5 text-xs py-1.5 transition-all cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-600" />
            <span>Short Form</span>
            <span
              style={{
                backgroundColor: activeFormat === 'short_form' ? '#FAF5FF' : 'rgba(0,0,0,0.05)',
                color: activeFormat === 'short_form' ? '#7E22CE' : theme.colors.textMuted,
              }}
              className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
            >
              {shortItems.length}
            </span>
          </button>
        </div>

        {/* Inline Search in Category */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.md,
          }}
          className="flex items-center gap-2 px-2.5 py-1 border text-xs sm:w-64 shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder={`Search ${activeFormat === 'long_form' ? 'long form' : 'shorts'} in this category...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full focus:outline-none text-xs text-zinc-900 placeholder:text-zinc-400 py-1"
          />
        </div>
      </div>

      {/* Content Cards Grid */}
      {displayedItems.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="text-center py-12 px-4 border space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mx-auto">
            {activeFormat === 'long_form' ? (
              <Video className="w-5 h-5 text-blue-500" />
            ) : (
              <Smartphone className="w-5 h-5 text-purple-500" />
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-800">
              {searchQuery
                ? 'No matching content found'
                : `No ${activeFormat === 'long_form' ? 'Long Form' : 'Short Form'} content yet`}
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different keyword or clear your search input.'
                : `Start outlining a new ${activeFormat === 'long_form' ? 'video/script' : 'short, reel, or story'} in ${category.name}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNewContent(activeFormat, category.id)}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '34px',
            }}
            className="px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create {activeFormat === 'long_form' ? 'Long Form' : 'Short Form'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              categoryName={category.name}
              onEdit={onEditItem}
              onStatusCycle={onStatusCycle}
              onDuplicate={onDuplicateItem}
              onDelete={onDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};
