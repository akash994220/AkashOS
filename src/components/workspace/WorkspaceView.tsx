import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation } from '../../context/NavigationContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { DailyTask, WorkThread, IdeaNote, IdeaFolder, DailyTaskSession } from '../../types/workspace';
import { ContentItem, ContentCategory, ContentTree } from '../../types/content';
import { FinancialEntry } from '../../types/financial';
import { DailyTasksView } from './DailyTasksView';
import { WorkThreadsView } from './WorkThreadsView';
import { IdeasNotesView } from './IdeasNotesView';
import { ContentCreationView } from '../content/ContentCreationView';
import { ContentTreeStudio } from '../content/tree/ContentTreeStudio';
import { FinancialView } from '../financial/FinancialView';
import { VaultView } from '../vault/VaultView';
import { 
  ListTodo, 
  GitBranch, 
  Lightbulb, 
  Clapperboard,
  Wallet, 
  Clock, 
  Play, 
  ArrowRight,
  ArrowLeft, 
  ChevronRight,
  Sparkles,
  Flame,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Database,
  Network,
  FolderOpen,
  PieChart,
  Target,
  Layers,
  KeyRound,
  CreditCard,
  FileLock2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { DataBackupModal } from '../settings/DataBackupModal';

export const WorkspaceView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Page routing state synced with NavigationContext
  const { workspacePage: currentPage, setWorkspacePage: navigateTo, registerBackHandler } = useNavigation();

  // Full Backup & Restore Modal State
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);

  // Live Metrics & Data State across Workspace features
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [todaySessions, setTodaySessions] = useState<DailyTaskSession[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [notes, setNotes] = useState<IdeaNote[]>([]);
  const [folders, setFolders] = useState<IdeaFolder[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentCategories, setContentCategories] = useState<ContentCategory[]>([]);
  const [trees, setTrees] = useState<ContentTree[]>([]);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [vaultCredentialsCount, setVaultCredentialsCount] = useState<number>(0);
  const [vaultBankCardsCount, setVaultBankCardsCount] = useState<number>(0);
  const [vaultCustomCount, setVaultCustomCount] = useState<number>(0);
  const vaultTotalCount = vaultCredentialsCount + vaultBankCardsCount + vaultCustomCount;

  // Active Timer tracker
  const [activeTimerTask, setActiveTimerTask] = useState<{ taskId: string; startTime: number } | null>(null);
  const [timerNow, setTimerNow] = useState<number>(Date.now());

  const todayDateStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayDateStr.slice(0, 7);

  // Subscriptions across all workspace modules
  useEffect(() => {
    if (!user) return;

    // 1. Daily tasks
    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
        setTasks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_tasks')
    );

    // 2. Today's task sessions
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
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkThread));
        setThreads(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'work_threads')
    );

    // 4. Ideas & notes
    const qNotes = query(collection(db, 'idea_notes'), where('owner_uid', '==', user.uid));
    const unsubNotes = onSnapshot(
      qNotes,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaNote));
        list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        setNotes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_notes')
    );

    // 5. Idea folders / spaces
    const qFolders = query(collection(db, 'idea_folders'), where('owner_uid', '==', user.uid));
    const unsubFolders = onSnapshot(
      qFolders,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaFolder));
        setFolders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_folders')
    );

    // 6. Content items
    const qContent = query(collection(db, 'content_items'), where('owner_uid', '==', user.uid));
    const unsubContent = onSnapshot(
      qContent,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentItem));
        list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        setContentItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'content_items')
    );

    // 7. Content categories
    const qCategories = query(collection(db, 'content_categories'), where('owner_uid', '==', user.uid));
    const unsubCategories = onSnapshot(
      qCategories,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentCategory));
        setContentCategories(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'content_categories')
    );

    // 8. Idea Trees
    const qTrees = query(collection(db, 'content_trees'), where('owner_uid', '==', user.uid));
    const unsubTrees = onSnapshot(
      qTrees,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentTree));
        list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        setTrees(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'content_trees')
    );

    // 9. Financial entries
    const qFinance = query(collection(db, 'financial_entries'), where('owner_uid', '==', user.uid));
    const unsubFinance = onSnapshot(
      qFinance,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialEntry));
        setFinancialEntries(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_entries')
    );

    // 10. Vault items
    const qCredentials = query(collection(db, 'vault_credentials'), where('owner_uid', '==', user.uid));
    const unsubCredentials = onSnapshot(
      qCredentials,
      (snap) => setVaultCredentialsCount(snap.docs.length),
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_credentials')
    );

    const qCards = query(collection(db, 'vault_bank_cards'), where('owner_uid', '==', user.uid));
    const unsubCards = onSnapshot(
      qCards,
      (snap) => setVaultBankCardsCount(snap.docs.length),
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_bank_cards')
    );

    const qCustom = query(collection(db, 'vault_custom'), where('owner_uid', '==', user.uid));
    const unsubCustom = onSnapshot(
      qCustom,
      (snap) => setVaultCustomCount(snap.docs.length),
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_custom')
    );

    return () => {
      unsubTasks();
      unsubSessions();
      unsubThreads();
      unsubNotes();
      unsubFolders();
      unsubContent();
      unsubCategories();
      unsubTrees();
      unsubFinance();
      unsubCredentials();
      unsubCards();
      unsubCustom();
    };
  }, [user, todayDateStr]);

  // Check active timer state from localStorage
  useEffect(() => {
    const checkTimer = () => {
      try {
        const raw = localStorage.getItem('daily_task_active_timer');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.taskId && parsed?.startTime) {
            setActiveTimerTask(parsed);
            return;
          }
        }
        setActiveTimerTask(null);
      } catch {
        setActiveTimerTask(null);
      }
    };

    checkTimer();
    const interval = setInterval(() => {
      checkTimer();
      setTimerNow(Date.now());
    }, 1000);

    window.addEventListener('storage', checkTimer);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkTimer);
    };
  }, []);

  // Back handler for DataBackupModal
  useEffect(() => {
    if (showBackupModal) {
      return registerBackHandler(() => {
        setShowBackupModal(false);
        return true;
      });
    }
  }, [showBackupModal, registerBackHandler]);

  // ==========================================
  // MINI ANALYTICS CALCULATIONS
  // ==========================================

  // 1. Daily Tasks Analytics
  const doneTasksCount = tasks.filter((t) => t.last_completed_at?.startsWith(todayDateStr)).length;
  const todayTotalFocusMinutes = todaySessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  const taskCompletionRate = tasks.length > 0 ? Math.round((doneTasksCount / tasks.length) * 100) : 0;

  const formatMinutes = (min: number): string => {
    if (min <= 0) return '0m';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const getRunningTimeStr = (startTime: number): string => {
    const elapsedSec = Math.max(0, Math.floor((timerNow - startTime) / 1000));
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const activeRunningTask = activeTimerTask ? tasks.find((t) => t.task_id === activeTimerTask.taskId) : null;

  // 2. Work Threads Analytics
  const inProgressThreads = threads.filter((t) => t.status === 'in_progress');
  const completedThreads = threads.filter((t) => t.status === 'done');
  const pausedThreads = threads.filter((t) => t.status === 'paused');
  const lastActiveThread = inProgressThreads.find((t) => t.left_off_notes?.trim()) || inProgressThreads[0];
  const threadCompletionRate = threads.length > 0 ? Math.round((completedThreads.length / threads.length) * 100) : 0;

  // 3. Content Studio Analytics
  const longFormContent = contentItems.filter((c) => c.format === 'long_form');
  const shortFormContent = contentItems.filter((c) => c.format === 'short_form');
  const draftContent = contentItems.filter((c) => c.status === 'draft');
  const postedContent = contentItems.filter((c) => c.status === 'posted');
  const readyContent = contentItems.filter((c) => c.status === 'ready');
  const latestContent = contentItems[0] || null;

  // 4. Idea Tree Analytics
  const totalTreeNodes = useMemo(() => {
    return trees.reduce((acc, t) => acc + (t.nodes?.length || 0), 0);
  }, [trees]);
  const totalRootNodes = useMemo(() => {
    return trees.reduce((acc, t) => acc + (t.nodes?.filter((n) => !n.parentId)?.length || 0), 0);
  }, [trees]);
  const totalSubBranches = Math.max(0, totalTreeNodes - totalRootNodes);

  // 5. Financial Hub Analytics
  const thisMonthExpenses = financialEntries
    .filter((e) => e.entry_type === 'expense' && e.date?.startsWith(currentMonthStr))
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const thisMonthIncome = financialEntries
    .filter((e) => e.entry_type === 'income' && e.date?.startsWith(currentMonthStr))
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const netCashflow = thisMonthIncome - thisMonthExpenses;
  const todayExpenses = financialEntries
    .filter((e) => e.entry_type === 'expense' && e.date === todayDateStr)
    .reduce((sum, e) => sum + (e.amount_bdt || 0), 0);

  const thisMonthTransactions = financialEntries.filter((e) => e.date?.startsWith(currentMonthStr)).length;

  // 6. Ideas & Notes Analytics
  const totalNotesWords = useMemo(() => {
    return notes.reduce((acc, note) => {
      const words = (note.body || '').trim().split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);
  }, [notes]);
  const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentlyUpdatedNotes = notes.filter((n) => new Date(n.updated_at || 0).getTime() > oneWeekAgoMs).length;

  // Switch tabs when on sub-pages
  const appSwitchTabs = [
    { id: 'daily_tasks' as const, label: 'Tasks', icon: ListTodo, count: tasks.length },
    { id: 'work_threads' as const, label: 'Work Threads', icon: GitBranch, count: threads.length },
    { id: 'ideas_notes' as const, label: 'Ideas & Notes', icon: Lightbulb, count: notes.length },
    { id: 'content' as const, label: 'Content Studio', icon: Clapperboard, count: contentItems.length },
    { id: 'idea_tree' as const, label: 'Idea Tree', icon: Network, count: totalTreeNodes },
    { id: 'financial' as const, label: 'Financial Hub', icon: Wallet },
    { id: 'vault' as const, label: 'Secret Vault', icon: ShieldCheck, count: vaultTotalCount },
  ];

  // ==========================================
  // DEDICATED FEATURE PAGE VIEW (Sub-Page Mode)
  // ==========================================
  if (currentPage !== 'hub') {
    return (
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 pb-8 sm:pb-12">
        {/* Navigation Breadcrumb & Fixed Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
          {/* Breadcrumb back to Hub + Quick Backup */}
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => navigateTo('hub')}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                minHeight: '34px',
              }}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Workspace Hub</span>
            </button>

            <button
              onClick={() => setShowBackupModal(true)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                minHeight: '34px',
              }}
              className="px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Export or Import Backup"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Backup</span>
            </button>
          </div>

          {/* Smooth Capsule Switcher */}
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderColor: theme.colors.borderLight,
              borderRadius: theme.radius.full,
            }}
            className="p-1 border flex items-center gap-0.5 sm:gap-1 w-full sm:w-auto shadow-2xs overflow-x-auto"
          >
            {appSwitchTabs.map((tab) => {
              const isCurrent = currentPage === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`subpage-switch-${tab.id}`}
                  onClick={() => navigateTo(tab.id)}
                  title={tab.label}
                  style={{
                    backgroundColor: isCurrent ? theme.colors.bgCard : 'transparent',
                    color: isCurrent ? theme.colors.textPrimary : theme.colors.textSecondary,
                    borderRadius: theme.radius.full,
                    minHeight: '32px',
                  }}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 text-xs cursor-pointer transition-all whitespace-nowrap ${
                    isCurrent ? 'shadow-xs font-bold' : 'hover:text-zinc-900 font-medium'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      style={{
                        backgroundColor: isCurrent ? theme.colors.bgSecondary : 'rgba(0,0,0,0.06)',
                        color: isCurrent ? theme.colors.textPrimary : theme.colors.textMuted,
                      }}
                      className="text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ml-0.5"
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Render Active Sub-Page */}
        <div>
          {currentPage === 'daily_tasks' && <DailyTasksView />}
          {currentPage === 'work_threads' && <WorkThreadsView />}
          {currentPage === 'ideas_notes' && <IdeasNotesView />}
          {currentPage === 'content' && <ContentCreationView />}
          {currentPage === 'idea_tree' && <ContentTreeStudio categories={contentCategories} />}
          {currentPage === 'financial' && <FinancialView />}
          {currentPage === 'vault' && <VaultView />}
        </div>

        {/* Global Data Backup Modal */}
        <DataBackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
        />
      </div>
    );
  }

  // ==========================================
  // STREAMLINED WORKSPACE HUB (MAIN FEATURE CARDS + MINI ANALYTICS)
  // ==========================================
  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-5 pb-16">
      {/* 1. CLEAN WORKSPACE HEADER (NO REDUNDANT CLUTTER) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Workspace Hub
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight mt-0.5">
            Command Center
          </h1>
          <p className="text-xs text-zinc-500 font-medium">
            7 specialized productivity studios with real-time analytics
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            id="workspace-quick-backup-btn"
            type="button"
            onClick={() => setShowBackupModal(true)}
            style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderLight,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.md,
            }}
            className="px-3 py-1.5 border flex items-center gap-1.5 text-xs font-semibold shadow-2xs hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Export or Import Full Data Backup"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Data Backup</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT ACTIVE TIMER CALLOUT (ONLY WHEN FOCUS SESSION IS RUNNING) */}
      {activeTimerTask && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#FFFBEB',
            borderColor: '#FDE68A',
            borderRadius: theme.radius.lg,
          }}
          className="p-3 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse shadow-xs">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Focus Session Active
                </span>
                <span className="text-xs sm:text-sm font-bold text-zinc-900">
                  {activeRunningTask?.title || 'Daily Task'}
                </span>
              </div>
              <p className="text-xs text-zinc-600 font-medium mt-0.5">
                Elapsed: <span className="font-poppins tabular-nums font-bold text-zinc-900">{getRunningTimeStr(activeTimerTask.startTime)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => navigateTo('daily_tasks')}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '32px',
            }}
            className="px-3 py-1.5 text-xs font-bold cursor-pointer hover:opacity-90 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
          >
            <span>Open Active Session</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* 3. MAIN FEATURE CARDS WITH MINI ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        
        {/* CARD 1: DAILY TASKS & HABITS */}
        <div
          onClick={() => navigateTo('daily_tasks')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row: Icon + Title + Arrow */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-blue-100">
                  <ListTodo className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                    Tasks
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Habits & Focus Timers
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {taskCompletionRate}%
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  Completed Today
                </span>
              </div>
              {/* Mini Progress Bar */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${taskCompletionRate}%` }}
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Habits Done</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {doneTasksCount} / {tasks.length}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Focus Time</div>
                <div className="text-xs font-bold text-blue-700 font-poppins tabular-nums mt-0.5">
                  {formatMinutes(todayTotalFocusMinutes)}
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>
              {tasks.length === 0 ? 'No routines added' : `${tasks.length - doneTasksCount} habits remaining`}
            </span>
            <span className="text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 2: WORK THREADS */}
        <div
          onClick={() => navigateTo('work_threads')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-purple-100">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-purple-600 transition-colors">
                    Work Threads
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    State & Project Continuity
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {inProgressThreads.length}
                </span>
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                  Active in Progress
                </span>
              </div>
              {/* Mini distribution bar */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden flex">
                <div
                  className="bg-purple-600 h-2 transition-all duration-500"
                  style={{ width: `${threads.length > 0 ? (inProgressThreads.length / threads.length) * 100 : 0}%` }}
                  title="In Progress"
                />
                <div
                  className="bg-emerald-500 h-2 transition-all duration-500"
                  style={{ width: `${threads.length > 0 ? (completedThreads.length / threads.length) * 100 : 0}%` }}
                  title="Completed"
                />
                <div
                  className="bg-amber-400 h-2 transition-all duration-500"
                  style={{ width: `${threads.length > 0 ? (pausedThreads.length / threads.length) * 100 : 0}%` }}
                  title="Paused"
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Completed</div>
                <div className="text-xs font-bold text-emerald-700 font-poppins tabular-nums mt-0.5">
                  {completedThreads.length} projects
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Total Tracked</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {threads.length} threads
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span className="truncate max-w-[170px]">
              {lastActiveThread ? `Resume: ${lastActiveThread.site_or_app_name}` : 'No active threads'}
            </span>
            <span className="text-purple-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 3: CONTENT STUDIO */}
        <div
          onClick={() => navigateTo('content')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-indigo-100">
                  <Clapperboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                    Content Studio
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Video, Scripts & Pipeline
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {contentItems.length}
                </span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Total Items
                </span>
              </div>
              {/* Format distribution bar */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden flex">
                <div
                  className="bg-blue-600 h-2 transition-all duration-500"
                  style={{ width: `${contentItems.length > 0 ? (longFormContent.length / contentItems.length) * 100 : 0}%` }}
                  title="Long Form"
                />
                <div
                  className="bg-purple-500 h-2 transition-all duration-500"
                  style={{ width: `${contentItems.length > 0 ? (shortFormContent.length / contentItems.length) * 100 : 0}%` }}
                  title="Short Form"
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Formats</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {longFormContent.length}L · {shortFormContent.length}S
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Drafts & Ready</div>
                <div className="text-xs font-bold text-indigo-700 font-poppins tabular-nums mt-0.5">
                  {draftContent.length} drafts · {readyContent.length + postedContent.length} ready
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span className="truncate max-w-[170px]">
              {latestContent ? `Latest: ${latestContent.title}` : 'No scripts started yet'}
            </span>
            <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 4: IDEA TREE */}
        <div
          onClick={() => navigateTo('idea_tree')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-emerald-100">
                  <Network className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                    Idea Tree
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Mind Maps & Sub-Branches
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {totalTreeNodes}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Total Nodes & Branches
                </span>
              </div>
              {/* Hierarchy mini representation */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-2 transition-all duration-500"
                  style={{ width: `${totalTreeNodes > 0 ? (totalRootNodes / totalTreeNodes) * 100 : 0}%` }}
                  title="Root Nodes"
                />
                <div
                  className="bg-teal-400 h-2 transition-all duration-500"
                  style={{ width: `${totalTreeNodes > 0 ? (totalSubBranches / totalTreeNodes) * 100 : 0}%` }}
                  title="Sub-Branches"
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Mind Maps</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {trees.length} active maps
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Sub-Branches</div>
                <div className="text-xs font-bold text-emerald-700 font-poppins tabular-nums mt-0.5">
                  {totalSubBranches} connected
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span className="truncate max-w-[170px]">
              {trees[0] ? `Active: ${trees[0].title}` : 'Build interactive visual maps'}
            </span>
            <span className="text-emerald-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 5: FINANCIAL HUB */}
        <div
          onClick={() => navigateTo('financial')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-teal-100">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-teal-600 transition-colors">
                    Financial Hub
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    BDT Income & Cashflow
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-poppins tabular-nums tracking-tight ${netCashflow >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  ৳ {netCashflow >= 0 ? '+' : ''}{netCashflow.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  Monthly Net
                </span>
              </div>
              {/* Cashflow bar comparison */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-500"
                  style={{
                    width: `${
                      thisMonthIncome + thisMonthExpenses > 0
                        ? (thisMonthIncome / (thisMonthIncome + thisMonthExpenses)) * 100
                        : 50
                    }%`,
                  }}
                  title="Income"
                />
                <div
                  className="bg-rose-500 h-2 transition-all duration-500"
                  style={{
                    width: `${
                      thisMonthIncome + thisMonthExpenses > 0
                        ? (thisMonthExpenses / (thisMonthIncome + thisMonthExpenses)) * 100
                        : 50
                    }%`,
                  }}
                  title="Expenses"
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-emerald-700 font-semibold uppercase">Month In</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5 truncate">
                  ৳ {thisMonthIncome.toLocaleString()}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-rose-700 font-semibold uppercase">Month Out</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5 truncate">
                  ৳ {thisMonthExpenses.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>
              {todayExpenses > 0 ? `Today spent: ৳${todayExpenses.toLocaleString()}` : `${thisMonthTransactions} txns this month`}
            </span>
            <span className="text-teal-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 6: IDEAS & NOTES */}
        <div
          onClick={() => navigateTo('ideas_notes')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-amber-100">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">
                    Ideas & Notes
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Knowledge Base & Folders
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {notes.length}
                </span>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  Notes Stored
                </span>
              </div>
              {/* Words progress bar */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, notes.length * 8))}%` }}
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Spaces / Folders</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {folders.length} spaces
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Words Captured</div>
                <div className="text-xs font-bold text-amber-700 font-poppins tabular-nums mt-0.5">
                  ~{totalNotesWords.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span className="truncate max-w-[170px]">
              {notes[0] ? `Latest: ${notes[0].title}` : 'Capture thoughts & notes'}
            </span>
            <span className="text-amber-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

        {/* CARD 7: SECRET VAULT */}
        <div
          onClick={() => navigateTo('vault')}
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.xl,
          }}
          className="p-4 sm:p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-indigo-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                    Secret Vault
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Credentials, Cards & Secrets
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            {/* Primary KPI Hero */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 font-poppins tabular-nums tracking-tight">
                  {vaultTotalCount}
                </span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Protected Items
                </span>
              </div>
              {/* Vault breakdown bar */}
              <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden flex">
                <div
                  className="bg-indigo-600 h-2 transition-all duration-500"
                  style={{ width: `${vaultTotalCount > 0 ? (vaultCredentialsCount / vaultTotalCount) * 100 : 33}%` }}
                  title="Credentials"
                />
                <div
                  className="bg-purple-500 h-2 transition-all duration-500"
                  style={{ width: `${vaultTotalCount > 0 ? (vaultBankCardsCount / vaultTotalCount) * 100 : 33}%` }}
                  title="Bank Cards"
                />
                <div
                  className="bg-cyan-500 h-2 transition-all duration-500"
                  style={{ width: `${vaultTotalCount > 0 ? (vaultCustomCount / vaultTotalCount) * 100 : 34}%` }}
                  title="Custom Secrets"
                />
              </div>
            </div>

            {/* Mini Analytics Grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100 text-center">
                <div className="text-[9px] text-zinc-400 font-semibold uppercase truncate">Logins</div>
                <div className="text-xs font-bold text-zinc-800 font-poppins tabular-nums mt-0.5">
                  {vaultCredentialsCount}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100 text-center">
                <div className="text-[9px] text-zinc-400 font-semibold uppercase truncate">Cards</div>
                <div className="text-xs font-bold text-indigo-700 font-poppins tabular-nums mt-0.5">
                  {vaultBankCardsCount}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50/80 border border-zinc-100 text-center">
                <div className="text-[9px] text-zinc-400 font-semibold uppercase truncate">Custom</div>
                <div className="text-xs font-bold text-purple-700 font-poppins tabular-nums mt-0.5">
                  {vaultCustomCount}
                </div>
              </div>
            </div>
          </div>

          {/* Footer status */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>
              {vaultTotalCount === 0 ? 'Encrypted storage ready' : `${vaultTotalCount} secure entries stored`}
            </span>
            <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Open Vault <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

      </div>

      {/* Global Data Backup Modal */}
      <DataBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
};
