import React from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry, Budget, SavingsGoal } from '../../types/financial';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  PiggyBank, 
  Target, 
  Repeat, 
  BarChart3, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  CreditCard,
  Calculator
} from 'lucide-react';

interface FinancialDashboardProps {
  entries: FinancialEntry[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  onSwitchTab: (tab: 'expenses' | 'income' | 'budgets' | 'savings' | 'recurring' | 'reports' | 'calculator') => void;
}

export const FinancialDashboardView: React.FC<FinancialDashboardProps> = ({
  entries,
  budgets,
  savingsGoals,
  onSwitchTab,
}) => {
  const { theme } = useTheme();

  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Separate expenses and income
  const expenseEntries = entries.filter((e) => e.entry_type === 'expense');
  const incomeEntries = entries.filter((e) => e.entry_type === 'income');
  const recurringEntries = entries.filter((e) => e.entry_type === 'recurring' || e.is_recurring);

  // All-time Totals
  const totalAllIncome = incomeEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const totalAllExpenses = expenseEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const netBalance = totalAllIncome - totalAllExpenses;

  // Current Month Totals
  const monthIncomeEntries = incomeEntries.filter((e) => e.date?.startsWith(currentMonthStr));
  const monthExpenseEntries = expenseEntries.filter((e) => e.date?.startsWith(currentMonthStr));

  const monthIncomeTotal = monthIncomeEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const monthExpenseTotal = monthExpenseEntries.reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);
  const monthNetSavings = monthIncomeTotal - monthExpenseTotal;
  const monthSavingsRate = monthIncomeTotal > 0 ? Math.round((monthNetSavings / monthIncomeTotal) * 100) : 0;

  // Recurring Commitments
  const monthlyRecurringTotal = recurringEntries.reduce((acc, curr) => {
    if (curr.recurrence_frequency === 'yearly') return acc + Math.round((curr.amount_bdt || 0) / 12);
    if (curr.recurrence_frequency === 'weekly') return acc + Math.round((curr.amount_bdt || 0) * 4.33);
    return acc + (curr.amount_bdt || 0);
  }, 0);

  // Budgets Health Check
  const currentBudgets = budgets.filter((b) => !b.month || b.month === currentMonthStr);
  const totalBudgetLimit = currentBudgets.reduce((acc, curr) => acc + (curr.monthly_limit_bdt || 0), 0);
  
  // Calculate spending per budget category this month
  const categorySpendingMap: Record<string, number> = {};
  monthExpenseEntries.forEach((e) => {
    const cat = e.category || 'Uncategorized';
    categorySpendingMap[cat] = (categorySpendingMap[cat] || 0) + (e.amount_bdt || 0);
  });

  const budgetStatuses = currentBudgets.map((b) => {
    const spent = categorySpendingMap[b.category] || 0;
    const pct = b.monthly_limit_bdt > 0 ? Math.round((spent / b.monthly_limit_bdt) * 100) : 0;
    const isOver = spent > b.monthly_limit_bdt;
    return { ...b, spent, pct, isOver };
  });

  const overBudgetCount = budgetStatuses.filter((b) => b.isOver).length;

  // Recent transactions (combined income & expense sorted by date desc)
  const recentTransactions = [...entries]
    .filter((e) => e.entry_type === 'expense' || e.entry_type === 'income')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 6);

  // Currency Formatter
  const formatBDT = (amount: number): string => {
    return `৳${Math.round(amount).toLocaleString('en-US')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Month Summary */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-4 sm:p-5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {currentMonthName} Overview
            </span>
            <span className="text-xs text-zinc-600 font-poppins">BDT Standard</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Net Cashflow: <span className={monthNetSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {monthNetSavings >= 0 ? '+' : ''}{formatBDT(monthNetSavings)}
            </span>
          </h2>
          <p className="text-xs text-zinc-600">
            Savings rate: <strong className={monthSavingsRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{monthSavingsRate}%</strong> of this month's revenue saved
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="fin-quick-expense-btn"
            onClick={() => onSwitchTab('expenses')}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.full,
              minHeight: '36px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Log Expense</span>
          </button>
          <button
            id="fin-quick-income-btn"
            onClick={() => onSwitchTab('income')}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.full,
              borderColor: theme.colors.borderLight,
              minHeight: '36px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border hover:bg-zinc-200 transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Income</span>
          </button>
          <button
            id="fin-quick-calc-btn"
            onClick={() => onSwitchTab('calculator')}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.full,
              borderColor: theme.colors.borderLight,
              minHeight: '36px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border hover:bg-zinc-200 transition-colors cursor-pointer shadow-2xs"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-600" />
            <span>Calculation Hub</span>
          </button>
        </div>
      </div>

      {/* 4 KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Net Balance */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-600">
            <span className="text-xs font-medium">Total Balance</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900">
            {formatBDT(netBalance)}
          </div>
          <p className="text-[11px] text-zinc-600">Lifetime net liquidity</p>
        </div>

        {/* Card 2: This Month's Income */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-600">
            <span className="text-xs font-medium">Month Income</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-emerald-700">
            {formatBDT(monthIncomeTotal)}
          </div>
          <p className="text-[11px] text-zinc-600">{monthIncomeEntries.length} receipts logged</p>
        </div>

        {/* Card 3: This Month's Expenses */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-600">
            <span className="text-xs font-medium">Month Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-rose-700">
            {formatBDT(monthExpenseTotal)}
          </div>
          <p className="text-[11px] text-zinc-600">{monthExpenseEntries.length} expense items</p>
        </div>

        {/* Card 4: Recurring Commitments */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-600">
            <span className="text-xs font-medium">Monthly Recurring</span>
            <Repeat className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-purple-700">
            {formatBDT(monthlyRecurringTotal)}
          </div>
          <p className="text-[11px] text-zinc-600">{recurringEntries.length} subscriptions & bills</p>
        </div>
      </div>

      {/* TWO COLUMNS: Budgets & Savings Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Column 1: Active Budgets Tracker */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 sm:p-5 border shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-zinc-900">Budget Health</h3>
              {overBudgetCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{overBudgetCount} Over Budget</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Healthy</span>
                </span>
              )}
            </div>
            <button
              onClick={() => onSwitchTab('budgets')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Budgets</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {budgetStatuses.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg">
              <PiggyBank className="w-8 h-8 text-zinc-300 mx-auto mb-1.5" />
              <p className="text-xs text-zinc-500 font-medium">No category budgets created yet.</p>
              <button
                onClick={() => onSwitchTab('budgets')}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                + Set monthly budget targets
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetStatuses.slice(0, 4).map((b) => {
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-800">{b.category}</span>
                      <span className={b.isOver ? 'font-bold text-rose-600' : 'text-zinc-600'}>
                        {formatBDT(b.spent)} / {formatBDT(b.monthly_limit_bdt)} ({b.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          b.pct > 100
                            ? 'bg-rose-500'
                            : b.pct > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Savings Goals Tracker */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 sm:p-5 border shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-zinc-900">Savings Goals</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-700">
                {savingsGoals.length} Active
              </span>
            </div>
            <button
              onClick={() => onSwitchTab('savings')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View All Goals</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg">
              <Target className="w-8 h-8 text-zinc-300 mx-auto mb-1.5" />
              <p className="text-xs text-zinc-500 font-medium">No savings goals established yet.</p>
              <button
                onClick={() => onSwitchTab('savings')}
                className="mt-2 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
              >
                + Define your first goal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savingsGoals.slice(0, 4).map((g) => {
                const current = g.current_amount_bdt || 0;
                const target = g.target_amount_bdt || 1;
                const pct = Math.min(100, Math.round((current / target) * 100));
                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-800">{g.goal_name}</span>
                      <span className="text-zinc-600 font-poppins tabular-nums font-medium">
                        {formatBDT(current)} / {formatBDT(target)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RECENT TRANSACTIONS FEED */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-4 sm:p-5 border shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Recent Transactions</h3>
            <p className="text-xs text-zinc-600">Chronological history of recent inflows and expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSwitchTab('expenses')}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
            >
              All Expenses
            </button>
            <span className="text-zinc-300">•</span>
            <button
              onClick={() => onSwitchTab('income')}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
            >
              All Income
            </button>
            <span className="text-zinc-300">•</span>
            <button
              onClick={() => onSwitchTab('reports')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Financial Reports
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">
            No transactions logged yet. Use "Log Expense" or "Add Income" above to begin.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentTransactions.map((tx) => {
              const isIncome = tx.entry_type === 'income';
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 truncate">
                        {tx.notes || tx.category}
                      </div>
                      <div className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 font-medium">
                          {tx.category}
                        </span>
                        <span>•</span>
                        <span>{tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-bold font-poppins tabular-nums text-xs sm:text-sm shrink-0 ${
                      isIncome ? 'text-emerald-700' : 'text-zinc-900'
                    }`}
                  >
                    {isIncome ? '+' : '-'}{formatBDT(tx.amount_bdt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK LAUNCHERS TO ALL FINANCIAL TOOLS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-1">
        <button
          onClick={() => onSwitchTab('calculator')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between bg-gradient-to-br from-blue-50/30 to-transparent"
        >
          <Calculator className="w-4 h-4 text-blue-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Calculator</div>
            <div className="text-[10px] text-zinc-600">Rough simulations</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('expenses')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <ArrowDownLeft className="w-4 h-4 text-rose-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Expenses</div>
            <div className="text-[10px] text-zinc-600">{expenseEntries.length} items</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('income')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <ArrowUpRight className="w-4 h-4 text-emerald-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Income</div>
            <div className="text-[10px] text-zinc-600">{incomeEntries.length} entries</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('budgets')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <PiggyBank className="w-4 h-4 text-amber-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Budgets</div>
            <div className="text-[10px] text-zinc-600">{budgets.length} categories</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('savings')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <Target className="w-4 h-4 text-teal-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Savings</div>
            <div className="text-[10px] text-zinc-600">{savingsGoals.length} goals</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('recurring')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <Repeat className="w-4 h-4 text-purple-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Recurring</div>
            <div className="text-[10px] text-zinc-600">{recurringEntries.length} recurring</div>
          </div>
        </button>

        <button
          onClick={() => onSwitchTab('reports')}
          style={{ backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }}
          className="p-3 border rounded-lg hover:border-zinc-400 text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <BarChart3 className="w-4 h-4 text-blue-600 mb-1" />
          <div>
            <div className="text-xs font-bold text-zinc-900">Reports</div>
            <div className="text-[10px] text-zinc-600">Deep analysis</div>
          </div>
        </button>
      </div>
    </div>
  );
};
