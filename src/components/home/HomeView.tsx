import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation, WorkspaceSection } from '../../context/NavigationContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { DailyTask, DailyTaskSession, WorkThread, IdeaNote } from '../../types/workspace';
import { FinancialEntry } from '../../types/financial';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle,
  Clock, 
  GitBranch, 
  Lightbulb, 
  Clapperboard, 
  Wallet, 
  ArrowRight, 
  Sparkles, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Play,
  Layers,
  Search
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { openWorkspaceApp, setActiveSection } = useNavigation();

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [todaySessions, setTodaySessions] = useState<DailyTaskSession[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [notes, setNotes] = useState<IdeaNote[]>([]);
  const [finEntries, setFinEntries] = useState<FinancialEntry[]>([]);
  const [activeTabFilter, setActiveTabFilter] = useState<'remaining' | 'all'>('remaining');

  const todayDateStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  // Time of day greeting
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  // Fetch Firestore summaries
  useEffect(() => {
    if (!user || !db) return;

    // 1. Daily tasks
    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_tasks')
    );

    // 2. Daily sessions
    const qSessions = query(collection(db, 'daily_task_sessions'), where('owner_uid', '==', user.uid));
    const unsubSessions = onSnapshot(
      qSessions,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTaskSession));
        setTodaySessions(list.filter((s) => s.date === todayDateStr));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_task_sessions')
    );

    // 3. Work threads
    const qThreads = query(collection(db, 'work_threads'), where('owner_uid', '==', user.uid));
    const unsubThreads = onSnapshot(
      qThreads,
      (snap) => setThreads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkThread))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'work_threads')
    );

    // 4. Notes
    const qNotes = query(collection(db, 'idea_notes'), where('owner_uid', '==', user.uid));
    const unsubNotes = onSnapshot(
      qNotes,
      (snap) => setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaNote))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_notes')
    );

    // 5. Financial entries
    const qFin = query(collection(db, 'financial_entries'), where('owner_uid', '==', user.uid));
    const unsubFin = onSnapshot(
      qFin,
      (snap) => setFinEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialEntry))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_entries')
    );

    return () => {
      unsubTasks();
      unsubSessions();
      unsubThreads();
      unsubNotes();
      unsubFin();
    };
  }, [user, todayDateStr]);

  // Aggregated calculations
  const doneTasks = tasks.filter((t) => t.last_completed_at?.startsWith(todayDateStr));
  const pendingTasks = tasks.filter((t) => !t.last_completed_at?.startsWith(todayDateStr));
  const todayFocusMinutes = todaySessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

  const completionPercentage = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const inProgressThreads = threads.filter((t) => t.status === 'in_progress');
  const lastActiveThread = inProgressThreads.find((t) => t.left_off_notes?.trim()) || inProgressThreads[0];

  const monthExpenses = finEntries
    .filter((e) => e.entry_type === 'expense' && e.date?.startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  const monthIncome = finEntries
    .filter((e) => e.entry_type === 'income' && e.date?.startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + (curr.amount_bdt || 0), 0);

  const netMonthCashflow = monthIncome - monthExpenses;

  // Toggle routine item directly with optimistic feel
  const handleToggleTask = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;

    const isDone = task.last_completed_at?.startsWith(todayDateStr);
    const newCompletedAt = isDone ? null : new Date().toISOString();

    try {
      await updateDoc(doc(db, 'daily_tasks', task.id), {
        last_completed_at: newCompletedAt,
      });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  // 3 Purposeful Domains as outlined in Native Redesign
  const domainGroups = [
    {
      domainName: 'Focus & Execution',
      description: 'Daily habits, routines, and multi-step active workflows',
      apps: [
        {
          id: 'daily_tasks' as WorkspaceSection,
          title: 'Tasks',
          desc: 'Routines and checklist with focus timers',
          badge: `${doneTasks.length}/${tasks.length} Done`,
          badgeColor: 'bg-blue-50 text-blue-700',
          icon: CheckCircle2,
          iconBg: 'bg-blue-500/10 text-blue-600',
        },
        {
          id: 'work_threads' as WorkspaceSection,
          title: 'Work Threads',
          desc: 'Staging links, context checkpoints & workflows',
          badge: `${inProgressThreads.length} In Progress`,
          badgeColor: 'bg-purple-50 text-purple-700',
          icon: GitBranch,
          iconBg: 'bg-purple-500/10 text-purple-600',
        },
      ],
    },
    {
      domainName: 'Creation & Wealth',
      description: 'Content production pipelines and multi-currency personal cashflow',
      apps: [
        {
          id: 'content' as WorkspaceSection,
          title: 'Content Creation Studio',
          desc: 'YouTube, TikTok scripts, SEO tags & pipeline',
          badge: 'Publish Pipeline',
          badgeColor: 'bg-emerald-50 text-emerald-700',
          icon: Clapperboard,
          iconBg: 'bg-emerald-500/10 text-emerald-600',
        },
        {
          id: 'financial' as WorkspaceSection,
          title: 'Financial Management',
          desc: 'Expense logs, monthly budgets & BDT cashflow',
          badge: `৳${Math.round(netMonthCashflow).toLocaleString('en-US')}`,
          badgeColor: 'bg-teal-50 text-teal-700',
          icon: Wallet,
          iconBg: 'bg-teal-500/10 text-teal-600',
        },
      ],
    },
    {
      domainName: 'Knowledge & Vault',
      description: 'Zero-friction ideas inbox, notes, and encrypted secret vault',
      apps: [
        {
          id: 'ideas_notes' as WorkspaceSection,
          title: 'Ideas & Note Spaces',
          desc: 'Frictionless capture and customizable note spaces',
          badge: `${notes.length} Notes`,
          badgeColor: 'bg-amber-50 text-amber-700',
          icon: Lightbulb,
          iconBg: 'bg-amber-500/10 text-amber-600',
        },
        {
          id: 'vault' as WorkspaceSection,
          title: 'Secret Vault',
          desc: 'Encrypted logins, passwords, cards & custom secrets',
          badge: 'Secure Vault',
          badgeColor: 'bg-indigo-50 text-indigo-700',
          icon: ShieldCheck,
          iconBg: 'bg-indigo-500/10 text-indigo-600',
        },
      ],
    },
  ];

  // SVG Progress Ring calculations
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (completionPercentage / 100) * ringCircumference;

  const displayTasks = activeTabFilter === 'remaining' ? pendingTasks : tasks;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-8 sm:pb-12">
      {/* 1. NATIVE EDITORIAL HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">
            {formattedDate}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            {getGreeting()}, {user?.displayName || user?.email?.split('@')[0] || 'Creator'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            {lastActiveThread ? (
              <span>
                Active thread: <strong className="text-zinc-800 font-semibold">{lastActiveThread.site_or_app_name}</strong> • {pendingTasks.length} habits to conquer today
              </span>
            ) : (
              <span>All systems synchronized • {pendingTasks.length} habits remaining today</span>
            )}
          </p>
        </div>

        {/* Direct Action Trigger */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          id="home-new-task-btn"
          onClick={() => openWorkspaceApp('daily_tasks')}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Routine</span>
        </motion.button>
      </div>

      {/* 2. NATIVE HERO STATUS STRIP (3 Floating Glass Status Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Habit Progress Ring */}
        <div 
          onClick={() => openWorkspaceApp('daily_tasks')}
          className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Daily Routines
            </span>
            <div className="text-lg font-extrabold text-zinc-900">
              {doneTasks.length} of {tasks.length} Done
            </div>
            <p className="text-xs text-zinc-500 font-medium">
              {todayFocusMinutes > 0 ? `${todayFocusMinutes}m focused today` : 'Tap to start focus'}
            </p>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                stroke="#F4F4F5"
                strokeWidth="5.5"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                stroke="#10B981"
                strokeWidth="5.5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-xs font-bold text-zinc-800">
              {completionPercentage}%
            </span>
          </div>
        </div>

        {/* Card 2: Context Resumption Beacon */}
        <div 
          onClick={() => openWorkspaceApp('work_threads')}
          className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Context</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                Work Thread
              </span>
            </div>

            <h3 className="text-sm font-bold text-zinc-900 truncate mt-1">
              {lastActiveThread ? lastActiveThread.site_or_app_name : 'No active thread'}
            </h3>

            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed italic">
              {lastActiveThread?.left_off_notes ? `"${lastActiveThread.left_off_notes}"` : 'Pick up where you left off or start a new branch'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-purple-600 group-hover:translate-x-0.5 transition-transform">
            <span>Resume workflow</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 3: Financial Cashflow Pulse */}
        <div 
          onClick={() => openWorkspaceApp('financial')}
          className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Monthly Net Cashflow
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                BDT ৳
              </span>
            </div>

            <div className="text-xl font-extrabold text-zinc-900 tracking-tight">
              ৳ {Math.round(netMonthCashflow).toLocaleString('en-US')}
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>+৳{Math.round(monthIncome).toLocaleString('en-US')}</span>
              </span>
              <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />
                <span>-৳{Math.round(monthExpenses).toLocaleString('en-US')}</span>
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-teal-600 group-hover:translate-x-0.5 transition-transform">
            <span>Financial dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. ACTIONABLE "TODAY'S PRIORITIES" (Grouped Inset Style) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              Today's Priorities
            </h2>
            <span className="text-xs font-bold text-zinc-400">
              ({pendingTasks.length} left)
            </span>
          </div>

          {/* Filter segment */}
          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTabFilter('remaining')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTabFilter === 'remaining'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Remaining
            </button>
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTabFilter === 'all'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              All ({tasks.length})
            </button>
          </div>
        </div>

        {/* Grouped Inset Container */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/4 overflow-hidden divide-y divide-zinc-100">
          {displayTasks.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-zinc-800">
                {activeTabFilter === 'remaining' ? 'All habits completed for today!' : 'No tasks registered yet.'}
              </p>
              <button
                onClick={() => openWorkspaceApp('daily_tasks')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                + Add a new routine
              </button>
            </div>
          ) : (
            displayTasks.slice(0, 5).map((task) => {
              const isDone = task.last_completed_at?.startsWith(todayDateStr);
              return (
                <div
                  key={task.task_id}
                  onClick={() => openWorkspaceApp('daily_tasks')}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Native Tactile Checkbox Button */}
                    <motion.button
                      whileTap={{ scale: 0.82 }}
                      type="button"
                      onClick={(e) => handleToggleTask(task, e)}
                      className="shrink-0 p-1 -ml-1 text-zinc-300 hover:text-emerald-600 cursor-pointer rounded-full transition-colors"
                      aria-label="Toggle task completion"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-300 hover:text-zinc-500" />
                      )}
                    </motion.button>

                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-semibold truncate ${
                        isDone ? 'line-through text-zinc-400 font-normal' : 'text-zinc-900'
                      }`}>
                        {task.title}
                      </p>
                      {task.subtitle && (
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {task.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.all_time_total_minutes > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>{task.all_time_total_minutes}m</span>
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. WORKSPACE DOMAINS (3 Grouped Insets) */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              Workspace Domains
            </h2>
            <p className="text-xs text-zinc-400">
              6 integrated tools organized into clean execution suites
            </p>
          </div>
          <button
            onClick={() => setActiveSection('workspace')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Workspace Hub</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {domainGroups.map((group) => (
            <div key={group.domainName} className="space-y-2">
              <div className="px-1 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {group.domainName}
                </span>
              </div>

              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/4 overflow-hidden divide-y divide-zinc-100">
                {group.apps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <div
                      key={app.id}
                      onClick={() => openWorkspaceApp(app.id)}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/90 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${app.iconBg} shadow-2xs group-hover:scale-105 transition-transform`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                            {app.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {app.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${app.badgeColor}`}>
                          {app.badge}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
