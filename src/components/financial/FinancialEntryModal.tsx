import React, { useState, useEffect } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry, FinancialEntryType, TimingMode, MonthlyKind } from '../../types/financial';
import { X, Calendar, Repeat, Tag, CreditCard, FileText, Check, DollarSign } from 'lucide-react';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<FinancialEntry>) => Promise<void>;
  initialType?: 'income' | 'expense';
  entryToEdit?: FinancialEntry | null;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Grocery',
  'Housing & Rent',
  'Utilities & Bills',
  'Transportation',
  'Tech & Software',
  'Entertainment & Dining',
  'Healthcare & Medicine',
  'Shopping & Apparel',
  'Education & Learning',
  'Family & Household',
  'Investment & Savings',
  'Miscellaneous',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salary / Employment',
  'Freelance & Contract',
  'Business / Client Revenue',
  'Content Monetization',
  'Investments & Dividends',
  'Rental Income',
  'Gifts & Bonuses',
  'Other Income',
];

const PAYMENT_METHODS = [
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Credit/Debit Card' },
  { id: 'other', label: 'Other' },
];

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000, 20000, 50000];

export const FinancialEntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialType = 'expense',
  entryToEdit,
}) => {
  const { theme } = useTheme();

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentDay = new Date().getDate();

  const [entryType, setEntryType] = useState<FinancialEntryType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [timingMode, setTimingMode] = useState<TimingMode>('specific_date');
  const [specificDate, setSpecificDate] = useState<string>(todayStr);
  const [monthlyKind, setMonthlyKind] = useState<MonthlyKind>('one_time');
  const [targetMonth, setTargetMonth] = useState<string>(currentMonthStr);
  const [dayOfMonth, setDayOfMonth] = useState<number>(currentDay);
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (entryToEdit) {
      setEntryType(entryToEdit.entry_type === 'recurring' ? 'expense' : entryToEdit.entry_type);
      setAmount(entryToEdit.amount_bdt ? String(entryToEdit.amount_bdt) : '');
      const tMode = entryToEdit.timing_mode || (entryToEdit.is_recurring ? 'monthly' : 'specific_date');
      setTimingMode(tMode);
      setSpecificDate(entryToEdit.date || todayStr);
      setMonthlyKind(entryToEdit.monthly_kind || (entryToEdit.is_recurring ? 'recurring' : 'one_time'));
      setTargetMonth(entryToEdit.target_month || entryToEdit.date?.substring(0, 7) || currentMonthStr);
      setDayOfMonth(entryToEdit.day_of_month || currentDay);
      setCategory(entryToEdit.category || '');
      setPaymentMethod(entryToEdit.payment_method || 'cash');
      setNotes(entryToEdit.notes || '');
    } else {
      setEntryType(initialType);
      setAmount('');
      setTimingMode('specific_date');
      setSpecificDate(todayStr);
      setMonthlyKind('one_time');
      setTargetMonth(currentMonthStr);
      setDayOfMonth(currentDay);
      setCategory(initialType === 'income' ? DEFAULT_INCOME_CATEGORIES[0] : DEFAULT_EXPENSE_CATEGORIES[0]);
      setCustomCategory('');
      setPaymentMethod('cash');
      setNotes('');
    }
    setErrorMsg('');
  }, [entryToEdit, initialType, isOpen]);

  // Adjust default category if type changes
  const handleTypeChange = (newType: FinancialEntryType) => {
    setEntryType(newType);
    if (!category || category === DEFAULT_INCOME_CATEGORIES[0] || category === DEFAULT_EXPENSE_CATEGORIES[0]) {
      setCategory(newType === 'income' ? DEFAULT_INCOME_CATEGORIES[0] : DEFAULT_EXPENSE_CATEGORIES[0]);
    }
  };

  const handleQuickAddAmount = (addValue: number) => {
    const currentVal = parseFloat(amount) || 0;
    setAmount(String(currentVal + addValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    const selectedCategory = category === '__custom__' ? customCategory.trim() : category.trim();
    if (!selectedCategory) {
      setErrorMsg('Please select or specify a category.');
      return;
    }

    // Determine finalized date representation
    let finalDate = specificDate;
    if (timingMode === 'monthly') {
      const paddedDay = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
      finalDate = `${targetMonth}-${paddedDay}`;
    }

    const isRecurring = timingMode === 'monthly' && monthlyKind === 'recurring';

    const payload: Partial<FinancialEntry> = {
      ...(entryToEdit ? { id: entryToEdit.id } : {}),
      entry_type: entryType,
      amount_bdt: numericAmount,
      category: selectedCategory,
      date: finalDate,
      timing_mode: timingMode,
      monthly_kind: timingMode === 'monthly' ? monthlyKind : undefined,
      target_month: timingMode === 'monthly' ? targetMonth : undefined,
      day_of_month: timingMode === 'monthly' ? dayOfMonth : undefined,
      payment_method: paymentMethod,
      notes: notes.trim(),
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? 'monthly' : undefined,
      created_at: entryToEdit?.created_at || new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Failed to save entry:', err);
      setErrorMsg(err.message || 'Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentCategories = entryType === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pb-[max(16px,calc(env(safe-area-inset-bottom,0px)+16px))] bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="w-full max-w-lg border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div
          style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}
          className="px-5 py-4 flex items-center justify-between shrink-0"
        >
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
              {entryToEdit ? 'Edit Transaction' : 'Add Financial Entry'}
            </h3>
            <p className="text-xs text-zinc-500">Record earnings or expenses with flexible schedule</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* 1. Transaction Type Toggle */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 block">
              Entry Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryType === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                + Earning (Income)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryType === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-300"></span>
                - Expense (Spent)
              </button>
            </div>
          </div>

          {/* 2. Amount Input & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                Amount (BDT)
              </label>
              <span className="text-[11px] text-zinc-500 font-tabular">Bangladeshi Taka</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-400">
                ৳
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ borderRadius: theme.radius.lg }}
                className="w-full pl-9 pr-4 py-2.5 text-xl font-bold bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 focus:outline-hidden transition-all text-zinc-900 font-tabular placeholder:text-zinc-300"
              />
            </div>

            {/* Quick Increment Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-zinc-400 mr-1">Add:</span>
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAddAmount(val)}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors font-tabular cursor-pointer"
                >
                  +৳{val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Timing Mode (Specific Date vs Monthly) */}
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
            <div>
              <label className="text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Schedule & Timeframe
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setTimingMode('specific_date')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                    timingMode === 'specific_date'
                      ? 'bg-white border-zinc-900 text-zinc-900 shadow-2xs font-bold'
                      : 'border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  Specific Date
                </button>
                <button
                  type="button"
                  onClick={() => setTimingMode('monthly')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                    timingMode === 'monthly'
                      ? 'bg-white border-zinc-900 text-zinc-900 shadow-2xs font-bold'
                      : 'border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  Monthly Schedule
                </button>
              </div>
            </div>

            {/* Sub-flow: Specific Date */}
            {timingMode === 'specific_date' && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 mb-1 block">
                  Select Transaction Date
                </label>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800"
                />
              </div>
            )}

            {/* Sub-flow: Monthly (One-Time for Month vs Monthly Recurring) */}
            {timingMode === 'monthly' && (
              <div className="space-y-3 pt-1 border-t border-zinc-200/60">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-600 mb-1 block">
                    Monthly Entry Nature
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyKind('one_time')}
                      className={`py-1.5 px-2.5 text-xs rounded-lg border transition-all text-left flex items-start gap-1.5 ${
                        monthlyKind === 'one_time'
                          ? 'bg-white border-indigo-500 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-500/20'
                          : 'border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0"></div>
                      <div>
                        <div>One-time this month</div>
                        <div className="text-[10px] text-zinc-400 font-normal">Specific month only</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMonthlyKind('recurring')}
                      className={`py-1.5 px-2.5 text-xs rounded-lg border transition-all text-left flex items-start gap-1.5 ${
                        monthlyKind === 'recurring'
                          ? 'bg-white border-amber-500 text-amber-950 font-bold shadow-2xs ring-1 ring-amber-500/20'
                          : 'border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <div>Monthly Recurring</div>
                        <div className="text-[10px] text-zinc-400 font-normal">Repeats every month</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-500 mb-1 block">
                      {monthlyKind === 'one_time' ? 'Target Month' : 'Start Month'}
                    </label>
                    <input
                      type="month"
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-500 mb-1 block">
                      Day of Month (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800 font-tabular"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Category */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-500" />
              Category
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2 max-h-32 overflow-y-auto no-scrollbar p-1">
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    category === cat
                      ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory('__custom__')}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  category === '__custom__'
                    ? 'border-zinc-900 bg-zinc-900 text-white font-semibold'
                    : 'border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                + Custom...
              </button>
            </div>

            {category === '__custom__' && (
              <input
                type="text"
                placeholder="Enter custom category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800"
              />
            )}
          </div>

          {/* 5. Payment Method & Optional Memo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800 font-medium"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                Memo / Note
              </label>
              <input
                type="text"
                placeholder="Brief description or receipt ref"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2 text-xs font-bold rounded-lg text-white shadow-xs transition-all flex items-center gap-1.5 ${
                entryType === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-zinc-900 hover:bg-zinc-800'
              } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{entryToEdit ? 'Save Changes' : `Add ${entryType === 'income' ? 'Earning' : 'Expense'}`}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
