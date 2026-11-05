import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DailyTask, DailyTaskSession, WorkThread, IdeaNote } from '../../types/workspace';
import { FinancialEntry, Budget, SavingsGoal } from '../../types/financial';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  GitBranch, 
  Lightbulb, 
  Wallet, 
  PiggyBank, 
  Target, 
  Award,
  Calendar,
  Flame
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [sessions, setSessions] = useState<DailyTaskSession[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [notes, setNotes] = useState<IdeaNote[]>([]);
  const [finEntries, setFinEntries] = useState<FinancialEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [activeTab, setActiveTab] = useState<'all' | 'productivity' | 'finances'>('all');

  const todayDateStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    if (!user) return;

    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_tasks')
    );

    const qSessions = query(collection(db, 'daily_task_sessions'), where('owner_uid', '==', user.uid));
    const unsubSessions = onSnapshot(
      qSessions,
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTaskSession))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_task_sessions')
    );

    const qThreads = query(collection(db, 'work_threads'), where('owner_uid', '==', user.uid));
    const unsubThreads = onSnapshot(
      qThreads,
      (snap) => setThreads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkThread))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'work_threads')
    );

    const qNotes = query(collection(db, 'idea_notes'), where('owner_uid', '==', user.uid));
    const unsubNotes = onSnapshot(
      qNotes,
      (snap) => setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaNote))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_notes')
    );

    const qFin = query(collection(db, 'financial_entries'), where('owner_uid', '==', user.uid));
    const unsubFin = onSnapshot(
      qFin,
      (snap) => setFinEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialEntry))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_entries')
    );

    const qBudgets = query(collection(db, 'budgets'), where('owner_uid', '==', user.uid));
    const unsubBudgets = onSnapshot(
      qBudgets,
      (snap) => setBudgets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Budget))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'budgets')
    );

    const qSavings = query(collection(db, 'savings_goals'), where('owner_uid', '==', user.uid));
    const unsubSavings = onSnapshot(
      qSavings,
      (snap) => setSavingsGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsGoal))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'savings_goals')
    );

    return () => {
      unsubTasks();
      unsubSessions();
      unsubThreads();
      unsubNotes();
      unsubFin();
      unsubBudgets();
      unsubSavings();
    };
  }, [user]);

  // Productivity Analytics
  const doneTodayCount = tasks.filter((t) => t.last_completed_at?.startsWith(todayDateStr)).length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((doneTodayCount / tasks.length) * 100) : 0;
  const totalFocusMinutesAllTime = sessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  const todayFocusMinutes = sessions
    .filter((s) => s.date === todayDateStr)
    .reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

  // Work Threads
  const inProgressThreads = threads.filter((t) => t.status === 'in_progress').length;
  const doneThreads = threads.filter((t) => t.status === 'done').length;
  const pausedThreads = threads.filter((t) => t.status === 'paused').length;

  // Financial Analytics
  const monthExpenses = finEntries
    .filter((e) => e.entry_type === 'expense' && e.date?.startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  const monthIncome = finEntries
    .filter((e) => e.entry_type === 'income' && e.date?.startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  const netSavingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0;

  // Category expense breakdown
  const categoryExpenses: Record<string, number> = {};
  finEntries
    .filter((e) => e.entry_type === 'expense' && e.date?.startsWith(currentMonthStr))
    .forEach((e) => {
      const cat = e.category || 'General';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + (e.amount_bdt || 0);
    });

  const sortedCategories = Object.entries(categoryExpenses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Last 7 days focus minutes breakdown
  const last7Days: { dateStr: string; label: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMins = sessions
      .filter((s) => s.date === dStr)
      .reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
    last7Days.push({ dateStr: dStr, label: dayLabel, minutes: dayMins });
  }

  const maxDailyMinutes = Math.max(1, ...last7Days.map((d) => d.minutes));

  // Overall Productivity Score (0 - 100)
  const productivityScore = Math.min(
    100,
    Math.round(
      (taskCompletionRate * 0.4) +
      (Math.min(todayFocusMinutes, 120) / 120 * 30) +
      (threads.length > 0 ? (doneThreads / threads.length) * 30 : 20)
    )
  );

  const formatMinutes = (min: number): string => {
    if (min <= 0) return '0m';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatBDT = (amount: number): string => {
    return `৳${Math.round(amount).toLocaleString('en-US')}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-8 sm:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            Analytics & Insights
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Holistic cross-module tracking for focus habits, financial burn rate, and project momentum
          </p>
        </div>

        {/* View Switcher Capsule */}
        <div
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.full,
          }}
          className="p-1 border flex items-center gap-1 shrink-0 shadow-2xs self-start sm:self-auto"
        >
          <button
            onClick={() => setActiveTab('all')}
            style={{
              backgroundColor: activeTab === 'all' ? theme.colors.bgCard : 'transparent',
              color: activeTab === 'all' ? theme.colors.textPrimary : theme.colors.textSecondary,
              borderRadius: theme.radius.full,
              minHeight: '32px',
            }}
            className={`px-3 py-1 text-xs cursor-pointer font-medium transition-all ${
              activeTab === 'all' ? 'shadow-xs font-bold text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('productivity')}
            style={{
              backgroundColor: activeTab === 'productivity' ? theme.colors.bgCard : 'transparent',
              color: activeTab === 'productivity' ? theme.colors.textPrimary : theme.colors.textSecondary,
              borderRadius: theme.radius.full,
              minHeight: '32px',
            }}
            className={`px-3 py-1 text-xs cursor-pointer font-medium transition-all ${
              activeTab === 'productivity' ? 'shadow-xs font-bold text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Productivity
          </button>
          <button
            onClick={() => setActiveTab('finances')}
            style={{
              backgroundColor: activeTab === 'finances' ? theme.colors.bgCard : 'transparent',
              color: activeTab === 'finances' ? theme.colors.textPrimary : theme.colors.textSecondary,
              borderRadius: theme.radius.full,
              minHeight: '32px',
            }}
            className={`px-3 py-1 text-xs cursor-pointer font-medium transition-all ${
              activeTab === 'finances' ? 'shadow-xs font-bold text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Finances
          </button>
        </div>
      </div>

      {/* TOP SUMMARY SCORE & KPI BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Daily Completion Score */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Productivity Index</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {productivityScore}<span className="text-xs text-zinc-400 font-normal"> / 100</span>
          </div>
          <p className="text-[11px] text-zinc-500">Weighted focus & habit index</p>
        </div>

        {/* Metric 2: Today's Focus Minutes */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Today's Focus Time</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600">
            {formatMinutes(todayFocusMinutes)}
          </div>
          <p className="text-[11px] text-zinc-500">{formatMinutes(totalFocusMinutesAllTime)} all-time tracked</p>
        </div>

        {/* Metric 3: Monthly Net Savings Rate */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Monthly Savings Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={`text-2xl font-bold tracking-tight ${netSavingsRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {netSavingsRate}%
          </div>
          <p className="text-[11px] text-zinc-500">{formatBDT(monthIncome - monthExpenses)} net retained</p>
        </div>

        {/* Metric 4: Project Delivery Ratio */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Work Threads Done</span>
            <GitBranch className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-purple-700">
            {doneThreads} <span className="text-xs text-zinc-400 font-normal">/ {threads.length} total</span>
          </div>
          <p className="text-[11px] text-zinc-500">{inProgressThreads} workflows currently active</p>
        </div>
      </div>

      {/* 7-DAY FOCUS TIME VISUAL BAR CHART */}
      {(activeTab === 'all' || activeTab === 'productivity') && (
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
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-zinc-900">7-Day Focus Trend</h3>
            </div>
            <span className="text-xs text-zinc-500 font-medium">Daily Tracked Time</span>
          </div>

          <div className="pt-2">
            <div className="flex items-end justify-between gap-2 h-36 border-b border-zinc-200 pb-2">
              {last7Days.map((day) => {
                const heightPct = Math.max(8, Math.round((day.minutes / maxDailyMinutes) * 100));
                const isToday = day.dateStr === todayDateStr;
                return (
                  <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[10px] text-zinc-400 font-poppins tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatMinutes(day.minutes)}
                    </div>
                    <div
                      style={{
                        height: `${heightPct}%`,
                      }}
                      className={`w-full max-w-[42px] rounded-t-md transition-all duration-300 ${
                        isToday
                          ? 'bg-blue-600'
                          : day.minutes > 0
                          ? 'bg-blue-300 group-hover:bg-blue-400'
                          : 'bg-zinc-100'
                      }`}
                    />
                    <span className={`text-[11px] font-medium ${isToday ? 'font-bold text-blue-600' : 'text-zinc-500'}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL BREAKDOWNS & EXPENSE CATEGORIES */}
      {(activeTab === 'all' || activeTab === 'finances') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box 1: Category Expense Proportions */}
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
                <Wallet className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-zinc-900">Spending by Category</h3>
              </div>
              <span className="text-xs text-zinc-500">This Month</span>
            </div>

            {sortedCategories.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-6 text-center">
                No expense entries logged for this month.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedCategories.map(([category, amount]) => {
                  const pct = monthExpenses > 0 ? Math.round((amount / monthExpenses) * 100) : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-800">{category}</span>
                        <span className="text-zinc-500 font-poppins tabular-nums font-medium">
                          {formatBDT(amount)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Box 2: Budgets & Savings Goal Completion */}
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
                <h3 className="text-sm font-bold text-zinc-900">Savings Target Progress</h3>
              </div>
              <span className="text-xs text-zinc-500">{savingsGoals.length} Goals</span>
            </div>

            {savingsGoals.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-6 text-center">
                No savings goals established yet.
              </p>
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
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
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
      )}
    </div>
  );
};
