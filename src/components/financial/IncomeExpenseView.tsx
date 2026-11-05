import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry } from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { ResponsiveListItem } from '../common/ResponsiveListItem';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import { 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calculator, 
  Calendar, 
  Filter, 
  X 
} from 'lucide-react';

interface IncomeExpenseViewProps {
  type: 'income' | 'expense';
  entries: FinancialEntry[];
  onSaveEntry: (entry: Partial<FinancialEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Housing & Rent',
  'Utilities',
  'Transportation',
  'Tech & Software',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Miscellaneous',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salary / Employment',
  'Freelance & Client Work',
  'Content Monetization',
  'Investments',
  'Gifts',
  'Other Income',
];

export const IncomeExpenseView: React.FC<IncomeExpenseViewProps> = ({
  type,
  entries,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const { theme } = useTheme();

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState(
    type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES[0] : DEFAULT_INCOME_CATEGORIES[0]
  );
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [notesInput, setNotesInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Expense Calculator / Period Filter State
  const [calcPeriod, setCalcPeriod] = useState<'all' | 'this_month' | 'last_30' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Filter entries
  const filteredEntries = entries.filter((it) => {
    if (it.entry_type !== type) return false;
    if (selectedCategoryFilter !== 'all' && it.category !== selectedCategoryFilter) return false;

    if (calcPeriod === 'this_month') {
      const currentYearMonth = new Date().toISOString().substring(0, 7);
      return it.date.startsWith(currentYearMonth);
    }
    if (calcPeriod === 'last_30') {
      const d = new Date(it.date).getTime();
      const now = Date.now();
      return now - d <= 30 * 24 * 60 * 60 * 1000 && d <= now;
    }
    if (calcPeriod === 'custom' && customStart && customEnd) {
      return it.date >= customStart && it.date <= customEnd;
    }
    return true;
  });

  // Calculate Running Total
  const totalAmountBdt = filteredEntries.reduce((acc, curr) => acc + (Number(curr.amount_bdt) || 0), 0);

  const categories = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount in BDT');
      return;
    }

    setSaving(true);
    try {
      await onSaveEntry({
        entry_type: type,
        category: categoryInput,
        amount_bdt: parsedAmount,
        date: dateInput,
        notes: notesInput.trim(),
      });
      setIsAddOpen(false);
      setAmountInput('');
      setNotesInput('');
    } catch (err: any) {
      alert(err?.message || 'Failed to record entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Running Total & Period Filter */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.xl,
          border: `1px solid ${theme.colors.borderLight}`,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.lg,
        }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {type === 'expense' ? (
              <span className="p-2 rounded-lg bg-red-50 text-red-600">
                <ArrowDownLeft className="w-5 h-5" />
              </span>
            ) : (
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="w-5 h-5" />
              </span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {type === 'expense' ? 'Total Expenses (Running Total)' : 'Total Income Received'}
            </span>
          </div>
          <div>
            <CurrencyDisplay amountBdt={totalAmountBdt} size="xl" />
          </div>
          <p className="text-[11px] text-zinc-400">
            {calcPeriod === 'this_month'
              ? 'Calculated for current calendar month'
              : calcPeriod === 'last_30'
              ? 'Calculated for past 30 days'
              : calcPeriod === 'custom'
              ? `Custom: ${customStart || 'start'} to ${customEnd || 'end'}`
              : 'All recorded time'}
          </p>
        </div>

        {/* Action Button & Period Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            id={`add-${type}-btn`}
            onClick={() => setIsAddOpen(true)}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '44px',
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold hover:opacity-90 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Record {type === 'expense' ? 'Expense' : 'Income'}</span>
          </button>
        </div>
      </div>

      {/* Period Calculator Bar */}
      <div
        style={{
          backgroundColor: theme.colors.bgSecondary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.sm,
          border: `1px solid ${theme.colors.borderLight}`,
        }}
        className="flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-zinc-500" />
          <span className="font-semibold text-zinc-700">Expense Period Auto-Calculator:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded border border-zinc-200">
            {(['this_month', 'last_30', 'all', 'custom'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setCalcPeriod(period)}
                style={{
                  backgroundColor: calcPeriod === period ? theme.colors.accent : 'transparent',
                  color: calcPeriod === period ? theme.colors.accentText : theme.colors.textSecondary,
                  borderRadius: theme.radius.sm,
                }}
                className="px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors"
              >
                {period === 'this_month'
                  ? 'This Month'
                  : period === 'last_30'
                  ? 'Last 30 Days'
                  : period === 'all'
                  ? 'All History'
                  : 'Custom Dates'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Range Inputs */}
        {calcPeriod === 'custom' && (
          <div className="w-full flex items-center gap-2 pt-2 border-t border-zinc-200">
            <span className="text-[11px] text-zinc-500">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white border border-zinc-200 rounded px-2 py-1 text-xs"
            />
            <span className="text-[11px] text-zinc-500">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white border border-zinc-200 rounded px-2 py-1 text-xs"
            />
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 px-1">
          <span>Transactions ({filteredEntries.length})</span>
          <span>Amount (BDT)</span>
        </div>

        {filteredEntries.map((item) => (
          <ResponsiveListItem
            key={item.id}
            desktopContent={
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 truncate">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {formatDateTimeWithHM(item.created_at || item.date)}
                    </span>
                    {item.is_recurring && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold">
                        Recurring ({item.recurrence_frequency})
                      </span>
                    )}
                  </div>
                  {item.notes && <p className="text-[11px] text-zinc-500 truncate">{item.notes}</p>}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <CurrencyDisplay
                    amountBdt={item.amount_bdt}
                    size="md"
                    className={type === 'expense' ? 'text-red-700' : 'text-emerald-700'}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this entry?')) onDeleteEntry(item.id);
                    }}
                    className="p-1 text-zinc-300 hover:text-red-600 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            }
            mobileContent={
              <div className="space-y-2.5">
                {/* Header: Category & Recurring Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900">
                        {item.category}
                      </span>
                      {item.is_recurring && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          Recurring ({item.recurrence_frequency})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 block mt-0.5">
                      {formatDateTimeWithHM(item.created_at || item.date)}
                    </span>
                  </div>
                </div>

                {/* Notes snippet if present */}
                {item.notes && (
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                    {item.notes}
                  </p>
                )}

                {/* Bottom: Amount and Delete Action */}
                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.borderLight}`,
                    paddingTop: theme.spacing.xs,
                  }}
                  className="flex items-center justify-between gap-2 pt-2"
                >
                  <CurrencyDisplay
                    amountBdt={item.amount_bdt}
                    size="lg"
                    className={type === 'expense' ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this entry?')) onDeleteEntry(item.id);
                    }}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                    className="flex items-center justify-center text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
          />
        ))}

        {filteredEntries.length === 0 && (
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xl,
            }}
            className="text-center text-xs text-zinc-400"
          >
            No {type} transactions recorded for this period. Tap "+ Record {type === 'expense' ? 'Expense' : 'Income'}" to add one.
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '420px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                Record {type === 'expense' ? 'Expense' : 'Income'}
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Amount in BDT (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="e.g. 1500"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-base font-bold border focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Category *
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Date
                </label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Notes / Payee / Source
                </label>
                <input
                  type="text"
                  placeholder="Optional details..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '40px',
                  }}
                  className="px-5 py-2 font-bold hover:opacity-90 cursor-pointer"
                >
                  {saving ? 'Recording...' : `Record ${type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
