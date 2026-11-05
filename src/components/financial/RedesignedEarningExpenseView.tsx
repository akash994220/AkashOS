import React, { useState, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry } from '../../types/financial';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Trash2,
  Calendar,
  Edit2,
  Repeat,
  CheckCircle2,
  X,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';

interface EarningExpenseViewProps {
  entries: FinancialEntry[];
  onOpenAddModal: (type?: 'income' | 'expense', entryToEdit?: FinancialEntry | null) => void;
  onDeleteEntry: (id: string) => Promise<void>;
}

type StreamTab = 'all' | 'income' | 'expense';
type TimeFilter = 'all' | 'this_month' | 'last_month' | 'custom_month';

export const RedesignedEarningExpenseView: React.FC<EarningExpenseViewProps> = ({
  entries,
  onOpenAddModal,
  onDeleteEntry,
}) => {
  const { theme } = useTheme();

  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);

  const [streamTab, setStreamTab] = useState<StreamTab>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_month');
  const [customMonth, setCustomMonth] = useState<string>(currentMonthStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Format currency
  const formatBDT = (amount: number): string => {
    return `৳${Math.round(amount).toLocaleString('en-US')}`;
  };

  // Extract all categories in dataset
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort();
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // 1. Stream Type
      if (streamTab !== 'all' && e.entry_type !== streamTab) {
        return false;
      }

      // 2. Time Filter
      if (timeFilter === 'this_month') {
        const matches = e.timing_mode === 'monthly' ? (!e.target_month || e.target_month === currentMonthStr) : e.date?.startsWith(currentMonthStr);
        if (!matches) return false;
      } else if (timeFilter === 'last_month') {
        const matches = e.timing_mode === 'monthly' ? e.target_month === lastMonthStr : e.date?.startsWith(lastMonthStr);
        if (!matches) return false;
      } else if (timeFilter === 'custom_month') {
        const matches = e.timing_mode === 'monthly' ? e.target_month === customMonth : e.date?.startsWith(customMonth);
        if (!matches) return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catMatch = e.category?.toLowerCase().includes(q);
        const notesMatch = e.notes?.toLowerCase().includes(q);
        const amountMatch = String(e.amount_bdt).includes(q);
        const pmMatch = e.payment_method?.toLowerCase().includes(q);
        if (!catMatch && !notesMatch && !amountMatch && !pmMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      return (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [entries, streamTab, timeFilter, customMonth, selectedCategory, searchQuery, currentMonthStr, lastMonthStr]);

  // Metrics on filtered view
  const totalFilteredIncome = filteredEntries
    .filter((e) => e.entry_type === 'income')
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const totalFilteredExpense = filteredEntries
    .filter((e) => e.entry_type === 'expense')
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const netFilteredCashflow = totalFilteredIncome - totalFilteredExpense;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. TOP STATS BAR (Dynamic to current filter) */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-4 sm:p-5 border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Filtered Inflow</div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 font-tabular">
              +{formatBDT(totalFilteredIncome)}
            </div>
          </div>
          <div className="w-px h-8 bg-zinc-200 hidden sm:block" />
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Filtered Outflow</div>
            <div className="text-lg sm:text-xl font-bold text-rose-700 font-tabular">
              -{formatBDT(totalFilteredExpense)}
            </div>
          </div>
          <div className="w-px h-8 bg-zinc-200 hidden sm:block" />
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Net Cashflow</div>
            <div
              className={`text-lg sm:text-xl font-bold font-tabular ${
                netFilteredCashflow >= 0 ? 'text-zinc-900' : 'text-rose-600'
              }`}
            >
              {netFilteredCashflow >= 0 ? '+' : ''}
              {formatBDT(netFilteredCashflow)}
            </div>
          </div>
        </div>

        {/* Global Action: Add Amount */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenAddModal('income')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Earning</span>
          </button>
          <button
            onClick={() => onOpenAddModal('expense')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER CONTROLS & STREAM TOGGLES */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-3 border shadow-2xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Stream Selector (All / Incomes / Expenses) */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setStreamTab('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                streamTab === 'all' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Records ({entries.length})
            </button>
            <button
              onClick={() => setStreamTab('income')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                streamTab === 'income' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ArrowDownLeft className="w-3 h-3" />
              Earnings
            </button>
            <button
              onClick={() => setStreamTab('expense')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                streamTab === 'expense' ? 'bg-rose-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" />
              Expenses
            </button>
          </div>

          {/* Time Filter Capsules */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTimeFilter('this_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                timeFilter === 'this_month'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeFilter('last_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                timeFilter === 'last_month'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                timeFilter === 'all'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter('custom_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                timeFilter === 'custom_month'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Pick Month
            </button>
            {timeFilter === 'custom_month' && (
              <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="px-2 py-0.5 text-xs bg-white border border-zinc-300 rounded-md text-zinc-800"
              />
            )}
          </div>
        </div>

        {/* Search & Category Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-100">
          <div className="sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by category, memo notes, or payment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800"
            >
              <option value="all">All Categories ({allCategories.length})</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. TRANSACTION LEDGER LIST */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="border shadow-xs overflow-hidden"
      >
        <div className="p-3.5 sm:p-4 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Ledger ({filteredEntries.length} items)
          </span>
          <span className="text-xs text-zinc-400">Click any row to edit</span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <div className="text-xs font-semibold text-zinc-600">No entries match your filter</div>
            <div className="text-[11px] text-zinc-400 mt-1">Try adjusting the search query or month filter.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredEntries.map((entry) => {
              const isIncome = entry.entry_type === 'income';
              const isRecurring = entry.is_recurring || entry.monthly_kind === 'recurring';
              const isMonthlyOneTime = entry.timing_mode === 'monthly' && entry.monthly_kind === 'one_time';

              return (
                <div
                  key={entry.id}
                  className="p-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/80 transition-all group"
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900">{entry.category}</span>
                        {isRecurring && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                            <Repeat className="w-2.5 h-2.5" />
                            Monthly Recurring
                          </span>
                        )}
                        {isMonthlyOneTime && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/60">
                            {entry.target_month || 'Month One-Time'}
                          </span>
                        )}
                        {entry.payment_method && (
                          <span className="text-[10px] font-medium text-zinc-400 uppercase">
                            • {entry.payment_method}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>{entry.date}</span>
                        {entry.notes && <span className="truncate max-w-xs text-zinc-500">• {entry.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={`text-xs sm:text-sm font-bold font-tabular ${
                          isIncome ? 'text-emerald-700' : 'text-zinc-900'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatBDT(entry.amount_bdt)}
                      </div>
                    </div>

                    {/* Action buttons (hover or mobile tap) */}
                    <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onOpenAddModal(entry.entry_type === 'income' ? 'income' : 'expense', entry)}
                        title="Edit Entry"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete this ${entry.category} entry of ৳${entry.amount_bdt}?`)) {
                            onDeleteEntry(entry.id);
                          }
                        }}
                        title="Delete Entry"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
