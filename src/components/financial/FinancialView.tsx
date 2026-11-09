import React, { useState, useEffect } from 'react';
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
} from 'firebase/firestore';
import { FinancialEntry } from '../../types/financial';
import { RedesignedDashboardView } from './RedesignedDashboardView';
import { RedesignedEarningExpenseView } from './RedesignedEarningExpenseView';
import { RedesignedAnalyticsView } from './RedesignedAnalyticsView';
import { FinancialEntryModal } from './FinancialEntryModal';
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Plus,
} from 'lucide-react';

export type FinancialMainView = 'dashboard' | 'earn_expense' | 'analytics';

export const FinancialView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [activeView, setActiveView] = useState<FinancialMainView>('dashboard');
  const [entries, setEntries] = useState<FinancialEntry[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'income' | 'expense'>('expense');
  const [entryToEdit, setEntryToEdit] = useState<FinancialEntry | null>(null);

  // Firestore Subscriptions for Financial Entries
  useEffect(() => {
    if (!user || !db) return;

    const qEntries = query(
      collection(db, 'financial_entries'),
      where('owner_uid', '==', user.uid)
    );

    const unsubEntries = onSnapshot(
      qEntries,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialEntry));
        setEntries(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_entries')
    );

    return () => {
      unsubEntries();
    };
  }, [user]);

  // Firestore mutations
  const handleSaveEntry = async (entry: Partial<FinancialEntry>) => {
    if (!user) return;
    const docId = entry.id || `fin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payload = {
      ...entry,
      id: docId,
      owner_uid: user.uid,
      created_at: entry.created_at || new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'financial_entries', docId), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `financial_entries/${docId}`);
      throw err;
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'financial_entries', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `financial_entries/${id}`);
      throw err;
    }
  };

  const handleOpenAddModal = (type: 'income' | 'expense' = 'expense', editTarget: FinancialEntry | null = null) => {
    setModalInitialType(type);
    setEntryToEdit(editTarget);
    setIsModalOpen(true);
  };

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard & Probable Balance', icon: LayoutDashboard },
    { id: 'earn_expense' as const, label: 'Earning & Expense', icon: ArrowLeftRight, count: entries.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header & Fast Global Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            Financial Management
          </h1>
          <p className="text-xs text-zinc-500">
            Real-time probable balance forecast, unified cash flow ledger, and spending trends
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal('income')}
            style={{ borderRadius: theme.radius.lg }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Earning</span>
          </button>
          <button
            onClick={() => handleOpenAddModal('expense')}
            style={{ borderRadius: theme.radius.lg }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>- Expense</span>
          </button>
        </div>
      </div>

      {/* Clean Segmented Navigation Capsules */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <div
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.full,
          }}
          className="p-1 border flex items-center gap-1 shrink-0 shadow-2xs"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                style={{
                  backgroundColor: isActive ? theme.colors.bgCard : 'transparent',
                  color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                  borderRadius: theme.radius.full,
                  minHeight: '36px',
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs cursor-pointer transition-all whitespace-nowrap ${
                  isActive ? 'shadow-xs font-bold text-zinc-900' : 'hover:text-zinc-900 font-medium text-zinc-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-200/70 text-zinc-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Views */}
      {activeView === 'dashboard' && (
        <RedesignedDashboardView
          entries={entries}
          onOpenAddModal={handleOpenAddModal}
          onSwitchView={(v) => setActiveView(v)}
        />
      )}

      {activeView === 'earn_expense' && (
        <RedesignedEarningExpenseView
          entries={entries}
          onOpenAddModal={handleOpenAddModal}
          onDeleteEntry={handleDeleteEntry}
        />
      )}

      {activeView === 'analytics' && <RedesignedAnalyticsView entries={entries} />}

      {/* Unified Add/Edit Amount Popup Modal */}
      <FinancialEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEntryToEdit(null);
        }}
        onSave={handleSaveEntry}
        initialType={modalInitialType}
        entryToEdit={entryToEdit}
      />
    </div>
  );
};
