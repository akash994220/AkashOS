import React, { useState, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { FinancialEntry } from '../../types/financial';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle,
} from 'lucide-react';

interface AnalyticsViewProps {
  entries: FinancialEntry[];
}

export const RedesignedAnalyticsView: React.FC<AnalyticsViewProps> = ({ entries }) => {
  const { theme } = useTheme();

  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [activeSegment, setActiveSegment] = useState<'expense' | 'income'>('expense');

  // Format Currency
  const formatBDT = (amount: number): string => {
    return `৳${Math.round(amount).toLocaleString('en-US')}`;
  };

  // Month entries
  const monthEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.timing_mode === 'monthly') {
        return !e.target_month || e.target_month === selectedMonth;
      }
      return e.date?.startsWith(selectedMonth);
    });
  }, [entries, selectedMonth]);

  // Overall totals
  const totalIncome = monthEntries
    .filter((e) => e.entry_type === 'income')
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const totalExpense = monthEntries
    .filter((e) => e.entry_type === 'expense')
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((Math.max(0, netSavings) / totalIncome) * 100) : 0;

  // Breakdown by Category
  const categoryBreakdown = useMemo(() => {
    const targetType = activeSegment;
    const filtered = monthEntries.filter((e) => e.entry_type === targetType);
    const map: Record<string, number> = {};

    filtered.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + (e.amount_bdt || 0);
    });

    const total = targetType === 'expense' ? totalExpense : totalIncome;

    return Object.entries(map)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthEntries, activeSegment, totalExpense, totalIncome]);

  // Historical Monthly Trajectory (Last 6 Months)
  const last6MonthsTrajectory = useMemo(() => {
    const list: { month: string; label: string; income: number; expense: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toISOString().substring(0, 7);
      const label = d.toLocaleString('default', { month: 'short' });

      const inSum = entries
        .filter((e) => e.entry_type === 'income' && (e.date?.startsWith(mStr) || e.target_month === mStr))
        .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

      const exSum = entries
        .filter((e) => e.entry_type === 'expense' && (e.date?.startsWith(mStr) || e.target_month === mStr))
        .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

      list.push({
        month: mStr,
        label,
        income: inSum,
        expense: exSum,
        net: inSum - exSum,
      });
    }
    return list;
  }, [entries, now]);

  const maxTrajectoryValue = Math.max(
    ...last6MonthsTrajectory.map((m) => Math.max(m.income, m.expense)),
    1000
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Month Picker & Big Overview */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-5 border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
            Financial Analytics & Trends
          </h2>
          <p className="text-xs text-zinc-500">
            Cash flow distribution, savings velocity, and trajectory breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Analysis Period:
          </span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:border-zinc-800 font-tabular"
          />
        </div>
      </div>

      {/* 2. THREE KEY METRIC TILES FOR SELECTED MONTH */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            Total Earnings
          </div>
          <div className="text-xl font-bold text-emerald-700 font-tabular mt-1">
            +{formatBDT(totalIncome)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Inflow for {selectedMonth}</div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            Total Expenses
          </div>
          <div className="text-xl font-bold text-rose-700 font-tabular mt-1">
            -{formatBDT(totalExpense)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Outflow for {selectedMonth}</div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs"
        >
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-indigo-600" />
            Net Savings & Rate
          </div>
          <div
            className={`text-xl font-bold font-tabular mt-1 ${
              netSavings >= 0 ? 'text-zinc-900' : 'text-rose-600'
            }`}
          >
            {netSavings >= 0 ? '+' : ''}
            {formatBDT(netSavings)}
          </div>
          <div className="text-[11px] text-zinc-500 font-semibold mt-0.5">
            {savingsRate}% retained
          </div>
        </div>
      </div>

      {/* 3. HISTORICAL 6-MONTH TRAJECTORY CHART */}
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
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight">6-Month Cash Flow Trajectory</h3>
            <p className="text-xs text-zinc-500">Monthly earnings (green) vs expenses (rose)</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Earnings
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Expenses
            </span>
          </div>
        </div>

        {/* Bar chart representation */}
        <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end pt-8 pb-2 h-48 border-b border-zinc-100">
          {last6MonthsTrajectory.map((item) => {
            const incHeightPct = Math.round((item.income / maxTrajectoryValue) * 100);
            const expHeightPct = Math.round((item.expense / maxTrajectoryValue) * 100);

            return (
              <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                  {/* Income bar */}
                  <div
                    title={`Earnings: ${formatBDT(item.income)}`}
                    style={{ height: `${Math.max(4, incHeightPct)}%` }}
                    className="w-3.5 sm:w-6 bg-emerald-500 rounded-t-md transition-all duration-300 group-hover:bg-emerald-600"
                  />
                  {/* Expense bar */}
                  <div
                    title={`Expenses: ${formatBDT(item.expense)}`}
                    style={{ height: `${Math.max(4, expHeightPct)}%` }}
                    className="w-3.5 sm:w-6 bg-rose-500 rounded-t-md transition-all duration-300 group-hover:bg-rose-600"
                  />
                </div>
                <div className="text-[11px] font-bold text-zinc-600 mt-2 truncate">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CATEGORY DISTRIBUTION BREAKDOWN */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-5 border shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Category Distribution</h3>
            <p className="text-xs text-zinc-500">Breakdown of allocation for {selectedMonth}</p>
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              onClick={() => setActiveSegment('expense')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeSegment === 'expense'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Expense Categories
            </button>
            <button
              onClick={() => setActiveSegment('income')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeSegment === 'income'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Income Sources
            </button>
          </div>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No {activeSegment} records recorded for {selectedMonth}.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {categoryBreakdown.map((item, idx) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-800">{item.category}</span>
                    <span className="text-[10px] text-zinc-400 font-medium">({item.percentage}%)</span>
                  </div>
                  <span className="font-bold text-zinc-900 font-tabular">{formatBDT(item.amount)}</span>
                </div>

                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeSegment === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
