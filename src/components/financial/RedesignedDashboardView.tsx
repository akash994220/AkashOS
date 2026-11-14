import React from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry } from '../../types/financial';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  AlertCircle,
  Plus,
  Repeat,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface DashboardViewProps {
  entries: FinancialEntry[];
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onSwitchView: (view: 'earn_expense' | 'analytics') => void;
}

export const RedesignedDashboardView: React.FC<DashboardViewProps> = ({
  entries,
  onOpenAddModal,
  onSwitchView,
}) => {
  const { theme } = useTheme();

  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - currentDay);
  const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Separate ledger entries
  const incomeEntries = entries.filter((e) => e.entry_type === 'income');
  const expenseEntries = entries.filter((e) => e.entry_type === 'expense');

  // All-time actual balance
  const totalActualIncome = incomeEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const totalActualExpense = expenseEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const currentActualBalance = totalActualIncome - totalActualExpense;

  // This Month Actuals
  const thisMonthIncomeEntries = incomeEntries.filter((e) => {
    if (e.timing_mode === 'monthly') {
      return !e.target_month || e.target_month === currentMonthStr;
    }
    return e.date?.startsWith(currentMonthStr);
  });
  const thisMonthExpenseEntries = expenseEntries.filter((e) => {
    if (e.timing_mode === 'monthly') {
      return !e.target_month || e.target_month === currentMonthStr;
    }
    return e.date?.startsWith(currentMonthStr);
  });

  const thisMonthIncome = thisMonthIncomeEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const thisMonthExpense = thisMonthExpenseEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const thisMonthNet = thisMonthIncome - thisMonthExpense;
  const savingsRate = thisMonthIncome > 0 ? Math.round((Math.max(0, thisMonthNet) / thisMonthIncome) * 100) : 0;

  // Recurring & Projected commitments calculation for Probable Balance
  const recurringIncomes = entries.filter(
    (e) => e.entry_type === 'income' && (e.is_recurring || e.monthly_kind === 'recurring')
  );
  const recurringExpenses = entries.filter(
    (e) => (e.entry_type === 'expense' || e.entry_type === 'recurring') && (e.is_recurring || e.monthly_kind === 'recurring')
  );

  // Future scheduled expenses in this month that haven't occurred yet (or recurring not yet passed)
  const pendingRecurringExpenses = recurringExpenses.filter((e) => {
    const dueDay = e.day_of_month || 15;
    return dueDay > currentDay;
  });
  const pendingRecurringExpenseTotal = pendingRecurringExpenses.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  const pendingRecurringIncomes = recurringIncomes.filter((e) => {
    const dueDay = e.day_of_month || 1;
    return dueDay > currentDay;
  });
  const pendingRecurringIncomeTotal = pendingRecurringIncomes.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  // Daily run rate & safe spending projection
  const avgDailySpendSoFar = currentDay > 0 ? Math.round(thisMonthExpense / currentDay) : 0;
  const projectedRemainingRegularSpend = avgDailySpendSoFar * remainingDays;

  // PROBABLE BALANCE:
  // Probable Balance = Current Actual Balance + Pending Incoming Recurring - Pending Committed Expenses - (Estimated Daily Spend if applicable)
  const probableBalanceEOM = currentActualBalance + pendingRecurringIncomeTotal - pendingRecurringExpenseTotal;
  const safeDailyBudget = remainingDays > 0 ? Math.max(0, Math.round(Math.max(0, probableBalanceEOM) / remainingDays)) : 0;

  // Format Currency
  const formatBDT = (amount: number): string => {
    return `৳${Math.round(amount).toLocaleString('en-US')}`;
  };

  // Recent 5 transactions
  const recentTransactions = [...entries]
    .filter((e) => e.entry_type === 'expense' || e.entry_type === 'income')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. HERO: Probable Balance & Balance Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Probable Balance Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
            borderRadius: '1.5rem',
          }}
          className="p-5 sm:p-6 shadow-[0_14px_34px_-10px_rgba(37,99,235,0.35)] text-white lg:col-span-2 relative overflow-hidden flex flex-col justify-between"
        >
          {/* Decorative soft glow */}
          <div className="absolute -top-12 -right-12 w-52 h-52 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-44 h-44 bg-teal-300/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-full bg-white/15 text-white backdrop-blur-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-50">
                  Forecast Engine • {currentMonthName}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white backdrop-blur-xs">
                {remainingDays} days remaining this month
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mt-2">
              <div>
                <div className="text-xs font-semibold text-blue-100/90">Probable Month-End Balance</div>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-tabular mt-0.5 ${
                    probableBalanceEOM >= 0 ? 'text-white' : 'text-rose-200'
                  }`}
                >
                  {formatBDT(probableBalanceEOM)}
                </div>
                <div className="text-xs text-blue-50/90 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-200 shrink-0" />
                  <span>Accounts for pending recurring bills & scheduled incomes</span>
                </div>
              </div>

              {/* Secondary actual current cash */}
              <div className="sm:border-l sm:border-white/20 sm:pl-4 space-y-1">
                <div className="text-xs font-medium text-blue-100/90">Current Actual Net Balance</div>
                <div className="text-lg sm:text-xl font-bold text-white font-tabular">
                  {formatBDT(currentActualBalance)}
                </div>
                <div className="text-[11px] text-blue-100/80">
                  Cumulative all-time income minus all logged expenses
                </div>
              </div>
            </div>
          </div>

          {/* Floating Crisp White Probable Metrics Tray */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 mt-5 rounded-2xl bg-white/95 backdrop-blur-sm shadow-sm text-zinc-900">
            <div className="px-2 py-1 rounded-xl">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Pending Commitments</div>
              <div className="text-xs sm:text-sm font-bold text-rose-600 font-tabular mt-0.5">
                -{formatBDT(pendingRecurringExpenseTotal)}
              </div>
            </div>
            <div className="px-2 py-1 rounded-xl sm:border-l sm:border-zinc-200/70 sm:pl-3">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Expected Inflows</div>
              <div className="text-xs sm:text-sm font-bold text-teal-600 font-tabular mt-0.5">
                +{formatBDT(pendingRecurringIncomeTotal)}
              </div>
            </div>
            <div className="px-2 py-1 rounded-xl col-span-2 sm:col-span-1 sm:border-l sm:border-zinc-200/70 sm:pl-3">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Safe Daily Spend</div>
              <div className="text-xs sm:text-sm font-bold text-blue-600 font-tabular mt-0.5">
                {formatBDT(safeDailyBudget)}/day
              </div>
            </div>
          </div>
        </div>

        {/* Month Inflow vs Outflow Mini Gauge */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-5 border shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Monthly Flow
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-tabular">
                {savingsRate}% Saved
              </span>
            </div>

            <div className="space-y-3">
              {/* Income Line */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-zinc-600">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    Total Inflow
                  </span>
                  <span className="font-bold text-emerald-700 font-tabular">{formatBDT(thisMonthIncome)}</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full rounded-full" />
                </div>
              </div>

              {/* Expense Line */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-zinc-600">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                    Total Outflow
                  </span>
                  <span className="font-bold text-rose-700 font-tabular">{formatBDT(thisMonthExpense)}</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${thisMonthIncome > 0 ? Math.min(100, (thisMonthExpense / thisMonthIncome) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Net this month */}
            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Net Margin</span>
              <span
                className={`text-sm font-bold font-tabular ${
                  thisMonthNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {thisMonthNet >= 0 ? '+' : ''}
                {formatBDT(thisMonthNet)}
              </span>
            </div>
          </div>

          {/* Quick CTA */}
          <div className="pt-3 mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenAddModal('income')}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>+ Income</span>
            </button>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>- Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY TILES: Quick KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            All-Time Inflow
          </div>
          <div className="text-base sm:text-lg font-bold text-zinc-900 font-tabular mt-1">
            {formatBDT(totalActualIncome)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{incomeEntries.length} records</div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            All-Time Outflow
          </div>
          <div className="text-base sm:text-lg font-bold text-zinc-900 font-tabular mt-1">
            {formatBDT(totalActualExpense)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{expenseEntries.length} records</div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Repeat className="w-3.5 h-3.5 text-amber-600" />
            Active Recurring
          </div>
          <div className="text-base sm:text-lg font-bold text-zinc-900 font-tabular mt-1">
            {recurringExpenses.length + recurringIncomes.length} Active
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Automated commitments</div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            Daily Burn Rate
          </div>
          <div className="text-base sm:text-lg font-bold text-zinc-900 font-tabular mt-1">
            {formatBDT(avgDailySpendSoFar)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Average spend / day</div>
        </div>
      </div>

      {/* 3. RECENT TRANSACTIONS LEDGER & QUICK ACTIONS */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-5 border shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Recent Activity</h3>
            <p className="text-xs text-zinc-500">Latest earnings and expenditures</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSwitchView('earn_expense')}
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Open Full Ledger →
            </button>
            <button
              onClick={() => onSwitchView('analytics')}
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Analytics →
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-zinc-200 rounded-xl">
            <Wallet className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-zinc-700">No transactions recorded yet</div>
            <div className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
              Add your first earning or expense to activate the financial engine and live probable balance.
            </div>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Entry</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentTransactions.map((tx) => {
              const isIncome = tx.entry_type === 'income';
              const isRecurring = tx.is_recurring || tx.monthly_kind === 'recurring';

              return (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-50/60 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 truncate">{tx.category}</span>
                        {isRecurring && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200/60 shrink-0">
                            Monthly
                          </span>
                        )}
                        {tx.payment_method && (
                          <span className="text-[10px] font-medium text-zinc-500 uppercase shrink-0">
                            {tx.payment_method}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {formatDateTimeWithHM(tx.created_at || tx.date)} {tx.notes ? `• ${tx.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs sm:text-sm font-bold font-tabular ${
                        isIncome ? 'text-emerald-700' : 'text-zinc-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatBDT(tx.amount_bdt)}
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
