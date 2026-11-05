import React, { useState, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { ContentItem, ContentCategory, ContentFormat, ContentStatus } from '../../types/content';
import { ContentCard } from './ContentCard';
import { 
  Search, 
  Filter, 
  ArrowLeft, 
  Plus, 
  X, 
  Tag as TagIcon, 
  Layers, 
  CheckCircle2, 
  Video, 
  Smartphone,
  Folder
} from 'lucide-react';

interface AllContentSearchFilterViewProps {
  items: ContentItem[];
  categories: ContentCategory[];
  onBackToCategories: () => void;
  onNewContent: () => void;
  onEditItem: (item: ContentItem) => void;
  onStatusCycle: (item: ContentItem) => void;
  onDuplicateItem: (item: ContentItem) => void;
  onDeleteItem: (itemId: string) => void;
}

export const AllContentSearchFilterView: React.FC<AllContentSearchFilterViewProps> = ({
  items,
  categories,
  onBackToCategories,
  onNewContent,
  onEditItem,
  onStatusCycle,
  onDuplicateItem,
  onDeleteItem,
}) => {
  const { theme } = useTheme();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ContentStatus | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Category name map
  const categoryMap = useMemo(() => {
    return categories.reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  // Extract all unique tags across items
  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      (it.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const scriptMatch = (item.script_text || '').toLowerCase().includes(q);
        const tagMatch = (item.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !scriptMatch && !tagMatch) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }

      // 3. Format filter
      if (selectedFormat !== 'all' && item.format !== selectedFormat) {
        return false;
      }

      // 4. Status filter
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }

      // 5. Tag filter
      if (selectedTag !== 'all' && !(item.tags || []).includes(selectedTag)) {
        return false;
      }

      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedFormat, selectedStatus, selectedTag]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedFormat !== 'all' ||
    selectedStatus !== 'all' ||
    selectedTag !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedFormat('all');
    setSelectedStatus('all');
    setSelectedTag('all');
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToCategories}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.md,
              minHeight: '32px',
            }}
            className="px-2.5 py-1 text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>

          <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>All Content Vault</span>
          </span>

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
            {filteredItems.length} of {items.length} items
          </span>
        </div>

        <button
          type="button"
          onClick={onNewContent}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.md,
            minHeight: '36px',
          }}
          className="px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Content Item</span>
        </button>
      </div>

      {/* Global Filter & Search Control Panel */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-3.5 sm:p-4 border space-y-3 shadow-xs"
      >
        {/* Search Bar */}
        <div
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.md,
          }}
          className="flex items-center gap-2 px-3 py-1.5 border text-xs shadow-2xs"
        >
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search all content titles, scripts, talking points, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full focus:outline-none text-xs text-zinc-900 placeholder:text-zinc-400 py-1"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 4-Way Multi-Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* 1. Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.md,
                color: theme.colors.textPrimary,
                minHeight: '34px',
              }}
              className="w-full px-2.5 py-1 text-xs border focus:outline-none"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Format Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Filter by Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as any)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.md,
                color: theme.colors.textPrimary,
                minHeight: '34px',
              }}
              className="w-full px-2.5 py-1 text-xs border focus:outline-none"
            >
              <option value="all">All Formats</option>
              <option value="long_form">Long Form (Video / Article)</option>
              <option value="short_form">Short Form (Shorts / Reels)</option>
            </select>
          </div>

          {/* 3. Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Filter by Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.md,
                color: theme.colors.textPrimary,
                minHeight: '34px',
              }}
              className="w-full px-2.5 py-1 text-xs border focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Drafts Only</option>
              <option value="ready">Ready to Record/Produce</option>
              <option value="posted">Posted & Published</option>
            </select>
          </div>

          {/* 4. Tag Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Filter by Tag
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.md,
                color: theme.colors.textPrimary,
                minHeight: '34px',
              }}
              className="w-full px-2.5 py-1 text-xs border focus:outline-none"
            >
              <option value="all">All Tags ({allTags.length})</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters bar if active */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
            <span>
              Showing {filteredItems.length} matching {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
            <button
              onClick={clearAllFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Content Items Grid */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="text-center py-12 px-4 border space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mx-auto">
            <Filter className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-800">
              No content matches your filters
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-500 max-w-sm mx-auto">
              Try adjusting your category, format, or search terms, or reset filters to see all content.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                minHeight: '34px',
              }}
              className="px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-200 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              categoryName={categoryMap[item.category_id] || 'Uncategorized'}
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
