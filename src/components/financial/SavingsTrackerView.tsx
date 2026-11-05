import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { SavingsGoal } from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  CheckCircle2, 
  X,
  TrendingUp
} from 'lucide-react';

interface SavingsTrackerViewProps {
  goals: SavingsGoal[];
  onSaveGoal: (goal: Partial<SavingsGoal>) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
}

export const SavingsTrackerView: React.FC<SavingsTrackerViewProps> = ({
  goals,
  onSaveGoal,
  onDeleteGoal,
}) => {
  const { theme } = useTheme();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<SavingsGoal> | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick Deposit modal state
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAddAmount, setDepositAddAmount] = useState('');

  const totalSaved = goals.reduce((acc, g) => acc + (g.current_amount_bdt || 0), 0);
  const totalTarget = goals.reduce((acc, g) => acc + (g.target_amount_bdt || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setTargetDate('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.goal_name);
    setTargetAmount(String(goal.target_amount_bdt));
    setCurrentAmount(String(goal.current_amount_bdt));
    setTargetDate(goal.target_date || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;
    if (!goalName.trim() || isNaN(target) || target <= 0) {
      alert('Please provide a goal name and target amount');
      return;
    }

    setSaving(true);
    try {
      await onSaveGoal({
        ...(editingGoal || {}),
        goal_name: goalName.trim(),
        target_amount_bdt: target,
        current_amount_bdt: current,
        target_date: targetDate || undefined,
      });
      setIsModalOpen(false);
      setEditingGoal(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save savings goal');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoal) return;
    const added = parseFloat(depositAddAmount);
    if (isNaN(added) || added <= 0) return;

    setSaving(true);
    try {
      await onSaveGoal({
        id: depositGoal.id,
        current_amount_bdt: (depositGoal.current_amount_bdt || 0) + added,
      });
      setDepositGoal(null);
      setDepositAddAmount('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update goal');
    } finally {
      setSaving(false);
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Target className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Savings & Financial Milestones
            </span>
          </div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-xs text-zinc-400 block">Total Accumulated</span>
              <CurrencyDisplay amountBdt={totalSaved} size="xl" className="text-emerald-700" />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Combined Target</span>
              <CurrencyDisplay amountBdt={totalTarget} size="lg" />
            </div>
            <div className="text-xs font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-800 self-center">
              {overallProgress}% Funded
            </div>
          </div>
        </div>

        <button
          id="add-savings-goal-btn"
          onClick={handleOpenAdd}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.md,
            minHeight: '44px',
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold hover:opacity-90 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Savings Goal</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const progress = goal.target_amount_bdt > 0
            ? Math.min(100, Math.round((goal.current_amount_bdt / goal.target_amount_bdt) * 100))
            : 0;
          const remaining = Math.max(0, goal.target_amount_bdt - goal.current_amount_bdt);
          const isComplete = goal.current_amount_bdt >= goal.target_amount_bdt;

          return (
            <div
              key={goal.id}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.lg,
                border: `1px solid ${theme.colors.borderLight}`,
                boxShadow: theme.shadows.sm,
                padding: theme.spacing.lg,
              }}
              className="space-y-4 hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-800">{goal.goal_name}</h4>
                  {isComplete && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Achieved
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(goal)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer rounded hover:bg-zinc-100"
                    title="Edit goal"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete savings goal "${goal.goal_name}"?`)) onDeleteGoal(goal.id);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-600 cursor-pointer rounded hover:bg-red-50"
                    title="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Amounts */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-zinc-400 block">Current Balance</span>
                  <CurrencyDisplay amountBdt={goal.current_amount_bdt} size="lg" className="text-emerald-700" />
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block">Target Goal</span>
                  <CurrencyDisplay amountBdt={goal.target_amount_bdt} size="md" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="font-semibold">{progress}% completed</span>
                  <span>{isComplete ? 'Goal met!' : `৳${remaining.toLocaleString()} remaining`}</span>
                </div>
              </div>

              {/* Footer info & Deposit button */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  {goal.target_date ? (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Target: {goal.target_date}</span>
                    </>
                  ) : (
                    <span>No deadline set</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDepositGoal(goal);
                    setDepositAddAmount('');
                  }}
                  style={{ minHeight: '36px' }}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+ Add Savings</span>
                </button>
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xl,
            }}
            className="col-span-full text-center text-xs text-zinc-400"
          >
            No savings goals established yet. Tap "+ New Savings Goal" to track your targets.
          </div>
        )}
      </div>

      {/* Add / Edit Goal Modal */}
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
                {editingGoal ? 'Edit Savings Goal' : 'New Savings Goal'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Goal Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Emergency Fund, Camera Lens, Travel..."
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Target Amount in BDT (৳) *
                </label>
                <input
                  type="number"
                  step="100"
                  min="1"
                  required
                  placeholder="e.g. 100000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
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
                  Starting / Current Saved in BDT (৳)
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
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
                  Target Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
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
                  {saving ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Deposit Modal */}
      {depositGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '360px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                Add to {depositGoal.goal_name}
              </h3>
              <button onClick={() => setDepositGoal(null)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleAddDeposit} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Deposit Amount in BDT (৳)
                </label>
                <input
                  type="number"
                  step="50"
                  min="1"
                  required
                  autoFocus
                  placeholder="e.g. 5000"
                  value={depositAddAmount}
                  onChange={(e) => setDepositAddAmount(e.target.value)}
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
                  onClick={() => setDepositGoal(null)}
                  className="px-4 py-2 border rounded hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !depositAddAmount}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '40px',
                  }}
                  className="px-5 py-2 font-bold hover:opacity-90 cursor-pointer"
                >
                  {saving ? 'Updating...' : 'Add Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
