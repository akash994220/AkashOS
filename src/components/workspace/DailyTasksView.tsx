import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation } from '../../context/NavigationContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { DailyTask, DailyTaskSession, TaskSubtask } from '../../types/workspace';
import { detectAndConvertClipboard } from '../../lib/smartFormatDetector';
import {
  computeTaskTotalMinutes,
  formatDuration,
  getSubtaskDisplayTime,
  toggleSubtaskTimerRemote,
} from '../../lib/subtasks';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import { 
  Play, 
  Square, 
  Check, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Clock, 
  Calendar,
  FileText,
  Search,
  CheckCircle2,
  Circle,
  Pause,
  Pencil,
  AlertCircle,
  Sparkles,
  Copy
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks } from '../../lib/linkUtils';

interface ActiveTimerStorage {
  taskId: string;
  startTime: number; // timestamp in ms
}

const TIMER_STORAGE_KEY = 'daily_task_active_timer';

/**
 * Format subtask creation timestamp as compact badge text with date, hour, and minute
 */
const formatSubtaskTimestamp = (isoString?: string): string => {
  return formatDateTimeWithHM(isoString);
};

/**
 * Task Item Capsule Component inside the New/Edit Task modal
 * Shows 2 lines of text by default, without checkboxes, expandable on click to edit/copy
 */
interface TaskItemCapsuleProps {
  sub: TaskSubtask;
  onExpand: (sub: TaskSubtask) => void;
  onDelete: (subtaskId: string) => void;
}

const TaskItemCapsule: React.FC<TaskItemCapsuleProps> = ({
  sub,
  onExpand,
  onDelete,
}) => {
  const { theme } = useTheme();

  return (
    <div
      onClick={() => onExpand(sub)}
      style={{
        backgroundColor: theme.colors.bgSecondary,
        borderColor: theme.colors.borderLight,
        borderRadius: theme.radius.lg,
      }}
      className="p-3 border flex items-start justify-between gap-3 transition-all w-full cursor-pointer hover:border-zinc-400 hover:shadow-2xs group relative"
      title="Click to expand & edit full task text"
    >
      {/* 2 lines of text by default, with timestamp badge & blue clickable links */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-relaxed whitespace-pre-wrap select-text">
          {tokenizeTextWithLinks(sub.title).map((token, i) =>
            token.type === 'link' && token.url ? (
              <LinkWithPreview
                key={`${token.url}-${i}`}
                url={token.url}
                domain={token.domain}
                path={token.path}
                className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                stopPropagation={true}
              >
                {token.content}
              </LinkWithPreview>
            ) : (
              <React.Fragment key={i}>{token.content}</React.Fragment>
            )
          )}
        </p>

        {sub.created_at && (
          <span
            style={{
              backgroundColor: theme.colors.bgTertiary,
              color: theme.colors.textMuted,
            }}
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block select-none"
          >
            {formatSubtaskTimestamp(sub.created_at)}
          </span>
        )}
      </div>

      {/* Delete button */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(sub.subtask_id);
          }}
          aria-label="Delete task"
          title="Delete task"
          className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const DailyTasksView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { registerBackHandler } = useNavigation();

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [sessions, setSessions] = useState<DailyTaskSession[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerStorage | null>(null);
  const [timerNow, setTimerNow] = useState<number>(Date.now());

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'marked' | 'active_timer'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick inline add (top bar)
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  // New/Edit Task Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<TaskSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Expandable Task Edit Popup Modal State
  const [expandedSubtask, setExpandedSubtask] = useState<TaskSubtask | null>(null);
  const [expandedEditText, setExpandedEditText] = useState('');
  const [subtaskCopied, setSubtaskCopied] = useState(false);

  const todayDateStr = new Date().toISOString().split('T')[0];

  const activeTimerRef = useRef<ActiveTimerStorage | null>(null);
  activeTimerRef.current = activeTimer;

  const tasksRef = useRef<DailyTask[]>([]);
  tasksRef.current = tasks;

  // Register back handler to dismiss modal or expanded task popup
  useEffect(() => {
    if (expandedSubtask !== null) {
      return registerBackHandler(() => {
        setExpandedSubtask(null);
        return true;
      });
    }
    if (showAddModal || editingTask !== null) {
      return registerBackHandler(() => {
        setShowAddModal(false);
        setEditingTask(null);
        return true;
      });
    }
  }, [showAddModal, editingTask, expandedSubtask, registerBackHandler]);

  // 1. Subscribe to tasks
  useEffect(() => {
    if (!user) return;
    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qTasks,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
        list.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        setTasks(list);

        // Keep open modal subtasks synchronized if editing an existing task
        if (editingTask) {
          const currentInList = list.find((t) => t.task_id === editingTask.task_id);
          if (currentInList && currentInList.subtasks) {
            const sorted = [...currentInList.subtasks].sort((a, b) => {
              const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return timeB - timeA;
            });
            setFormSubtasks(sorted);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_tasks')
    );
    return () => unsub();
  }, [user, editingTask?.task_id]);

  // 2. Subscribe to sessions (for legacy flat tasks)
  useEffect(() => {
    if (!user) return;
    const qSessions = query(collection(db, 'daily_task_sessions'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qSessions,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTaskSession));
        setSessions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'daily_task_sessions')
    );
    return () => unsub();
  }, [user]);

  // 3. Initialize legacy timer from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveTimerStorage;
        if (parsed?.taskId && parsed?.startTime) {
          setActiveTimer(parsed);
        }
      }
    } catch {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    }
  }, []);

  // 4. Tick timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculation for "Last completed: Date & Time"
  const getLastCompletedText = (lastCompletedAt: string | null | undefined): string => {
    if (!lastCompletedAt) return 'Never completed';

    const cleanDateStr = lastCompletedAt.includes('T')
      ? lastCompletedAt.split('T')[0]
      : lastCompletedAt;

    const [tYear, tMonth, tDay] = todayDateStr.split('-').map(Number);
    const [cYear, cMonth, cDay] = cleanDateStr.split('-').map(Number);

    const todayDate = new Date(tYear, tMonth - 1, tDay);
    const compDate = new Date(cYear, cMonth - 1, cDay);

    const diffMs = todayDate.getTime() - compDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = lastCompletedAt.includes('T')
      ? new Date(lastCompletedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;

    if (diffDays <= 0) {
      return timeStr ? `Completed Today, ${timeStr}` : 'Completed today';
    }
    if (diffDays === 1) {
      return timeStr ? `Completed Yesterday, ${timeStr}` : 'Completed yesterday';
    }
    return timeStr ? `Completed ${diffDays}d ago, ${timeStr}` : `Completed ${diffDays} days ago`;
  };

  // Stop running legacy flat timer
  const stopRunningTimer = async (runningTimer: ActiveTimerStorage) => {
    if (!user) return;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - runningTimer.startTime);
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));

    const sessionId = `session_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const sessionPayload: DailyTaskSession = {
      session_id: sessionId,
      task_id: runningTimer.taskId,
      owner_uid: user.uid,
      date: todayDateStr,
      start_time: new Date(runningTimer.startTime).toISOString(),
      end_time: new Date(now).toISOString(),
      duration_minutes: durationMinutes,
    };

    try {
      await setDoc(doc(db, 'daily_task_sessions', sessionId), sessionPayload);
      const targetTask = tasksRef.current.find((t) => t.task_id === runningTimer.taskId);
      const prevTotal = targetTask?.all_time_total_minutes || 0;
      await setDoc(
        doc(db, 'daily_tasks', runningTimer.taskId),
        {
          all_time_total_minutes: prevTotal + durationMinutes,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_task_sessions/${sessionId}`);
    } finally {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      setActiveTimer(null);
    }
  };

  // Toggle legacy timer for flat tasks
  const handleToggleTimer = async (task: DailyTask) => {
    if (!user) return;

    if (activeTimer?.taskId === task.task_id) {
      await stopRunningTimer(activeTimer);
    } else {
      if (activeTimer) {
        await stopRunningTimer(activeTimer);
      }
      const newTimer: ActiveTimerStorage = {
        taskId: task.task_id,
        startTime: Date.now(),
      };
      setActiveTimer(newTimer);
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newTimer));
    }
  };

  // Toggle "Mark done today"
  const handleToggleDoneToday = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isDone = task.last_completed_at?.startsWith(todayDateStr);
    const newCompletedAt = isDone ? null : new Date().toISOString();

    try {
      await updateDoc(doc(db, 'daily_tasks', task.task_id), {
        last_completed_at: newCompletedAt,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `daily_tasks/${task.task_id}`);
    }
  };

  // Quick inline add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickTitle.trim()) return;

    setQuickAdding(true);
    const taskId = `task_${Date.now()}`;
    const payload: DailyTask = {
      task_id: taskId,
      owner_uid: user.uid,
      title: quickTitle.trim(),
      subtitle: '',
      notes: '',
      created_at: new Date().toISOString(),
      last_completed_at: null,
      all_time_total_minutes: 0,
      subtasks: [],
    };

    try {
      await setDoc(doc(db, 'daily_tasks', taskId), payload);
      setQuickTitle('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_tasks/${taskId}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // Open Create Modal
  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormNotes('');
    setFormSubtasks([]);
    setNewSubtaskTitle('');
    setShowAddModal(true);
  };

  // Open Edit Modal (tapping a task card reopens this same popup)
  const handleOpenEdit = (task: DailyTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setFormTitle(task.title || '');
    setFormSubtitle(task.subtitle || '');
    setFormNotes(task.notes || '');
    const sortedSubs = task.subtasks ? [...task.subtasks].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    }) : [];
    setFormSubtasks(sortedSubs);
    setNewSubtaskTitle('');
    setShowAddModal(true);
  };

  // Save Task (Create or Edit)
  const handleSaveTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !formTitle.trim()) return;

    setSaving(true);
    const taskId = editingTask ? editingTask.task_id : `task_${Date.now()}`;
    const hasSubtasks = formSubtasks.length > 0;

    const payload: Partial<DailyTask> = {
      task_id: taskId,
      owner_uid: user.uid,
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      notes: formNotes.trim(),
      subtasks: formSubtasks,
    };

    if (!editingTask) {
      payload.created_at = new Date().toISOString();
      payload.last_completed_at = null;
      if (!hasSubtasks) {
        payload.all_time_total_minutes = 0;
      }
    } else {
      // If flat task with no subtasks, preserve existing all_time_total_minutes
      if (!hasSubtasks) {
        payload.all_time_total_minutes = editingTask.all_time_total_minutes || 0;
      }
    }

    try {
      await setDoc(doc(db, 'daily_tasks', taskId), payload, { merge: true });
      setShowAddModal(false);
      setEditingTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_tasks/${taskId}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this daily task?')) return;
    try {
      if (activeTimer?.taskId === taskId) {
        localStorage.removeItem(TIMER_STORAGE_KEY);
        setActiveTimer(null);
      }
      await deleteDoc(doc(db, 'daily_tasks', taskId));
      setShowAddModal(false);
      setEditingTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `daily_tasks/${taskId}`);
    }
  };

  // --- Subtask Management inside New/Edit Popup ---
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: TaskSubtask = {
      subtask_id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newSubtaskTitle.trim(),
      created_at: new Date().toISOString(),
      is_running: false,
      timer_started_at: null,
      accumulated_minutes: 0,
      is_done: false,
    };
    // Newest subtask is always at the top
    setFormSubtasks((prev) => [newSub, ...prev]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtaskDone = (subtaskId: string) => {
    setFormSubtasks((prev) =>
      prev.map((s) => (s.subtask_id === subtaskId ? { ...s, is_done: !s.is_done } : s))
    );
  };

  const handleRenameSubtask = (subtaskId: string, newTitle: string) => {
    setFormSubtasks((prev) =>
      prev.map((s) => (s.subtask_id === subtaskId ? { ...s, title: newTitle } : s))
    );
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    setFormSubtasks((prev) => prev.filter((s) => s.subtask_id !== subtaskId));
  };

  const handleModalToggleSubtaskTimer = async (subtaskId: string) => {
    // If editing an existing task, leverage remote toggle to auto-stop other timers across the whole app
    if (editingTask) {
      try {
        await toggleSubtaskTimerRemote(editingTask.task_id, subtaskId, tasks);
      } catch (err) {
        console.error('Error toggling subtask timer:', err);
      }
    } else {
      // Local draft state toggle for new task
      const target = formSubtasks.find((s) => s.subtask_id === subtaskId);
      if (!target) return;
      const isNowRunning = !target.is_running;
      const now = Date.now();

      setFormSubtasks((prev) =>
        prev.map((s) => {
          if (s.subtask_id === subtaskId) {
            if (isNowRunning) {
              return {
                ...s,
                is_running: true,
                timer_started_at: new Date(now).toISOString(),
              };
            } else {
              const elapsedMin = s.timer_started_at
                ? Math.max(0, (now - new Date(s.timer_started_at).getTime()) / 60000)
                : 0;
              return {
                ...s,
                is_running: false,
                timer_started_at: null,
                accumulated_minutes: Math.round(((s.accumulated_minutes || 0) + elapsedMin) * 100) / 100,
              };
            }
          } else if (isNowRunning && s.is_running) {
            const elapsedMin = s.timer_started_at
              ? Math.max(0, (now - new Date(s.timer_started_at).getTime()) / 60000)
              : 0;
            return {
              ...s,
              is_running: false,
              timer_started_at: null,
              accumulated_minutes: Math.round(((s.accumulated_minutes || 0) + elapsedMin) * 100) / 100,
            };
          }
          return s;
        })
      );
    }
  };

  // Live computed total time for modal sticky footer
  const liveModalTotalMinutes = formSubtasks.reduce((sum, sub) => {
    let subMin = Number(sub.accumulated_minutes) || 0;
    if (sub.is_running && sub.timer_started_at) {
      const startTime = new Date(sub.timer_started_at).getTime();
      if (!isNaN(startTime)) {
        subMin += Math.max(0, (timerNow - startTime) / 60000);
      }
    }
    return sum + subMin;
  }, 0);

  const markedCount = tasks.filter((t) => Boolean(t.last_completed_at?.startsWith(todayDateStr))).length;
  const timerActiveCount = tasks.filter((t) => t.subtasks?.some((s) => s.is_running) || activeTimer?.taskId === t.task_id).length;

  // Filter tasks by status and search query (focus on stream/archive)
  const filteredTasks = tasks.filter((t) => {
    const isMarked = Boolean(t.last_completed_at?.startsWith(todayDateStr));
    if (statusFilter === 'marked' && !isMarked) return false;
    if (statusFilter === 'active_timer' && !t.subtasks?.some((s) => s.is_running) && activeTimer?.taskId !== t.task_id) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchSub = (t.subtitle || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      const matchSubtasks = (t.subtasks || []).some((s) => s.title.toLowerCase().includes(q));
      if (!matchTitle && !matchSub && !matchNotes && !matchSubtasks) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Action & Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight truncate" style={{ color: theme.colors.textPrimary }}>
            Thought Stream & Logs
          </h2>
          <p className="text-xs text-zinc-500 truncate">
            Continuous capture, scratchpads & idea logs
          </p>
        </div>

        <button
          id="add-daily-task-btn"
          onClick={handleOpenAdd}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.full,
            minHeight: '36px',
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Entry</span>
        </button>
      </div>

      {/* QUICK INLINE ADD BOX */}
      <form
        onSubmit={handleQuickAdd}
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-1.5 sm:p-2 border flex items-center gap-2 shadow-xs"
      >
        <Plus className="w-4 h-4 text-zinc-400 ml-2 shrink-0" />
        <input
          type="text"
          placeholder="Capture a thought, quick note, or scratchpad log..."
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          style={{
            minHeight: '36px',
          }}
          className="flex-1 bg-transparent px-2 text-xs focus:outline-none text-zinc-900 placeholder:text-zinc-400"
        />
        <button
          type="submit"
          disabled={quickAdding || !quickTitle.trim()}
          style={{
            backgroundColor: quickTitle.trim() ? theme.colors.accent : theme.colors.bgSecondary,
            color: quickTitle.trim() ? theme.colors.accentText : theme.colors.textSecondary,
            borderRadius: theme.radius.md,
            minHeight: '32px',
          }}
          className="px-3 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shrink-0"
        >
          {quickAdding ? 'Saving...' : 'Save'}
        </button>
      </form>

      {/* Filter tabs and search row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              borderRadius: theme.radius.full,
              backgroundColor: statusFilter === 'all' ? theme.colors.accent : theme.colors.bgSecondary,
              color: statusFilter === 'all' ? theme.colors.accentText : theme.colors.textSecondary,
              minHeight: '32px',
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            <span>All Logs</span>
            <span
              style={{
                backgroundColor: statusFilter === 'all' ? 'rgba(255,255,255,0.25)' : theme.colors.bgTertiary,
              }}
              className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
            >
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('marked')}
            style={{
              borderRadius: theme.radius.full,
              backgroundColor: statusFilter === 'marked' ? theme.colors.accent : theme.colors.bgSecondary,
              color: statusFilter === 'marked' ? theme.colors.accentText : theme.colors.textSecondary,
              minHeight: '32px',
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            <span>Marked</span>
            <span
              style={{
                backgroundColor: statusFilter === 'marked' ? 'rgba(255,255,255,0.25)' : theme.colors.bgTertiary,
              }}
              className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
            >
              {markedCount}
            </span>
          </button>

          {timerActiveCount > 0 && (
            <button
              onClick={() => setStatusFilter('active_timer')}
              style={{
                borderRadius: theme.radius.full,
                backgroundColor: statusFilter === 'active_timer' ? theme.colors.accent : theme.colors.bgSecondary,
                color: statusFilter === 'active_timer' ? theme.colors.accentText : theme.colors.textSecondary,
                minHeight: '32px',
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
            >
              <span>Active Timers</span>
              <span
                style={{
                  backgroundColor: statusFilter === 'active_timer' ? 'rgba(255,255,255,0.25)' : theme.colors.bgTertiary,
                }}
                className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
              >
                {timerActiveCount}
              </span>
            </button>
          )}
        </div>

        {/* Search Filter Input */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.full,
          }}
          className="flex items-center gap-2 px-3 py-1 border text-xs sm:w-60 shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search tasks & subtasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full focus:outline-none text-xs text-zinc-900 placeholder:text-zinc-400 py-0.5"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-zinc-400 hover:text-zinc-700 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Task Cards Grid (At least 3 columns on desktop/tablet) */}
      {filteredTasks.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: '1.25rem',
            borderWidth: '1px',
            borderStyle: 'dashed',
          }}
          className="text-center space-y-2 py-10"
        >
          <Clock className="w-8 h-8 mx-auto" style={{ color: theme.colors.textMuted }} />
          <p className="text-xs font-semibold" style={{ color: theme.colors.textPrimary }}>
            {searchQuery || statusFilter !== 'all' ? 'No tasks match your filters' : 'No daily tasks yet'}
          </p>
          <p className="text-[11px] max-w-sm mx-auto" style={{ color: theme.colors.textSecondary }}>
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search terms or view all tasks.'
              : 'Add routines with subtasks. Track focused time with live-ticking timers.'}
          </p>
          {searchQuery || statusFilter !== 'all' ? (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.sm,
              }}
              className="mt-2 px-3 py-1.5 text-xs font-medium hover:bg-zinc-200 cursor-pointer"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={handleOpenAdd}
              style={{
                backgroundColor: theme.colors.accent,
                color: theme.colors.accentText,
                borderRadius: theme.radius.sm,
              }}
              className="mt-2 px-3 py-1.5 text-xs font-medium hover:opacity-90 cursor-pointer"
            >
              Create first task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredTasks.map((task) => {
            const isDoneToday = Boolean(task.last_completed_at?.startsWith(todayDateStr));
            const hasSubtasks = Boolean(task.subtasks && task.subtasks.length > 0);
            const runningSubtask = task.subtasks?.find((s) => s.is_running);
            const isAnySubtaskRunning = Boolean(runningSubtask);
            const isLegacyTimerRunning = activeTimer?.taskId === task.task_id;
            const isCardActive = isAnySubtaskRunning || isLegacyTimerRunning;

            // Live computed total minutes
            const taskTotalMin = computeTaskTotalMinutes(task, timerNow);
            const lastCompletedLine = getLastCompletedText(task.last_completed_at);

            // Subtask done stats
            const doneSubtaskCount = (task.subtasks || []).filter((s) => s.is_done).length;
            const totalSubtaskCount = task.subtasks?.length || 0;

            // One-line truncated description
            const description = task.notes?.trim() || task.subtitle?.trim();

            return (
              <div
                key={task.task_id}
                onClick={() => handleOpenEdit(task)}
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: isCardActive
                    ? theme.colors.accent
                    : isDoneToday
                    ? '#E4E4E7'
                    : theme.colors.borderLight,
                  borderRadius: '1.25rem',
                  borderWidth: isCardActive ? '2px' : '1px',
                }}
                className={`p-4 border transition-all duration-200 hover:border-zinc-400 hover:shadow-md cursor-pointer flex flex-col justify-between group relative ${
                  isCardActive ? 'ring-2 ring-blue-500/20 bg-blue-50/15' : ''
                }`}
              >
                {/* Top Section: Checkbox, Title, One-line Truncated Description, Edit button */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2.5">
                    {/* Left: Checkbox + Title */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        id={`toggle-done-${task.task_id}`}
                        onClick={(e) => handleToggleDoneToday(task, e)}
                        aria-label={isDoneToday ? 'Mark unmarked' : 'Mark item'}
                        style={{
                          borderRadius: '0.5rem',
                          backgroundColor: isDoneToday ? '#10B981' : 'transparent',
                          borderColor: isDoneToday ? '#10B981' : theme.colors.borderMedium,
                          color: isDoneToday ? '#FFFFFF' : 'transparent',
                          minWidth: '22px',
                          minHeight: '22px',
                        }}
                        className="w-5 h-5 mt-0.5 border flex items-center justify-center shrink-0 transition-colors cursor-pointer hover:border-emerald-500"
                        title={isDoneToday ? 'Toggle mark' : 'Mark item'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold leading-snug line-clamp-1 truncate text-zinc-900">
                          {tokenizeTextWithLinks(task.title).map((token, i) =>
                            token.type === 'link' && token.url ? (
                              <LinkWithPreview
                                key={`${token.url}-${i}`}
                                url={token.url}
                                domain={token.domain}
                                path={token.path}
                                className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                                stopPropagation={true}
                              >
                                {token.content}
                              </LinkWithPreview>
                            ) : (
                              <React.Fragment key={i}>{token.content}</React.Fragment>
                            )
                          )}
                        </h3>

                        {/* One-line truncated description */}
                        {description && (
                          <p className="text-xs text-zinc-500 line-clamp-1 truncate mt-0.5">
                            {tokenizeTextWithLinks(description).map((token, i) =>
                              token.type === 'link' && token.url ? (
                                <LinkWithPreview
                                  key={`${token.url}-${i}`}
                                  url={token.url}
                                  domain={token.domain}
                                  path={token.path}
                                  className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                                  stopPropagation={true}
                                >
                                  {token.content}
                                </LinkWithPreview>
                              ) : (
                                <React.Fragment key={i}>{token.content}</React.Fragment>
                              )
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Edit button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(task, e)}
                      style={{ minHeight: '30px', minWidth: '30px' }}
                      className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
                      title="Edit Task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle Section: Active running subtask or legacy timer */}
                {hasSubtasks ? (
                  /* SUBTASK TASKS */
                  <div className="my-2.5 space-y-2">
                    {/* Live-updating pulsing timer directly on the card if any subtask is running */}
                    {runningSubtask ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSubtaskTimerRemote(task.task_id, runningSubtask.subtask_id, tasks);
                        }}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          borderColor: '#FCA5A5',
                          borderRadius: theme.radius.md,
                        }}
                        className="flex items-center justify-between px-3 py-2 border animate-pulse cursor-pointer group/timer"
                        title="Click to pause active task timer"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-xs font-semibold text-rose-900 truncate">
                            {tokenizeTextWithLinks(runningSubtask.title).map((token, i) =>
                              token.type === 'link' && token.url ? (
                                <LinkWithPreview
                                  key={`${token.url}-${i}`}
                                  url={token.url}
                                  domain={token.domain}
                                  path={token.path}
                                  className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                                  stopPropagation={true}
                                >
                                  {token.content}
                                </LinkWithPreview>
                              ) : (
                                <React.Fragment key={i}>{token.content}</React.Fragment>
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-poppins tabular-nums font-bold text-rose-800">
                            {getSubtaskDisplayTime(runningSubtask, timerNow)}
                          </span>
                          <Pause className="w-3.5 h-3.5 fill-current text-rose-600" />
                        </div>
                      </div>
                    ) : null}

                    {/* Stat row: Total time (1h 24m) & Task count */}
                    <div
                      style={{
                        borderColor: theme.colors.borderLight,
                      }}
                      className="pt-2 border-t flex items-center justify-between text-xs text-zinc-500"
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-semibold text-zinc-800 font-poppins tabular-nums">
                          {formatDuration(taskTotalMin)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {totalSubtaskCount} {totalSubtaskCount === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* BACKWARD-COMPATIBLE FLAT TASKS (Zero Subtasks) */
                  <div className="my-2.5 pt-2.5 border-t border-black/5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          id={`timer-btn-${task.task_id}`}
                          onClick={() => handleToggleTimer(task)}
                          style={{
                            backgroundColor: isLegacyTimerRunning ? '#EF4444' : theme.colors.bgSecondary,
                            color: isLegacyTimerRunning ? '#FFFFFF' : theme.colors.textPrimary,
                            borderRadius: '0.75rem',
                            minHeight: '32px',
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold cursor-pointer transition-all hover:opacity-90 shadow-2xs ${
                            isLegacyTimerRunning ? 'animate-pulse' : ''
                          }`}
                          title={isLegacyTimerRunning ? 'Stop active focus session' : 'Start focused session timer'}
                        >
                          {isLegacyTimerRunning ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span className="font-poppins tabular-nums font-bold">
                                {formatDuration((timerNow - (activeTimer?.startTime || timerNow)) / 60000)}
                              </span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Start Timer</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-zinc-800 font-poppins tabular-nums">
                          {formatDuration(task.all_time_total_minutes || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Footer: Last completion timestamp */}
                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.borderLight}`,
                    paddingTop: theme.spacing.xs,
                  }}
                  className="flex items-center justify-between text-[11px] text-zinc-400 pt-2"
                >
                  <span className="truncate pr-1">{lastCompletedLine}</span>
                  <span className="text-zinc-500 font-medium group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all flex items-center gap-0.5 shrink-0">
                    <span>Manage</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW / EDIT TASK POPUP MODAL (used for both create and edit) */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderRadius: '1.5rem',
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '520px',
              width: '100%',
              maxHeight: '88vh',
            }}
            className="modal-surface flex flex-col overflow-hidden rounded-3xl"
          >
            {/* Modal Header */}
            <div
              style={{
                borderBottom: `1px solid ${theme.colors.borderLight}`,
                padding: theme.spacing.md,
              }}
              className="flex items-center justify-between shrink-0"
            >
              <h3 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                {editingTask ? 'Edit Task' : 'New Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-zinc-100/80 cursor-pointer text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Title Input */}
              <div>
                <label
                  className="text-xs font-semibold block mb-1"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus={!editingTask}
                  placeholder="e.g. Sprint Engineering Routine"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '40px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none font-semibold text-zinc-900"
                />
              </div>

              {/* "Tasks" Section (renamed from subtasks, allows writing anything, 2 lines by default) */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-bold uppercase tracking-wider block"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    Tasks ({formSubtasks.length})
                  </label>
                </div>

                {/* Inline add-row: text input + add button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add a task... (write anything you want)"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    style={{
                      backgroundColor: theme.colors.bgSecondary,
                      borderColor: theme.colors.borderLight,
                      borderRadius: theme.radius.md,
                      minHeight: '38px',
                    }}
                    className="flex-1 px-3 py-2 text-xs border focus:outline-none text-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: theme.colors.accentText,
                      borderRadius: theme.radius.md,
                      minHeight: '38px',
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 flex items-center gap-1 shrink-0 transition-opacity hover:opacity-90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Vertical list of task capsules */}
                {formSubtasks.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: theme.colors.bgSecondary,
                      borderColor: theme.colors.borderLight,
                      borderRadius: theme.radius.md,
                    }}
                    className="p-3 text-center border border-dashed text-xs text-zinc-400"
                  >
                    No tasks added yet. Add a task above.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full max-h-64 overflow-y-auto pr-1">
                    {[...formSubtasks]
                      .sort((a, b) => {
                        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return timeB - timeA;
                      })
                      .map((sub) => (
                      <TaskItemCapsule
                        key={sub.subtask_id}
                        sub={sub}
                        onExpand={(s) => {
                          setExpandedSubtask(s);
                          setExpandedEditText(s.title);
                          setSubtaskCopied(false);
                        }}
                        onDelete={handleDeleteSubtask}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer: total tasks count + Save button */}
            <div
              style={{
                borderTop: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.bgElevated,
                padding: theme.spacing.md,
              }}
              className="sticky bottom-0 flex items-center justify-between gap-3 shrink-0 shadow-xs"
            >
              {/* Left: Total tasks count */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Total Tasks
                </span>
                <span className="text-sm font-bold text-zinc-900 font-poppins tabular-nums">
                  {formSubtasks.length} {formSubtasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                {editingTask && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTask(editingTask.task_id, e)}
                    style={{ minHeight: '36px' }}
                    className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors font-medium mr-1"
                  >
                    Delete
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ minHeight: '36px' }}
                  className="px-3 py-1.5 text-xs rounded-lg border hover:bg-zinc-50 cursor-pointer font-medium text-zinc-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveTask()}
                  disabled={saving || !formTitle.trim()}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '36px',
                  }}
                  className="px-4 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPANDED TASK EDIT & COPY POPUP MODAL */}
      {expandedSubtask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setExpandedSubtask(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderRadius: '1.25rem',
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '480px',
              width: '100%',
            }}
            className="flex flex-col overflow-hidden p-4 space-y-3"
          >
            {/* Header: Title on left, Clipboard logo + Cross (X) on right */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <span className="text-xs font-bold text-zinc-800">Edit Task</span>
              <div className="flex items-center gap-1.5">
                {/* Clipboard logo to copy whole text */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(expandedEditText);
                    setSubtaskCopied(true);
                    setTimeout(() => setSubtaskCopied(false), 2000);
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                  title="Copy whole text to clipboard"
                >
                  {subtaskCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] text-emerald-600 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {/* Cross (X) to close */}
                <button
                  type="button"
                  onClick={() => setExpandedSubtask(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: Textarea where user can write anything they want */}
            <div>
              <textarea
                rows={6}
                autoFocus
                value={expandedEditText}
                onChange={(e) => setExpandedEditText(e.target.value)}
                placeholder="Write anything you want..."
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.borderLight,
                  borderRadius: theme.radius.md,
                }}
                className="w-full p-3 text-xs border focus:outline-none resize-y leading-relaxed text-zinc-900"
              />
            </div>

            {/* Footer: Delete, Cancel, Save */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  handleDeleteSubtask(expandedSubtask.subtask_id);
                  setExpandedSubtask(null);
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedSubtask(null)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-100 cursor-pointer text-zinc-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (expandedEditText.trim()) {
                      handleRenameSubtask(expandedSubtask.subtask_id, expandedEditText.trim());
                    }
                    setExpandedSubtask(null);
                  }}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                  }}
                  className="px-4 py-1.5 text-xs font-semibold cursor-pointer shadow-xs hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
