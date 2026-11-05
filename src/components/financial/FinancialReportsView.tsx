import React, { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry } from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { BarChart3, TrendingUp, TrendingDown, PieChart, Download } from 'lucide-react';

interface FinancialReportsViewProps {
  entries: FinancialEntry[];
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({ entries }) => {
  const { theme } = useTheme();

  const exportTransactionsCSV = () => {
    if (entries.length === 0) {
      alert('No financial transactions available to export.');
      return;
    }
    const headers = ['Date', 'Type', 'Category', 'Notes/Payee', 'Amount (BDT)', 'Foreign Currency', 'Foreign Amount'];
    const rows = entries.map((e) => [
      `"${e.date}"`,
      `"${e.entry_type}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.amount_bdt || 0,
      `"${e.foreign_currency || 'BDT'}"`,
      e.foreign_amount || e.amount_bdt || 0,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute Last 6 Months metrics
  const monthlyData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().substring(0, 7)); // YYYY-MM
    }

    return months.map((monthKey) => {
      const monthEntries = entries.filter((e) => e.date.startsWith(monthKey));
      const income = monthEntries
        .filter((e) => e.entry_type === 'income')
        .reduce((sum, e) => sum + (Number(e.amount_bdt) || 0), 0);
      const expense = monthEntries
        .filter((e) => e.entry_type === 'expense')
        .reduce((sum, e) => sum + (Number(e.amount_bdt) || 0), 0);
      const net = income - expense;

      const dateObj = new Date(`${monthKey}-01`);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      return {
        monthKey,
        label,
        income,
        expense,
        net,
      };
    });
  }, [entries]);

  // Compute Biggest Categories all-time or last 6 months
  const categoryBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let totalExpense = 0;

    entries
      .filter((e) => e.entry_type === 'expense')
      .forEach((e) => {
        const amt = Number(e.amount_bdt) || 0;
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + amt;
        totalExpense += amt;
      });

    return Object.entries(categoryTotals)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [entries]);

  // Overall totals
  const totalIncomeAll = entries
    .filter((e) => e.entry_type === 'income')
    .reduce((sum, e) => sum + (Number(e.amount_bdt) || 0), 0);
  const totalExpenseAll = entries
    .filter((e) => e.entry_type === 'expense')
    .reduce((sum, e) => sum + (Number(e.amount_bdt) || 0), 0);
  const netSavingsAll = totalIncomeAll - totalExpenseAll;

  // Max value for chart scaling
  const maxMonthValue = Math.max(
    ...monthlyData.map((d) => Math.max(d.income, d.expense)),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar with CSV Export */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Financial Reports & Trends</h2>
          <p className="text-xs text-zinc-500">Historical performance, category breakdowns, and export</p>
        </div>

        <button
          type="button"
          onClick={exportTransactionsCSV}
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.full,
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 border hover:bg-zinc-100 cursor-pointer transition-colors shadow-2xs shrink-0"
          title="Export all transactions to spreadsheet CSV"
        >
          <Download className="w-3.5 h-3.5 text-blue-600" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* High-level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.lg,
          }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Cumulative Income</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <CurrencyDisplay amountBdt={totalIncomeAll} size="xl" className="text-emerald-700 font-bold" />
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.lg,
          }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Cumulative Expenses</span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <CurrencyDisplay amountBdt={totalExpenseAll} size="xl" className="text-red-700 font-bold" />
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.lg,
          }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Net Financial Balance</span>
            <span className={`text-xs font-bold ${netSavingsAll >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netSavingsAll >= 0 ? '+Surplus' : '-Deficit'}
            </span>
          </div>
          <CurrencyDisplay
            amountBdt={Math.abs(netSavingsAll)}
            isNegative={netSavingsAll < 0}
            size="xl"
            className={netSavingsAll >= 0 ? 'text-zinc-900 font-bold' : 'text-red-700 font-bold'}
          />
        </div>
      </div>

      {/* Monthly Trend Chart: Income vs Expense */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.xl,
          border: `1px solid ${theme.colors.borderLight}`,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.lg,
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-zinc-800">Monthly Cashflow Trend (Past 6 Months)</h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-zinc-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Income
            </span>
            <span className="flex items-center gap-1 text-zinc-600">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              Expense
            </span>
          </div>
        </div>

        {/* Bar Visualizer */}
        <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-6 pb-2 items-end h-48 border-b border-zinc-100">
          {monthlyData.map((m) => {
            const incomeHeight = maxMonthValue > 0 ? (m.income / maxMonthValue) * 100 : 0;
            const expenseHeight = maxMonthValue > 0 ? (m.expense / maxMonthValue) * 100 : 0;

            return (
              <div key={m.monthKey} className="flex flex-col items-center h-full justify-end gap-1.5 group">
                <div className="flex items-end gap-1 sm:gap-2 h-full w-full justify-center">
                  {/* Income bar */}
                  <div
                    style={{ height: `${Math.max(incomeHeight, 2)}%` }}
                    className="w-2 sm:w-4 bg-emerald-400 hover:bg-emerald-500 rounded-t transition-all relative"
                    title={`Income: ৳${m.income.toLocaleString()}`}
                  />
                  {/* Expense bar */}
                  <div
                    style={{ height: `${Math.max(expenseHeight, 2)}%` }}
                    className="w-2 sm:w-4 bg-red-400 hover:bg-red-500 rounded-t transition-all relative"
                    title={`Expense: ৳${m.expense.toLocaleString()}`}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-500">{m.label}</span>
              </div>
            );
          })}
        </div>

        {/* Monthly breakdown table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 font-medium">Income (BDT)</th>
                <th className="py-2 font-medium">Expenses (BDT)</th>
                <th className="py-2 font-medium text-right">Net Flow</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m) => (
                <tr key={m.monthKey} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="py-2 font-semibold text-zinc-700">{m.label}</td>
                  <td className="py-2 text-emerald-700 font-medium">৳{m.income.toLocaleString()}</td>
                  <td className="py-2 text-red-700 font-medium">৳{m.expense.toLocaleString()}</td>
                  <td className={`py-2 text-right font-bold ${m.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.net >= 0 ? '+' : ''}৳{m.net.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biggest Spending Categories */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.xl,
          border: `1px solid ${theme.colors.borderLight}`,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.lg,
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-zinc-800">Top Expense Categories</h3>
        </div>

        <div className="space-y-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-800">{cat.category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 font-bold">৳{cat.amount.toLocaleString()}</span>
                  <span className="text-[11px] text-zinc-400 w-8 text-right">{cat.percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}

          {categoryBreakdown.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-4">
              No expense records to analyze yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
