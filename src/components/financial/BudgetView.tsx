import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { Budget, FinancialEntry } from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { 
  PiggyBank, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  X 
} from 'lucide-react';

interface BudgetViewProps {
  budgets: Budget[];
  expenses: FinancialEntry[];
  onSaveBudget: (budget: Partial<Budget>) => Promise<void>;
}

const COMMON_BUDGET_CATEGORIES = [
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

export const BudgetView: React.FC<BudgetViewProps> = ({
  budgets,
  expenses,
  onSaveBudget,
}) => {
  const { theme } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [categoryInput, setCategoryInput] = useState(COMMON_BUDGET_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  // Month-filtered expenses
  const monthExpenses = expenses.filter((e) => e.entry_type === 'expense' && e.date.startsWith(selectedMonth));
  const monthBudgets = budgets.filter((b) => b.month === selectedMonth);

  // Total planned vs actual
  const totalBudgeted = monthBudgets.reduce((acc, b) => acc + (b.monthly_limit_bdt || 0), 0);
  const totalSpent = monthExpenses.reduce((acc, e) => acc + (e.amount_bdt || 0), 0);
  const totalRemaining = Math.max(0, totalBudgeted - totalSpent);

  const handleOpenAdd = (category?: string) => {
    setCategoryInput(category || COMMON_BUDGET_CATEGORIES[0]);
    const existing = monthBudgets.find((b) => b.category === (category || COMMON_BUDGET_CATEGORIES[0]));
    if (existing) {
      setLimitInput(String(existing.monthly_limit_bdt));
      setEditingBudget(existing);
    } else {
      setLimitInput('');
      setEditingBudget({ month: selectedMonth });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(limitInput);
    if (isNaN(limit) || limit <= 0) {
      alert('Please enter a valid monthly limit in BDT');
      return;
    }

    setSaving(true);
    try {
      await onSaveBudget({
        ...(editingBudget || {}),
        category: categoryInput,
        monthly_limit_bdt: limit,
        month: selectedMonth,
      });
      setIsModalOpen(false);
      setEditingBudget(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Month Selector */}
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
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <PiggyBank className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Category Budgets ({selectedMonth})
            </span>
          </div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-xs text-zinc-400 block">Total Budget:</span>
              <CurrencyDisplay amountBdt={totalBudgeted} size="lg" />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Total Spent:</span>
              <CurrencyDisplay amountBdt={totalSpent} size="lg" className="text-red-600" />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Remaining:</span>
              <CurrencyDisplay amountBdt={totalRemaining} size="lg" className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.borderLight,
              minHeight: '44px',
            }}
            className="px-3 py-2 text-xs border font-medium focus:outline-none"
          />
          <button
            onClick={() => handleOpenAdd()}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '44px',
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold hover:opacity-90 cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Set Limit</span>
          </button>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMON_BUDGET_CATEGORIES.map((cat) => {
          const budgetItem = monthBudgets.find((b) => b.category === cat);
          const spent = monthExpenses
            .filter((e) => e.category === cat)
            .reduce((acc, e) => acc + (e.amount_bdt || 0), 0);

          const limit = budgetItem?.monthly_limit_bdt || 0;
          const remaining = limit - spent;
          const percentage = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const isOver = limit > 0 && spent > limit;

          return (
            <div
              key={cat}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.lg,
                border: `1px solid ${theme.colors.borderLight}`,
                boxShadow: theme.shadows.sm,
                padding: theme.spacing.md,
              }}
              className="space-y-3 hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-800">{cat}</h4>
                <button
                  type="button"
                  onClick={() => handleOpenAdd(cat)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  title="Adjust budget"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {limit > 0 ? (
                <>
                  <div className="flex items-baseline justify-between text-xs">
                    <div>
                      <span className="text-zinc-400 block text-[10px]">Spent</span>
                      <CurrencyDisplay amountBdt={spent} size="sm" className="font-bold" />
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-400 block text-[10px]">Limit</span>
                      <CurrencyDisplay amountBdt={limit} size="sm" className="font-bold" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? 'bg-red-600' : percentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">{percentage}% used</span>
                    <span className={isOver ? 'text-red-600 font-bold' : 'text-emerald-600 font-medium'}>
                      {isOver ? `Over by ৳${(spent - limit).toLocaleString()}` : `৳${remaining.toLocaleString()} left`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-2 text-center">
                  <span className="text-zinc-400 text-xs block mb-2">No budget set for {cat}</span>
                  <button
                    onClick={() => handleOpenAdd(cat)}
                    className="text-xs text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    + Set monthly limit
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Set / Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '380px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                Set Category Budget
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Category
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
                  {COMMON_BUDGET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  disabled
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border font-medium text-zinc-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Monthly Limit in BDT (৳) *
                </label>
                <input
                  type="number"
                  step="100"
                  min="1"
                  required
                  autoFocus
                  placeholder="e.g. 15000"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-base font-bold border focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  {saving ? 'Saving...' : 'Save Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
