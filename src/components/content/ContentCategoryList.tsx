import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { ContentCategory, ContentItem } from '../../types/content';
import { 
  Folder, 
  FolderPlus, 
  Layers, 
  Video, 
  Smartphone, 
  FileEdit, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  Plus, 
  X, 
  Sparkles,
  ArrowRight,
  FolderTree
} from 'lucide-react';

interface ContentCategoryListProps {
  categories: ContentCategory[];
  items: ContentItem[];
  currentParentId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onSelectParent: (parentId: string | null) => void;
  onCreateCategory: (name: string, parentCategoryId: string | null) => Promise<string | void>;
  onUpdateCategory: (categoryId: string, name: string, parentCategoryId: string | null) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onViewAll: () => void;
}

export const ContentCategoryList: React.FC<ContentCategoryListProps> = ({
  categories,
  items,
  currentParentId,
  onSelectCategory,
  onSelectParent,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onViewAll,
}) => {
  const { theme } = useTheme();

  // Create / Edit Category Modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group items by category
  const statsByCategory = categories.reduce((acc, cat) => {
    const catItems = items.filter((it) => it.category_id === cat.id);
    const longCount = catItems.filter((it) => it.format === 'long_form').length;
    const shortCount = catItems.filter((it) => it.format === 'short_form').length;
    const draftCount = catItems.filter((it) => it.status === 'draft').length;
    const totalCount = catItems.length;

    acc[cat.id] = { longCount, shortCount, draftCount, totalCount };
    return acc;
  }, {} as Record<string, { longCount: number; shortCount: number; draftCount: number; totalCount: number }>);

  // Global counts for "All Content"
  const totalLongCount = items.filter((it) => it.format === 'long_form').length;
  const totalShortCount = items.filter((it) => it.format === 'short_form').length;
  const totalDraftCount = items.filter((it) => it.status === 'draft').length;

  // Filter categories by current parent level (nested folder pattern like IdeaFolder)
  const currentParentCategory = currentParentId
    ? categories.find((c) => c.id === currentParentId)
    : null;

  const visibleCategories = categories.filter((c) => {
    if (currentParentId === null) {
      // Top-level categories: parent_category_id is null or not found
      return !c.parent_category_id || !categories.some((p) => p.id === c.parent_category_id);
    }
    return c.parent_category_id === currentParentId;
  });

  const openCreateModal = (parent?: string | null) => {
    setEditingCategory(null);
    setCategoryName('');
    setParentCategoryId(parent !== undefined ? parent : currentParentId);
    setShowCategoryModal(true);
  };

  const openEditModal = (cat: ContentCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setParentCategoryId(cat.parent_category_id);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, categoryName.trim(), parentCategoryId);
      } else {
        await onCreateCategory(categoryName.trim(), parentCategoryId);
      }
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find child count for nesting badge
  const getSubcategoryCount = (catId: string) => {
    return categories.filter((c) => c.parent_category_id === catId).length;
  };

  return (
    <div className="space-y-4">
      {/* Header bar & Breadcrumbs if navigated inside a parent category */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-semibold">
          <button
            onClick={() => onSelectParent(null)}
            className={`cursor-pointer transition-colors flex items-center gap-1.5 ${
              currentParentId === null ? 'font-bold text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <FolderTree className="w-4 h-4 text-zinc-500" />
            <span>Categories</span>
          </button>

          {currentParentCategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-bold text-zinc-900 flex items-center gap-1">
                <Folder className="w-4 h-4 text-indigo-500" />
                <span>{currentParentCategory.name}</span>
              </span>
            </>
          )}

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium ml-1">
            {visibleCategories.length} {visibleCategories.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewAll}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              color: theme.colors.textPrimary,
              minHeight: '34px',
            }}
            className="px-3 py-1.5 text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span>All Content ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal(currentParentId)}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '34px',
            }}
            className="px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{currentParentId ? 'New Sub-Category' : 'New Category'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Categories (Replaces old platform tabs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. Global "All Content" quick overview card */}
        {currentParentId === null && (
          <div
            onClick={onViewAll}
            style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderLight,
              borderRadius: theme.radius.lg,
            }}
            className="p-4 border transition-all hover:border-zinc-400 cursor-pointer shadow-xs group flex flex-col justify-between select-none relative bg-gradient-to-br from-indigo-50/40 via-transparent to-transparent"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  borderRadius: theme.radius.md,
                }}
                className="w-9 h-9 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform"
              >
                <Layers className="w-4 h-4" />
              </div>

              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {items.length} total items
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                <span>All Content Vault</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">
                Full search, multi-filters by category, format, tag, & status
              </p>
            </div>

            {/* Counts breakdown row */}
            <div
              style={{
                borderTop: `1px solid ${theme.colors.borderLight}`,
                paddingTop: theme.spacing.sm,
              }}
              className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-[11px]"
            >
              <div className="p-1 rounded bg-blue-50/70 border border-blue-100">
                <span className="text-blue-800 font-bold block">{totalLongCount}</span>
                <span className="text-blue-600 text-[10px]">Long Form</span>
              </div>
              <div className="p-1 rounded bg-purple-50/70 border border-purple-100">
                <span className="text-purple-800 font-bold block">{totalShortCount}</span>
                <span className="text-purple-600 text-[10px]">Short Form</span>
              </div>
              <div className="p-1 rounded bg-amber-50/70 border border-amber-100">
                <span className="text-amber-800 font-bold block">{totalDraftCount}</span>
                <span className="text-amber-600 text-[10px]">Drafts</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Category Cards */}
        {visibleCategories.map((category) => {
          const stats = statsByCategory[category.id] || { longCount: 0, shortCount: 0, draftCount: 0, totalCount: 0 };
          const subcatCount = getSubcategoryCount(category.id);

          return (
            <div
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-4 border transition-all hover:border-zinc-400 cursor-pointer shadow-xs group flex flex-col justify-between select-none relative"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      backgroundColor: theme.colors.bgSecondary,
                      color: theme.colors.textPrimary,
                      borderRadius: theme.radius.md,
                    }}
                    className="w-9 h-9 flex items-center justify-center shadow-2xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"
                  >
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 truncate max-w-[150px] sm:max-w-[180px]">
                      {category.name}
                    </h3>
                    {subcatCount > 0 && (
                      <span className="text-[10px] text-indigo-600 font-medium">
                        {subcatCount} {subcatCount === 1 ? 'sub-category' : 'sub-categories'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit & Delete actions */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => openEditModal(category, e)}
                    title="Edit Category"
                    style={{ minHeight: '28px', minWidth: '28px' }}
                    className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete category "${category.name}"? Items inside will become Uncategorized.`
                        )
                      ) {
                        onDeleteCategory(category.id);
                      }
                    }}
                    title="Delete Category"
                    style={{ minHeight: '28px', minWidth: '28px' }}
                    className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Counts requested by prompt: name, long-form count, short-form count, and draft count */}
              <div
                style={{
                  borderTop: `1px solid ${theme.colors.borderLight}`,
                  paddingTop: theme.spacing.sm,
                  marginTop: theme.spacing.md,
                }}
                className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-[11px]"
              >
                <div className="p-1 rounded bg-blue-50/70 border border-blue-100">
                  <span className="text-blue-800 font-bold block">{stats.longCount}</span>
                  <span className="text-blue-600 text-[10px]">Long Form</span>
                </div>
                <div className="p-1 rounded bg-purple-50/70 border border-purple-100">
                  <span className="text-purple-800 font-bold block">{stats.shortCount}</span>
                  <span className="text-purple-600 text-[10px]">Short Form</span>
                </div>
                <div className="p-1 rounded bg-amber-50/70 border border-amber-100">
                  <span className="text-amber-800 font-bold block">{stats.draftCount}</span>
                  <span className="text-amber-600 text-[10px]">Drafts</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. New Category Card */}
        <button
          type="button"
          onClick={() => openCreateModal(currentParentId)}
          style={{
            borderRadius: theme.radius.lg,
            border: `1.5px dashed ${theme.colors.borderLight}`,
            backgroundColor: 'transparent',
          }}
          className="p-6 flex flex-col items-center justify-center text-center gap-2 hover:border-zinc-400 hover:bg-zinc-50/60 transition-all cursor-pointer min-h-[140px] group"
        >
          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-800 transition-colors">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-700 group-hover:text-zinc-900 block">
              {currentParentId ? 'Create Sub-Category' : 'Create New Category'}
            </span>
            <span className="text-[10px] text-zinc-400">
              Organize video & post concepts
            </span>
          </div>
        </button>
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.lg,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '420px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: theme.colors.textPrimary }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tutorials, Tech Reviews, Lifestyle"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderColor: theme.colors.borderLight,
                    borderRadius: theme.radius.md,
                    color: theme.colors.textPrimary,
                    minHeight: '38px',
                  }}
                  className="w-full px-3 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Optional Parent Category Picker (Hierarchy Nesting) */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: theme.colors.textPrimary }}>
                  Parent Category (Optional Nesting)
                </label>
                <select
                  value={parentCategoryId || ''}
                  onChange={(e) => setParentCategoryId(e.target.value || null)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderColor: theme.colors.borderLight,
                    borderRadius: theme.radius.md,
                    color: theme.colors.textPrimary,
                    minHeight: '38px',
                  }}
                  className="w-full px-3 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent_category_id ? '  ↳ ' : ''}{c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Nest sub-categories under main categories just like folders.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    color: theme.colors.textPrimary,
                    borderRadius: theme.radius.md,
                    minHeight: '36px',
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !categoryName.trim()}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '36px',
                  }}
                  className="px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:opacity-90 shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
