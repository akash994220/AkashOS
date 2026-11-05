import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry, RecurrenceFrequency } from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { ResponsiveListItem } from '../common/ResponsiveListItem';
import { 
  Repeat, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  CheckCircle2, 
  X,
  Zap
} from 'lucide-react';

interface RecurringExpensesViewProps {
  recurringEntries: FinancialEntry[];
  onSaveRecurring: (entry: Partial<FinancialEntry>) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onTriggerAutoLog: () => Promise<number>; // returns count of auto-logged entries
}

const COMMON_RECURRING_CATEGORIES = [
  'Utilities',
  'Housing & Rent',
  'Tech & Software',
  'Entertainment',
  'Education',
  'Healthcare',
  'Miscellaneous',
];

export const RecurringExpensesView: React.FC<RecurringExpensesViewProps> = ({
  recurringEntries,
  onSaveRecurring,
  onDeleteRecurring,
  onTriggerAutoLog,
}) => {
  const { theme } = useTheme();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<FinancialEntry> | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState(COMMON_RECURRING_CATEGORIES[0]);
  const [frequencyInput, setFrequencyInput] = useState<RecurrenceFrequency>('monthly');
  const [notesInput, setNotesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const totalMonthlyRecurring = recurringEntries.reduce((acc, curr) => {
    let amt = Number(curr.amount_bdt) || 0;
    if (curr.recurrence_frequency === 'yearly') amt = amt / 12;
    if (curr.recurrence_frequency === 'weekly') amt = amt * 4.33;
    return acc + amt;
  }, 0);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setAmountInput('');
    setCategoryInput(COMMON_RECURRING_CATEGORIES[0]);
    setFrequencyInput('monthly');
    setNotesInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: FinancialEntry) => {
    setEditingItem(item);
    setAmountInput(String(item.amount_bdt));
    setCategoryInput(item.category);
    setFrequencyInput(item.recurrence_frequency || 'monthly');
    setNotesInput(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await onSaveRecurring({
        ...(editingItem || {}),
        entry_type: 'recurring',
        is_recurring: true,
        category: categoryInput,
        amount_bdt: parsedAmount,
        recurrence_frequency: frequencyInput,
        notes: notesInput.trim(),
        date: editingItem?.date || new Date().toISOString().split('T')[0],
      });
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save recurring entry');
    } finally {
      setSaving(false);
    }
  };

  const handleManualAutoLog = async () => {
    try {
      const count = await onTriggerAutoLog();
      setSyncMessage(count > 0 ? `Successfully generated ${count} due expense(s) for this month!` : 'All recurring expenses are already up to date for this period.');
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger recurring check');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
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
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Repeat className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recurring Subscriptions & Fixed Expenses
            </span>
          </div>
          <div>
            <span className="text-xs text-zinc-400 block">Est. Monthly Recurring Outflow</span>
            <CurrencyDisplay amountBdt={totalMonthlyRecurring} size="xl" className="text-purple-700" />
          </div>
          <p className="text-[11px] text-zinc-400">
            Automatically logged as actual expenses upon month change when opening the Financial tab.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualAutoLog}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.borderLight,
              color: theme.colors.textPrimary,
              minHeight: '44px',
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border hover:bg-zinc-200 cursor-pointer transition-colors"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Check & Sync Now</span>
          </button>

          <button
            id="add-recurring-btn"
            onClick={handleOpenAdd}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '44px',
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold hover:opacity-90 cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recurring</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Recurring List */}
      <div className="space-y-3">
        {recurringEntries.map((item) => (
          <ResponsiveListItem
            key={item.id}
            desktopContent={
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-800">{item.category}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold capitalize">
                      {item.recurrence_frequency}
                    </span>
                  </div>
                  {item.notes && <p className="text-xs text-zinc-500 truncate">{item.notes}</p>}
                  <span className="text-[11px] text-zinc-400 block">
                    Last logged period: {item.last_logged_period || 'Not yet logged'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <CurrencyDisplay amountBdt={item.amount_bdt} size="md" className="font-bold" />
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer rounded hover:bg-zinc-100"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this recurring expense template?')) onDeleteRecurring(item.id);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-600 cursor-pointer rounded hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
            mobileContent={
              <div className="space-y-3">
                {/* Header: Category & Frequency */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-zinc-900">{item.category}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold capitalize">
                      {item.recurrence_frequency}
                    </span>
                  </div>
                </div>

                {/* Body: Notes and last logged period */}
                <div className="space-y-1 text-xs text-zinc-500">
                  {item.notes && <p className="text-zinc-700 leading-relaxed line-clamp-2">{item.notes}</p>}
                  <span className="text-[11px] text-zinc-400 block">
                    Last logged: {item.last_logged_period || 'Not yet logged'}
                  </span>
                </div>

                {/* Footer: Amount and Actions */}
                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.borderLight}`,
                    paddingTop: theme.spacing.xs,
                  }}
                  className="flex items-center justify-between gap-2 pt-2"
                >
                  <CurrencyDisplay amountBdt={item.amount_bdt} size="lg" className="font-bold text-zinc-900" />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      style={{ minHeight: '44px', minWidth: '44px' }}
                      className="flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer rounded hover:bg-zinc-100"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this recurring expense template?')) onDeleteRecurring(item.id);
                      }}
                      style={{ minHeight: '44px', minWidth: '44px' }}
                      className="flex items-center justify-center text-zinc-400 hover:text-red-600 cursor-pointer rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            }
          />
        ))}

        {recurringEntries.length === 0 && (
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xl,
            }}
            className="text-center text-xs text-zinc-400"
          >
            No recurring expenses registered. Tap "+ Add Recurring" to set up monthly bills or subscriptions.
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '400px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                {editingItem ? 'Edit Recurring Expense' : 'New Recurring Expense'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
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
                  {COMMON_RECURRING_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Amount in BDT (৳) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 1200"
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
                  Frequency
                </label>
                <select
                  value={frequencyInput}
                  onChange={(e) => setFrequencyInput(e.target.value as RecurrenceFrequency)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border focus:outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Notes / Subscription Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fiber Internet, Netflix, Cloud VPS..."
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
                  {saving ? 'Saving...' : 'Save Recurring'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
