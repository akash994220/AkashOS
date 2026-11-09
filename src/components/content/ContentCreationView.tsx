import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
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
import { ContentCategory, ContentItem, ContentFormat, ContentStatus } from '../../types/content';
import { ContentCategoryList } from './ContentCategoryList';
import { ContentCategoryDetailView } from './ContentCategoryDetailView';
import { AllContentSearchFilterView } from './AllContentSearchFilterView';
import { ContentDashboard } from './ContentDashboard';
import { ContentModal } from './ContentModal';
import { ContentTreeStudio } from './tree/ContentTreeStudio';
import { runContentMigration } from '../../lib/contentMigration';
import { 
  Plus, 
  FolderTree, 
  Layers, 
  BarChart3, 
  Sparkles,
  RefreshCw,
  GitBranch,
  Network
} from 'lucide-react';

export const ContentCreationView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Data State
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'categories' | 'all' | 'tree' | 'analytics'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ContentItem> | null>(null);
  const [modalInitialFormat, setModalInitialFormat] = useState<ContentFormat>('long_form');
  const [modalInitialCategory, setModalInitialCategory] = useState<string>('');

  // 1. One-time legacy migration check
  useEffect(() => {
    if (!user) return;
    runContentMigration(user.uid).then(({ migratedCount }) => {
      if (migratedCount > 0) {
        console.log(`Successfully migrated ${migratedCount} legacy content items to format & category model.`);
      }
    });
  }, [user]);

  // 2. Real-time Firestore subscriptions for Categories
  useEffect(() => {
    if (!user || !db) return;

    const qCat = query(collection(db, 'content_categories'), where('owner_uid', '==', user.uid));
    const unsubCat = onSnapshot(
      qCat,
      (snap) => {
        const catList: ContentCategory[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            owner_uid: data.owner_uid,
            name: data.name,
            parent_category_id: data.parent_category_id || null,
            created_at: data.created_at || new Date().toISOString(),
          };
        });
        // Sort by name
        catList.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(catList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'content_categories');
      }
    );

    return () => unsubCat();
  }, [user]);

  // 3. Real-time Firestore subscriptions for Content Items
  useEffect(() => {
    if (!user || !db) return;

    const qItems = query(collection(db, 'content_items'), where('owner_uid', '==', user.uid));
    const unsubItems = onSnapshot(
      qItems,
      (snap) => {
        const itemList: ContentItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            owner_uid: data.owner_uid,
            category_id: data.category_id,
            format: data.format || 'long_form',
            title: data.title || '',
            script_text: data.script_text || '',
            tags: data.tags || [],
            raw_tags: data.raw_tags || '',
            custom_data: data.custom_data || [],
            status: data.status || 'draft',
            posted_to: data.posted_to || [],
            posted_date: data.posted_date,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
          };
        });
        // Sort by updated_at descending
        itemList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setItems(itemList);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'content_items');
        setLoading(false);
      }
    );

    return () => unsubItems();
  }, [user]);

  // Extract all existing tags across all content for autocomplete
  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      (it.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [items]);

  // Category Actions
  const handleCreateCategory = async (name: string, parentCategoryId: string | null): Promise<string | void> => {
    if (!user || !name.trim()) return;
    const docId = `cat_${Date.now()}`;
    const newCategory: ContentCategory = {
      id: docId,
      owner_uid: user.uid,
      name: name.trim(),
      parent_category_id: parentCategoryId || null,
      created_at: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'content_categories', docId), newCategory);
      return docId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_categories/${docId}`);
    }
  };

  const handleUpdateCategory = async (id: string, name: string, parentCategoryId: string | null) => {
    if (!user || !name.trim()) return;
    try {
      await updateDoc(doc(db, 'content_categories', id), {
        name: name.trim(),
        parent_category_id: parentCategoryId || null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `content_categories/${id}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'content_categories', id));
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
      if (currentParentId === id) {
        setCurrentParentId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `content_categories/${id}`);
    }
  };

  // Content Item CRUD
  const handleSaveItem = async (itemData: Partial<ContentItem>) => {
    if (!user) return;
    const docId = itemData.id || `item_${Date.now()}`;
    const payload: ContentItem = {
      id: docId,
      owner_uid: user.uid,
      category_id: itemData.category_id || categories[0]?.id || 'uncategorized',
      format: itemData.format || 'long_form',
      title: itemData.title || '',
      script_text: itemData.script_text || '',
      tags: itemData.tags || [],
      raw_tags: itemData.raw_tags || '',
      custom_data: itemData.custom_data || [],
      status: itemData.status || 'draft',
      posted_to: itemData.posted_to || [],
      created_at: itemData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (itemData.posted_date) {
      payload.posted_date = itemData.posted_date;
    }

    try {
      await setDoc(doc(db, 'content_items', docId), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `content_items/${docId}`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'content_items', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `content_items/${itemId}`);
    }
  };

  // Tap status pill to cycle draft -> ready -> posted
  const handleStatusCycle = async (item: ContentItem) => {
    if (!user) return;
    let nextStatus: ContentStatus = 'draft';
    if (item.status === 'draft') nextStatus = 'ready';
    else if (item.status === 'ready') nextStatus = 'posted';
    else if (item.status === 'posted') nextStatus = 'draft';

    const updates: Partial<ContentItem> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'posted' && !item.posted_date) {
      updates.posted_date = new Date().toISOString().split('T')[0];
    }

    try {
      await updateDoc(doc(db, 'content_items', item.id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `content_items/${item.id}`);
    }
  };

  // Duplicate: Long-press a content card -> "Duplicate" (new item, same category + format, empty title/script)
  const handleDuplicate = async (sourceItem: ContentItem) => {
    if (!user) return;
    const newDocId = `item_${Date.now()}`;
    const duplicatedPayload: ContentItem = {
      id: newDocId,
      owner_uid: user.uid,
      category_id: sourceItem.category_id,
      format: sourceItem.format,
      title: '', // Empty title as requested
      script_text: '', // Empty script as requested
      tags: [...(sourceItem.tags || [])], // Preserve tags
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'content_items', newDocId), duplicatedPayload);
      // Immediately open modal for newly duplicated item so user can name it
      setEditingItem(duplicatedPayload);
      setModalInitialFormat(duplicatedPayload.format);
      setModalInitialCategory(duplicatedPayload.category_id);
      setIsModalOpen(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `content_items/${newDocId}`);
    }
  };

  // Open modal for new item
  const handleOpenNewModal = (format?: ContentFormat, catId?: string) => {
    setEditingItem(null);
    setModalInitialFormat(format || 'long_form');
    setModalInitialCategory(catId || selectedCategoryId || categories[0]?.id || '');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (item: ContentItem) => {
    setEditingItem(item);
    setModalInitialFormat(item.format);
    setModalInitialCategory(item.category_id);
    setIsModalOpen(true);
  };

  // Currently selected category object (if in detail view)
  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId) || null
    : null;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Content Studio
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Format & category-based production pipeline for Long Form & Short Form content
          </p>
        </div>

        {/* Global New Content Button */}
        <button
          id="add-content-item-btn"
          type="button"
          onClick={() => handleOpenNewModal()}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.md,
            minHeight: '38px',
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold cursor-pointer shadow-xs hover:opacity-90 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Content Item</span>
        </button>
      </div>

      {/* Main Mode Navigation: Categories | All Content | Overview (Replaces platform tabs) */}
      <div
        style={{
          borderBottom: `1px solid ${theme.colors.borderLight}`,
        }}
        className="flex items-center gap-2 pb-1 select-none overflow-x-auto"
      >
        {/* Categories Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('categories');
            setSelectedCategoryId(null);
          }}
          style={{
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            borderBottom: activeTab === 'categories' ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
            color: activeTab === 'categories' ? theme.colors.textPrimary : theme.colors.textMuted,
            fontWeight: activeTab === 'categories' ? '600' : '400',
            minHeight: '38px',
          }}
          className="px-3.5 py-1.5 text-xs sm:text-sm cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <FolderTree className="w-4 h-4 text-indigo-500" />
          <span>Categories</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-600 font-bold ml-0.5">
            {categories.length}
          </span>
        </button>

        {/* All Content Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            borderBottom: activeTab === 'all' ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
            color: activeTab === 'all' ? theme.colors.textPrimary : theme.colors.textMuted,
            fontWeight: activeTab === 'all' ? '600' : '400',
            minHeight: '38px',
          }}
          className="px-3.5 py-1.5 text-xs sm:text-sm cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Layers className="w-4 h-4 text-blue-500" />
          <span>All Content</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-600 font-bold ml-0.5">
            {items.length}
          </span>
        </button>

        {/* Idea Tree Tab (New Feature) */}
        <button
          type="button"
          onClick={() => setActiveTab('tree')}
          style={{
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            borderBottom: activeTab === 'tree' ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
            color: activeTab === 'tree' ? theme.colors.textPrimary : theme.colors.textMuted,
            fontWeight: activeTab === 'tree' ? '600' : '400',
            minHeight: '38px',
          }}
          className="px-3.5 py-1.5 text-xs sm:text-sm cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Network className="w-4 h-4 text-purple-600" />
          <span>Idea Tree</span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 font-bold ml-0.5">
            Branches
          </span>
        </button>

        {/* Analytics & Metrics Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          style={{
            borderRadius: `${theme.radius.md} ${theme.radius.md} 0 0`,
            borderBottom: activeTab === 'analytics' ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
            color: activeTab === 'analytics' ? theme.colors.textPrimary : theme.colors.textMuted,
            fontWeight: activeTab === 'analytics' ? '600' : '400',
            minHeight: '38px',
          }}
          className="px-3.5 py-1.5 text-xs sm:text-sm cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          <span>Overview & Stats</span>
        </button>
      </div>

      {/* Main Views Rendering */}
      {activeTab === 'categories' && (
        <>
          {selectedCategory ? (
            /* Category Detail View: Long Form / Short Form tabs + Content Cards */
            <ContentCategoryDetailView
              category={selectedCategory}
              allCategories={categories}
              items={items}
              onBack={() => setSelectedCategoryId(null)}
              onSelectCategory={(catId) => setSelectedCategoryId(catId)}
              onNewContent={(fmt, catId) => handleOpenNewModal(fmt, catId)}
              onEditItem={handleOpenEditModal}
              onStatusCycle={handleStatusCycle}
              onDuplicateItem={handleDuplicate}
              onDeleteItem={handleDeleteItem}
            />
          ) : (
            /* Category List View (replaces platform tabs): each card shows name, long-form count, short-form count, and draft count */
            <ContentCategoryList
              categories={categories}
              items={items}
              currentParentId={currentParentId}
              onSelectCategory={(catId) => setSelectedCategoryId(catId)}
              onSelectParent={(parentId) => setCurrentParentId(parentId)}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onViewAll={() => setActiveTab('all')}
            />
          )}
        </>
      )}

      {activeTab === 'all' && (
        /* Global "All Content" search/filter view: filter by category, format, status, or tag across everything */
        <AllContentSearchFilterView
          items={items}
          categories={categories}
          onBackToCategories={() => {
            setActiveTab('categories');
            setSelectedCategoryId(null);
          }}
          onNewContent={() => handleOpenNewModal()}
          onEditItem={handleOpenEditModal}
          onStatusCycle={handleStatusCycle}
          onDuplicateItem={handleDuplicate}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {activeTab === 'tree' && (
        /* Content Tree: Visual Mind Map Canvas & Keyboard Outliner */
        <ContentTreeStudio
          categories={categories}
          onOpenContentItem={(itemId) => {
            const found = items.find((it) => it.id === itemId);
            if (found) handleOpenEditModal(found);
          }}
          onRefreshAll={() => {}}
        />
      )}

      {activeTab === 'analytics' && (
        /* Content Overview Dashboard */
        <ContentDashboard
          categories={categories}
          items={items}
          onSelectCategory={(catId) => {
            setSelectedCategoryId(catId);
            setActiveTab('categories');
          }}
          onViewAll={() => setActiveTab('all')}
          onEditItem={handleOpenEditModal}
          onStatusCycle={handleStatusCycle}
          onDuplicateItem={handleDuplicate}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {/* New / Edit Content Modal */}
      <ContentModal
        isOpen={isModalOpen}
        item={editingItem}
        categories={categories}
        allTags={allExistingTags}
        initialFormat={modalInitialFormat}
        initialCategoryId={modalInitialCategory}
        onSave={handleSaveItem}
        onDelete={editingItem?.id ? handleDeleteItem : undefined}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onCreateCategory={handleCreateCategory}
      />
    </div>
  );
};
