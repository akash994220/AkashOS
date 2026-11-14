import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import {
  computeTaskTotalMinutes,
  formatDuration,
  getSubtaskDisplayTime,
  toggleSubtaskTimerRemote,
} from '../../lib/subtasks';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import {
  Play,
  Check,
  Plus,
  Trash2,
  X,
  Clock,
  Search,
  CheckCircle2,
  Pause,
  Pencil,
  Copy,
  Sliders,
  Settings as SettingsIcon,
  Palette,
  Sparkles,
} from 'lucide-react';
import { ResizablePopupWrapper } from '../common/ResizablePopupWrapper';
import { motion, AnimatePresence } from 'motion/react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks } from '../../lib/linkUtils';

interface ActiveTimerStorage {
  taskId: string;
  startTime: number;
}

const TIMER_STORAGE_KEY = 'daily_task_active_timer';

const formatSubtaskTimestamp = (isoString?: string): string => {
  return formatDateTimeWithHM(isoString);
};

// ==========================================
// 20 SOFT PASTEL COLORS FOR TASK CAPSULES
// ==========================================
export interface SoftCapsulePalette {
  id: string;
  name: string;
  bgLight: string;
  border: string;
  text: string;
  dot: string;
}

export const SOFT_CAPSULE_PALETTES: SoftCapsulePalette[] = [
  { id: 'mint', name: 'Mint Emerald', bgLight: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981' },
  { id: 'sky', name: 'Sky Cyan', bgLight: '#F0F9FF', border: '#BAE6FD', text: '#0369A1', dot: '#0284C7' },
  { id: 'lavender', name: 'Soft Lavender', bgLight: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6', dot: '#8B5CF6' },
  { id: 'rose', name: 'Blush Rose', bgLight: '#FFF1F2', border: '#FECDD3', text: '#9F1239', dot: '#F43F5E' },
  { id: 'amber', name: 'Warm Amber', bgLight: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
  { id: 'peach', name: 'Coral Peach', bgLight: '#FFF7ED', border: '#FED7AA', text: '#9A3412', dot: '#EA580C' },
  { id: 'teal', name: 'Mellow Teal', bgLight: '#F0FDFA', border: '#99F6E4', text: '#115E59', dot: '#0D9488' },
  { id: 'indigo', name: 'Nordic Indigo', bgLight: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', dot: '#4F46E5' },
  { id: 'sage', name: 'Herbal Sage', bgLight: '#F2FBF4', border: '#BBF7D0', text: '#166534', dot: '#22C55E' },
  { id: 'periwinkle', name: 'Periwinkle', bgLight: '#F3F4FE', border: '#C7D2FE', text: '#3730A3', dot: '#6366F1' },
  { id: 'lemon', name: 'Lemon Cream', bgLight: '#FEFCE8', border: '#FEF08A', text: '#854D0E', dot: '#EAB308' },
  { id: 'dusty_violet', name: 'Dusty Violet', bgLight: '#F8F3FA', border: '#E9D5FF', text: '#6B21A8', dot: '#A855F7' },
  { id: 'seafoam', name: 'Seafoam Green', bgLight: '#E6F7F2', border: '#A7F3D0', text: '#115E59', dot: '#14B8A6' },
  { id: 'apricot', name: 'Sweet Apricot', bgLight: '#FFF4EC', border: '#FED7AA', text: '#9A3412', dot: '#F97316' },
  { id: 'powder_blue', name: 'Powder Blue', bgLight: '#EDF7FF', border: '#BAE6FD', text: '#075985', dot: '#38BDF8' },
  { id: 'pale_mauve', name: 'Pale Mauve', bgLight: '#FDF2F8', border: '#FBCFE8', text: '#9D174D', dot: '#EC4899' },
  { id: 'matcha', name: 'Fresh Matcha', bgLight: '#F4F8EC', border: '#D9F99D', text: '#3F6212', dot: '#84CC16' },
  { id: 'chamomile', name: 'Chamomile', bgLight: '#FEF9E7', border: '#FDE68A', text: '#854D0E', dot: '#F59E0B' },
  { id: 'cloud', name: 'Cloud Gray', bgLight: '#F4F4F5', border: '#E4E4E7', text: '#27272A', dot: '#71717A' },
  { id: 'sand', name: 'Soft Sand', bgLight: '#FBF8F3', border: '#E7E5E4', text: '#44403C', dot: '#78716C' },
];

const getPaletteForSubtask = (sub: TaskSubtask, index: number): SoftCapsulePalette => {
  if (sub.color) {
    const found = SOFT_CAPSULE_PALETTES.find((p) => p.id === sub.color);
    if (found) return found;
  }
  return SOFT_CAPSULE_PALETTES[index % SOFT_CAPSULE_PALETTES.length];
};

const getRandomNonClashingColor = (existingSubtasks: TaskSubtask[]): string => {
  const topColor = existingSubtasks[0]?.color;
  const available = SOFT_CAPSULE_PALETTES.filter((p) => p.id !== topColor);
  const picked = available[Math.floor(Math.random() * available.length)] || SOFT_CAPSULE_PALETTES[0];
  return picked.id;
};

/**
 * Subtask Capsule Pill Component
 * With dynamic styling from capsuleScale, selection highlight in settings mode,
 * and 20 soft pastel color backgrounds
 */
interface SubtaskCapsulePillProps {
  sub: TaskSubtask;
  index: number;
  timerNow: number;
  isSettingsOpen: boolean;
  isSelectedInSettings: boolean;
  computedStyle: {
    padding: string;
    borderRadius: string;
    fontSize: string;
    timeFontSize: string;
    iconSize: number;
    checkboxSize: number;
  };
  onExpand: (sub: TaskSubtask) => void;
  onSelectForConfig: (sub: TaskSubtask) => void;
  onToggleDone: (subtaskId: string) => void;
  onToggleTimer: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
}

const SubtaskCapsulePill: React.FC<SubtaskCapsulePillProps> = ({
  sub,
  index,
  timerNow,
  isSettingsOpen,
  isSelectedInSettings,
  computedStyle,
  onExpand,
  onSelectForConfig,
  onToggleDone,
  onToggleTimer,
  onDelete,
}) => {
  const palette = getPaletteForSubtask(sub, index);
  const showTimestamp = sub.show_timestamp !== false;

  const handleClick = () => {
    if (isSettingsOpen) {
      onSelectForConfig(sub);
    } else {
      onExpand(sub);
    }
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -22, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 12, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{
        layout: { type: 'spring', stiffness: 380, damping: 28, mass: 0.75 },
        type: 'spring',
        stiffness: 420,
        damping: 28,
        mass: 0.7,
      }}
      onClick={handleClick}
      style={{
        padding: computedStyle.padding,
        borderRadius: computedStyle.borderRadius,
        backgroundColor: palette.bgLight,
        borderColor: isSelectedInSettings ? '#18181B' : palette.border,
      }}
      className={`group relative flex items-center justify-between gap-2.5 border transition-all shadow-2xs w-full cursor-pointer ${
        isSelectedInSettings
          ? 'ring-2 ring-zinc-900 ring-offset-2 scale-[1.01]'
          : isSettingsOpen
          ? 'hover:ring-2 hover:ring-zinc-400'
          : 'hover:border-zinc-400 hover:shadow-xs'
      } ${sub.is_done ? 'opacity-70' : sub.is_running ? 'shadow-xs' : ''}`}
    >
      {/* Left: Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(sub.subtask_id);
        }}
        style={{
          width: `${computedStyle.checkboxSize}px`,
          height: `${computedStyle.checkboxSize}px`,
        }}
        className={`rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          sub.is_done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-zinc-300 hover:border-zinc-500 bg-white'
        }`}
        title={sub.is_done ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {sub.is_done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </button>

      {/* Middle: First line only in general; extended content visible when clicked */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p
            style={{
              fontSize: computedStyle.fontSize,
              color: palette.text,
            }}
            className={`font-semibold leading-snug truncate select-text min-w-0 flex-1 ${
              sub.is_done ? 'line-through opacity-60' : ''
            }`}
          >
            {tokenizeTextWithLinks((sub.title || '').split('\n')[0] || '').map((token, i) =>
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
          {(sub.title || '').includes('\n') && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/5 text-zinc-600 shrink-0 select-none"
              title="Has extended details (click to open)"
            >
              +more
            </span>
          )}
        </div>

        {showTimestamp && sub.created_at && (
          <span
            style={{ fontSize: computedStyle.timeFontSize }}
            className="text-zinc-500/80 font-medium block"
          >
            {formatSubtaskTimestamp(sub.created_at)}
          </span>
        )}
      </div>

      {/* Right: Live Time Tracker & Delete Icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTimer(sub.subtask_id);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-poppins tabular-nums cursor-pointer transition-all ${
            sub.is_running
              ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
              : 'bg-white/80 hover:bg-white text-zinc-700 border border-black/5'
          }`}
          title={sub.is_running ? 'Pause timer' : 'Start stopwatch timer'}
        >
          {sub.is_running ? (
            <Pause className="w-3 h-3 fill-current text-rose-600" />
          ) : (
            <Play className="w-3 h-3 fill-current text-zinc-500" />
          )}
          <span>{getSubtaskDisplayTime(sub, timerNow)}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(sub.subtask_id);
          }}
          aria-label="Delete capsule"
          title="Delete capsule"
          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
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
  const [quickAddedNotification, setQuickAddedNotification] = useState(false);

  // New/Edit Task Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<TaskSubtask[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const activeDraftTaskIdRef = useRef<string | null>(null);

  // Anchored Floating Popover for Adding New Capsule
  const [isAddCapsulePopoverOpen, setIsAddCapsulePopoverOpen] = useState(false);
  const [popoverCapsuleText, setPopoverCapsuleText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Expandable Task Edit Popup Modal State
  const [expandedSubtask, setExpandedSubtask] = useState<TaskSubtask | null>(null);
  const [expandedEditText, setExpandedEditText] = useState('');
  const [subtaskCopied, setSubtaskCopied] = useState(false);

  // Settings Sidecar Panel State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'details' | 'settings'>('details');
  const [selectedCapsuleIdForConfig, setSelectedCapsuleIdForConfig] = useState<string | null>(null);

  // Flexible Capsule Scale (from 0.75x to 2.2x, pleasing to eye)
  const [capsuleScale, setCapsuleScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('daily_task_capsule_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.75 && val <= 2.5) return val;
      }
    } catch {}
    return 1.0;
  });

  const todayDateStr = new Date().toISOString().split('T')[0];

  // Live timer tick every 1000ms while any subtask or task timer is active
  useEffect(() => {
    const hasRunningSubtask = tasks.some((t) => t.subtasks?.some((s) => s.is_running));
    const hasRunningDraft = formSubtasks.some((s) => s.is_running);
    if (!activeTimer && !hasRunningSubtask && !hasRunningDraft) return;

    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, tasks, formSubtasks]);

  // Back button handling
  useEffect(() => {
    if (isAddCapsulePopoverOpen) {
      return registerBackHandler(() => {
        setIsAddCapsulePopoverOpen(false);
        return true;
      });
    }
    if (expandedSubtask) {
      return registerBackHandler(() => {
        setExpandedSubtask(null);
        return true;
      });
    }
    if (isSettingsOpen) {
      return registerBackHandler(() => {
        setIsSettingsOpen(false);
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
  }, [isAddCapsulePopoverOpen, expandedSubtask, isSettingsOpen, showAddModal, editingTask, registerBackHandler]);

  // 1. Subscribe to tasks
  useEffect(() => {
    if (!user || !db) return;
    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qTasks,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
        list.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        setTasks(list);

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

  // 2. Subscribe to sessions
  useEffect(() => {
    if (!user || !db) return;
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

  // 3. Initialize legacy timer from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveTimerStorage;
        if (parsed && parsed.taskId && parsed.startTime) {
          setActiveTimer(parsed);
        }
      }
    } catch {}
  }, []);

  const saveTimerToStorage = (timer: ActiveTimerStorage | null) => {
    setActiveTimer(timer);
    try {
      if (timer) {
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
      } else {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    } catch {}
  };


  // Capsule scale changes
  const handleScaleChange = (val: number) => {
    const clamped = Math.max(0.75, Math.min(2.5, val));
    setCapsuleScale(clamped);
    try {
      localStorage.setItem('daily_task_capsule_scale', clamped.toString());
    } catch {}
  };

  // Computed subtask dimensions based on capsuleScale
  const computedSubtaskStyle = useMemo(() => {
    const s = capsuleScale;
    const padY = Math.round(10 * s);
    const padX = Math.round(14 * s);
    const radius = Math.round(18 * s);
    const textPx = Math.round(12 * s);
    const timePx = Math.round(11 * s);
    const iconPx = Math.max(14, Math.round(14 * s));
    const checkboxPx = Math.max(18, Math.round(20 * s));

    return {
      padding: `${padY}px ${padX}px`,
      borderRadius: `${radius}px`,
      fontSize: `${textPx}px`,
      timeFontSize: `${timePx}px`,
      iconSize: iconPx,
      checkboxSize: checkboxPx,
    };
  }, [capsuleScale]);

  // Quick Inline Add from top bar
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim() || !user || !db) return;

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
      setQuickAddedNotification(true);
      setTimeout(() => setQuickAddedNotification(false), 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_tasks/${taskId}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // Open Create Modal
  const handleOpenAdd = () => {
    activeDraftTaskIdRef.current = null;
    setEditingTask(null);
    setFormTitle('');
    setIsEditingTitle(true);
    setFormNotes('');
    setFormSubtasks([]);
    setPopoverCapsuleText('');
    setIsAddCapsulePopoverOpen(false);
    setIsSettingsOpen(false);
    setActiveMobileTab('details');
    setSelectedCapsuleIdForConfig(null);
    setAutoSaveStatus('idle');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task: DailyTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    activeDraftTaskIdRef.current = task.task_id;
    setEditingTask(task);
    setFormTitle(task.title || '');
    setIsEditingTitle(false);
    setFormNotes(task.notes || '');
    const sortedSubs = task.subtasks
      ? [...task.subtasks].sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        })
      : [];
    setFormSubtasks(sortedSubs);
    setPopoverCapsuleText('');
    setIsAddCapsulePopoverOpen(false);
    setIsSettingsOpen(false);
    setActiveMobileTab('details');
    setSelectedCapsuleIdForConfig(null);
    setAutoSaveStatus('saved');
    setShowAddModal(true);
  };

  // Auto-Save Task to Firestore
  const autoSaveTaskNow = async (
    customTitle?: string,
    customSubs?: TaskSubtask[],
    customNotes?: string
  ) => {
    if (!user || !db) return;
    const titleToUse = (customTitle !== undefined ? customTitle : formTitle).trim();
    if (!titleToUse) return;

    setAutoSaveStatus('saving');
    setSaving(true);
    const taskId = editingTask ? editingTask.task_id : (activeDraftTaskIdRef.current || `task_${Date.now()}`);
    if (!editingTask && !activeDraftTaskIdRef.current) {
      activeDraftTaskIdRef.current = taskId;
    }

    const subtasksToUse = customSubs !== undefined ? customSubs : formSubtasks;
    const hasSubtasks = subtasksToUse.length > 0;

    const payload: Partial<DailyTask> = {
      task_id: taskId,
      owner_uid: user.uid,
      title: titleToUse,
      subtitle: '',
      notes: (customNotes !== undefined ? customNotes : formNotes).trim(),
      subtasks: subtasksToUse,
    };

    if (!editingTask) {
      payload.created_at = new Date().toISOString();
      payload.last_completed_at = null;
      if (!hasSubtasks) {
        payload.all_time_total_minutes = 0;
      }
    }

    try {
      await setDoc(doc(db, 'daily_tasks', taskId), payload, { merge: true });
      setAutoSaveStatus('saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_tasks/${taskId}`);
      setAutoSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user || !db) return;

    if (activeTimer && activeTimer.taskId === taskId) {
      saveTimerToStorage(null);
    }

    try {
      await deleteDoc(doc(db, 'daily_tasks', taskId));
      setShowAddModal(false);
      setEditingTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `daily_tasks/${taskId}`);
    }
  };

  // Commit new capsule from anchored popover with smart non-clashing soft color
  const handleCommitNewCapsule = async () => {
    const text = popoverCapsuleText.trim();
    if (!text) {
      setIsAddCapsulePopoverOpen(false);
      return;
    }

    const assignedColor = getRandomNonClashingColor(formSubtasks);

    const newSub: TaskSubtask = {
      subtask_id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: text,
      created_at: new Date().toISOString(),
      is_running: false,
      timer_started_at: null,
      accumulated_minutes: 0,
      is_done: false,
      color: assignedColor,
      show_timestamp: true,
    };

    const updated = [newSub, ...formSubtasks];
    setFormSubtasks(updated);
    setPopoverCapsuleText('');
    setIsAddCapsulePopoverOpen(false);

    if (formTitle.trim()) {
      await autoSaveTaskNow(undefined, updated);
    }
  };

  const handleToggleSubtaskDone = async (subtaskId: string) => {
    const updated = formSubtasks.map((s) => (s.subtask_id === subtaskId ? { ...s, is_done: !s.is_done } : s));
    setFormSubtasks(updated);
    if (formTitle.trim()) {
      await autoSaveTaskNow(undefined, updated);
    }
  };

  const handleRenameSubtask = async (subtaskId: string, newTitle: string) => {
    const updated = formSubtasks.map((s) => (s.subtask_id === subtaskId ? { ...s, title: newTitle } : s));
    setFormSubtasks(updated);
    if (formTitle.trim()) {
      await autoSaveTaskNow(undefined, updated);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const updated = formSubtasks.filter((s) => s.subtask_id !== subtaskId);
    setFormSubtasks(updated);
    if (selectedCapsuleIdForConfig === subtaskId) {
      setSelectedCapsuleIdForConfig(null);
    }
    if (formTitle.trim()) {
      await autoSaveTaskNow(undefined, updated);
    }
  };

  const handleModalToggleSubtaskTimer = async (subtaskId: string) => {
    if (editingTask) {
      try {
        await toggleSubtaskTimerRemote(editingTask.task_id, subtaskId, tasks);
      } catch (err) {
        console.error('Error toggling subtask timer:', err);
      }
    } else {
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
              let addedMin = 0;
              if (s.timer_started_at) {
                const start = new Date(s.timer_started_at).getTime();
                if (!isNaN(start)) {
                  addedMin = Math.max(0, (now - start) / 60000);
                }
              }
              return {
                ...s,
                is_running: false,
                timer_started_at: null,
                accumulated_minutes: (Number(s.accumulated_minutes) || 0) + addedMin,
              };
            }
          }
          return s;
        })
      );
    }
  };

  // Toggle mark completed today
  const handleToggleDoneToday = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !db) return;

    const isDone = Boolean(task.last_completed_at?.startsWith(todayDateStr));
    const newTimestamp = isDone ? null : new Date().toISOString();

    try {
      await updateDoc(doc(db, 'daily_tasks', task.task_id), {
        last_completed_at: newTimestamp,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `daily_tasks/${task.task_id}`);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const isDoneToday = Boolean(t.last_completed_at?.startsWith(todayDateStr));
    const isRunning = Boolean(
      (activeTimer && activeTimer.taskId === t.task_id) ||
      (t.subtasks && t.subtasks.some((s) => s.is_running))
    );

    if (statusFilter === 'marked' && !isDoneToday) return false;
    if (statusFilter === 'active_timer' && !isRunning) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      const matchSubs = (t.subtasks || []).some((s) => (s.title || '').toLowerCase().includes(q));
      if (!matchTitle && !matchNotes && !matchSubs) return false;
    }

    return true;
  });

  const markedCount = tasks.filter((t) => t.last_completed_at?.startsWith(todayDateStr)).length;
  const timerActiveCount = tasks.filter((t) =>
    Boolean((activeTimer && activeTimer.taskId === t.task_id) || t.subtasks?.some((s) => s.is_running))
  ).length;

  // Selected capsule for settings panel
  const selectedCapsuleForConfig = formSubtasks.find((s) => s.subtask_id === selectedCapsuleIdForConfig) || null;

  return (
    <div className="space-y-5 pb-28 md:pb-16 max-w-7xl mx-auto px-4 sm:px-6 relative">
      {/* Quick Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-2 sm:p-2.5 border shadow-xs flex items-center gap-2"
      >
        <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Quick add a task... (saves automatically on Enter)"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onBlur={() => {
            if (quickTitle.trim() && !quickAdding) {
              handleQuickAdd();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
          className="flex-1 bg-transparent px-2 text-xs focus:outline-none text-zinc-900 placeholder:text-zinc-400 font-medium min-h-[44px]"
        />
        {quickAddedNotification && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 animate-in fade-in shrink-0">
            ✓ Saved
          </span>
        )}
        <button
          type="submit"
          disabled={quickAdding || !quickTitle.trim()}
          style={{
            backgroundColor: quickTitle.trim() ? theme.colors.accent : theme.colors.bgSecondary,
            color: quickTitle.trim() ? theme.colors.accentText : theme.colors.textSecondary,
            borderRadius: theme.radius.md,
            minHeight: '40px',
            minWidth: '60px',
          }}
          className="px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center"
        >
          {quickAdding ? 'Saving...' : 'Add'}
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

      {/* Task Cards Grid */}
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
              : 'Add routines with subtask capsules. Track focused time with live-ticking stopwatches.'}
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

            const taskTotalMin = computeTaskTotalMinutes(task, timerNow);
            const doneSubtaskCount = (task.subtasks || []).filter((s) => s.is_done).length;
            const totalSubtaskCount = task.subtasks?.length || 0;

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
                className={`p-4 border transition-all duration-200 hover:border-blue-300/70 hover:shadow-md cursor-pointer flex flex-col justify-between group relative ${
                  isCardActive ? 'ring-2 ring-blue-500/20 bg-blue-50/15' : ''
                }`}
              >
                {/* Top Section: Checkbox + Bold Title + Hover Pen Button */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        id={`toggle-done-${task.task_id}`}
                        onClick={(e) => handleToggleDoneToday(task, e)}
                        aria-label={isDoneToday ? 'Mark unmarked' : 'Mark item'}
                        style={{
                          borderRadius: '0.5rem',
                          backgroundColor: isDoneToday ? '#0D9488' : 'transparent',
                          borderColor: isDoneToday ? '#0D9488' : theme.colors.borderMedium,
                          color: isDoneToday ? '#FFFFFF' : 'transparent',
                          minWidth: '22px',
                          minHeight: '22px',
                        }}
                        className="w-5 h-5 mt-0.5 border flex items-center justify-center shrink-0 transition-colors cursor-pointer hover:border-teal-500"
                        title={isDoneToday ? 'Toggle mark' : 'Mark item'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      {/* Clean Bold Title without bounding box */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black leading-snug line-clamp-1 truncate text-zinc-900">
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
                      </div>
                    </div>

                    {/* Pen Edit Button - invisible unless hovered */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(task, e)}
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
                      title="Edit Task"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle: Active running subtask or capsules preview */}
                {hasSubtasks ? (
                  <div className="my-2.5 space-y-2">
                    {runningSubtask && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSubtaskTimerRemote(task.task_id, runningSubtask.subtask_id, tasks);
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 animate-pulse cursor-pointer"
                        title="Click to pause active capsule timer"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-xs font-semibold text-rose-900 truncate">
                            {runningSubtask.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-poppins tabular-nums font-bold text-rose-800">
                            {getSubtaskDisplayTime(runningSubtask, timerNow)}
                          </span>
                          <Pause className="w-3.5 h-3.5 fill-current text-rose-600" />
                        </div>
                      </div>
                    )}

                    {/* Total Time & Capsule Count stats */}
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-semibold text-zinc-800 font-poppins tabular-nums">
                          {formatDuration(taskTotalMin)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {doneSubtaskCount}/{totalSubtaskCount} capsules
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="my-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                    <span className="text-[11px]">0 capsules</span>
                    <span className="font-poppins tabular-nums">{formatDuration(taskTotalMin)}</span>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-medium text-zinc-400">
                  <span>
                    {isDoneToday ? (
                      <span className="text-teal-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Done today
                      </span>
                    ) : (
                      'Pending today'
                    )}
                  </span>
                  <span className="text-zinc-600 group-hover:text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                    Open
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* FLOATING ROUND PLUS ACTION BUTTON FOR CREATING NEW TASKS           */}
      {/* ================================================================= */}
      <button
        type="button"
        id="fab-create-task"
        onClick={handleOpenAdd}
        className="fixed bottom-24 sm:bottom-8 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 hover:opacity-95 text-white shadow-[0_10px_28px_-4px_rgba(37,99,235,0.45)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer min-h-[48px] min-w-[48px] border border-white/25"
        title="Create New Task"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* ================================================================= */}
      {/* TASK DETAIL / EDIT MODAL + ADAPTABLE DOCKED SETTINGS PANEL        */}
      {/* ================================================================= */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-x-auto"
          onClick={() => {
            // Clicking outside does not close the popup; automatically persist pending inputs
            autoSaveTaskNow();
          }}
        >
          {/* Flex Container for Main Modal + Docked Sidecar Settings */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-start gap-3 max-w-[98vw] max-h-[94dvh] transition-all"
          >
            {/* MAIN TASK POPUP WRAPPER with All / Only This options */}
            <ResizablePopupWrapper
              scope="tasks"
              popupId="task_details"
              defaultWidth={560}
              isSettingsOpen={isSettingsOpen}
              className="max-h-[92dvh]"
            >
              {/* Inner Modal Card Container */}
              <div className="flex flex-col flex-1 bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden relative">
              {/* Modal Header: Task Details + Settings Icon Button + Close */}
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                    {editingTask ? 'Task Details' : 'New Task'}
                  </span>

                  {/* Settings Icon Button beside Task Details */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen((prev) => !prev);
                      setActiveMobileTab('settings');
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      isSettingsOpen
                        ? 'bg-zinc-900 text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                    title={isSettingsOpen ? 'Close task settings' : 'Open task & capsule settings'}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold hidden xs:inline">Settings</span>
                  </button>

                  {autoSaveStatus === 'saving' && (
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
                      ✓ Auto-saved
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    autoSaveTaskNow();
                    setShowAddModal(false);
                    setEditingTask(null);
                    setIsSettingsOpen(false);
                  }}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile View Toggle when Settings is Open (Docks as Tab on Mobile) */}
              {isSettingsOpen && (
                <div className="flex md:hidden items-center p-1 bg-zinc-100 border-b border-zinc-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('details')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeMobileTab === 'details' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                    }`}
                  >
                    Task Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('settings')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeMobileTab === 'settings' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                    }`}
                  >
                    Settings
                  </button>
                </div>
              )}

              {/* Mobile Settings View tab (strictly mobile only when settings tab is active) */}
              {isSettingsOpen && activeMobileTab === 'settings' && (
                <div className="p-5 overflow-y-auto space-y-5 flex-1 block md:hidden">
                  {/* Settings Content for Mobile */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between pb-1.5">
                        <label className="text-xs font-black uppercase text-zinc-700 tracking-wider flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Capsule Size:</span>
                        </label>
                        <span className="text-xs font-black font-poppins text-zinc-900 tabular-nums">
                          {Math.round(capsuleScale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="2.5"
                        step="0.05"
                        value={capsuleScale}
                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                      />
                    </div>

                    <div className="pt-3 border-t border-zinc-200">
                      <h4 className="text-xs font-black uppercase text-zinc-700 tracking-wider mb-2">
                        {selectedCapsuleForConfig ? 'Customize Selected Capsule' : 'Select a Capsule'}
                      </h4>
                      {selectedCapsuleForConfig ? (
                        <div className="space-y-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            &quot;{selectedCapsuleForConfig.title}&quot;
                          </p>

                          <label className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-xs font-semibold text-zinc-700">Show Timestamp</span>
                            <input
                              type="checkbox"
                              checked={selectedCapsuleForConfig.show_timestamp !== false}
                              onChange={(e) => {
                                const updated = formSubtasks.map((s) =>
                                  s.subtask_id === selectedCapsuleForConfig.subtask_id
                                    ? { ...s, show_timestamp: e.target.checked }
                                    : s
                                );
                                setFormSubtasks(updated);
                                autoSaveTaskNow(undefined, updated);
                              }}
                              className="w-4 h-4 accent-zinc-900 rounded cursor-pointer"
                            />
                          </label>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase">20 Soft Pastel Colors</span>
                            <div className="grid grid-cols-5 gap-1.5">
                              {SOFT_CAPSULE_PALETTES.map((pal) => (
                                <button
                                  key={pal.id}
                                  type="button"
                                  onClick={() => {
                                    const updated = formSubtasks.map((s) =>
                                      s.subtask_id === selectedCapsuleForConfig.subtask_id
                                        ? { ...s, color: pal.id }
                                        : s
                                    );
                                    setFormSubtasks(updated);
                                    autoSaveTaskNow(undefined, updated);
                                  }}
                                  style={{ backgroundColor: pal.bgLight, borderColor: pal.border }}
                                  className={`flex flex-col items-center p-1 rounded-xl border transition-all cursor-pointer ${
                                    selectedCapsuleForConfig.color === pal.id
                                      ? 'ring-2 ring-zinc-900 ring-offset-1 scale-105'
                                      : 'hover:scale-102'
                                  }`}
                                  title={pal.name}
                                >
                                  <span style={{ backgroundColor: pal.dot }} className="w-3.5 h-3.5 rounded-full" />
                                  <span className="text-[8px] font-bold text-zinc-600 truncate max-w-full mt-0.5">
                                    {pal.name.split(' ')[0]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                          Switch to &quot;Task Details&quot; tab and tap any capsule to customize its color and timestamp.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Body: Task Details (ALWAYS rendered on desktop `md:flex`; on mobile rendered when settings closed or details tab active) */}
              <div
                className={`p-5 overflow-y-auto space-y-4 flex-1 ${
                  isSettingsOpen && activeMobileTab === 'settings' ? 'hidden md:flex md:flex-col' : 'flex flex-col'
                }`}
              >
                  {/* Task Title Row: Borderless Bold Text + Invisible Hover Pen Button */}
                  <div className="relative">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          autoFocus
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setIsEditingTitle(false);
                              autoSaveTaskNow();
                            } else if (e.key === 'Escape') {
                              setIsEditingTitle(false);
                            }
                          }}
                          onBlur={() => {
                            setIsEditingTitle(false);
                            autoSaveTaskNow();
                          }}
                          placeholder="Task title..."
                          className="flex-1 text-xl sm:text-2xl font-black text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900 px-2 py-1 rounded-t-lg focus:outline-none focus:bg-white transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingTitle(false);
                            autoSaveTaskNow();
                          }}
                          className="p-2 rounded-lg bg-zinc-900 text-white cursor-pointer hover:bg-zinc-800 shrink-0"
                          title="Save title"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingTitle(true)}
                        className="group/title flex items-center justify-between gap-2 cursor-pointer w-full py-1 rounded-lg hover:bg-zinc-50/70 transition-colors px-1"
                        title="Click to edit task title"
                      >
                        <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight select-text break-words min-w-0 flex-1">
                          {formTitle.trim() || (
                            <span className="text-zinc-300 italic font-normal">Click to enter task title...</span>
                          )}
                        </h2>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingTitle(true);
                          }}
                          className="opacity-70 sm:opacity-0 group-hover/title:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer shrink-0"
                          title="Edit title"
                        >
                          <Pencil className="w-4 h-4 stroke-[2.2]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subtask Capsules Section: Directly Below Title with Round (+) Icon */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between relative pb-1 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                          Capsules
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 tabular-nums">
                          {formSubtasks.length}
                        </span>
                        {isSettingsOpen && (
                          <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 animate-in fade-in">
                            Tap a capsule to customize
                          </span>
                        )}
                      </div>

                      {/* Round Plus Icon Button with Anchored Floating Popover */}
                      <div className="relative">
                        <button
                          type="button"
                          id="button-add-capsule"
                          onClick={() => setIsAddCapsulePopoverOpen((prev) => !prev)}
                          className={`w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            isAddCapsulePopoverOpen ? 'bg-zinc-700 rotate-45' : 'hover:bg-zinc-800 active:scale-95'
                          }`}
                          title={isAddCapsulePopoverOpen ? 'Close capsule popover' : 'Add new capsule'}
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        {/* Floating Popover Anchored to (+) Button */}
                        <AnimatePresence>
                          {isAddCapsulePopoverOpen && (
                            <motion.div
                              ref={popoverRef}
                              initial={{ opacity: 0, scale: 0.88, y: -6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.88, y: -6, transition: { duration: 0.15 } }}
                              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                              className="absolute right-0 top-10 w-72 sm:w-80 p-3 bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 flex flex-col space-y-2.5"
                            >
                              <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
                                <span className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
                                  New Capsule
                                </span>
                                <button
                                  type="button"
                                  onClick={handleCommitNewCapsule}
                                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <textarea
                                rows={3}
                                autoFocus
                                value={popoverCapsuleText}
                                onChange={(e) => setPopoverCapsuleText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommitNewCapsule();
                                  } else if (e.key === 'Escape') {
                                    setIsAddCapsulePopoverOpen(false);
                                    setPopoverCapsuleText('');
                                  }
                                }}
                                onBlur={() => {
                                  handleCommitNewCapsule();
                                }}
                                placeholder="First line: capsule title...&#10;Shift+Enter: detailed note"
                                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none text-zinc-900 font-medium placeholder:text-zinc-400 resize-none min-h-[64px] leading-relaxed"
                              />

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5">
                                <span><kbd className="font-mono font-bold bg-zinc-100 px-1 py-0.5 rounded">Enter</kbd> saves · <kbd className="font-mono font-bold bg-zinc-100 px-1 py-0.5 rounded">Shift+Enter</kbd> newline</span>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={handleCommitNewCapsule}
                                  disabled={!popoverCapsuleText.trim()}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white font-bold hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-2xs"
                                >
                                  Save
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Animated Subtask Capsules Stream */}
                    {formSubtasks.length === 0 ? (
                      <div
                        onClick={() => setIsAddCapsulePopoverOpen(true)}
                        className="p-5 text-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 transition-all cursor-pointer space-y-1 group"
                      >
                        <Plus className="w-5 h-5 text-zinc-400 mx-auto group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-bold text-zinc-700">No capsules added yet</p>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          Tap the <span className="font-bold text-zinc-700">(+)</span> icon above to add a capsule
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 w-full max-h-[380px] overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                          {formSubtasks.map((sub, idx) => (
                            <SubtaskCapsulePill
                              key={sub.subtask_id}
                              sub={sub}
                              index={idx}
                              timerNow={timerNow}
                              isSettingsOpen={isSettingsOpen}
                              isSelectedInSettings={selectedCapsuleIdForConfig === sub.subtask_id}
                              computedStyle={computedSubtaskStyle}
                              onExpand={(s) => {
                                setExpandedSubtask(s);
                                setExpandedEditText(s.title);
                                setSubtaskCopied(false);
                              }}
                              onSelectForConfig={(s) => {
                                setSelectedCapsuleIdForConfig(s.subtask_id);
                              }}
                              onToggleDone={handleToggleSubtaskDone}
                              onToggleTimer={handleModalToggleSubtaskTimer}
                              onDelete={handleDeleteSubtask}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer: Delete & Done button */}
                <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0 bg-white shadow-xs">
                  <div>
                    {editingTask && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(editingTask.task_id, e)}
                        className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors font-medium min-h-[40px] flex items-center"
                      >
                        Delete Task
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      autoSaveTaskNow();
                      setShowAddModal(false);
                      setEditingTask(null);
                      setIsSettingsOpen(false);
                    }}
                    className="px-5 py-2 text-xs font-bold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs min-h-[40px]"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </ResizablePopupWrapper>

            {/* SIDECAR SETTINGS PANEL (Docks right beside popup on desktop, moves with it) */}
            {isSettingsOpen && (
              <div
                className="hidden md:flex flex-col bg-white rounded-3xl shadow-2xl border border-zinc-200 w-80 max-h-[92dvh] overflow-hidden shrink-0 animate-in fade-in slide-in-from-left-4 duration-200"
              >
                {/* Sidecar Header */}
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-zinc-700" />
                    <span className="text-xs font-black uppercase text-zinc-900 tracking-wider">
                      Task Settings
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                    title="Close settings"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sidecar Body */}
                <div className="p-4 overflow-y-auto space-y-5 flex-1">
                  {/* Setting 1: Flexible Capsule Size Scale (up to eye-pleasing comfort) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Capsule Zoom:</span>
                      </span>
                      <span className="font-poppins tabular-nums text-zinc-900 font-black">
                        {Math.round(capsuleScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="2.5"
                      step="0.05"
                      value={capsuleScale}
                      onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                      title="Adjust capsule scale to eye comfort"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                      <span>Compact</span>
                      <span>Comfortable</span>
                      <span>Expansive</span>
                    </div>
                  </div>

                  {/* Setting 2: Selected Capsule Customization */}
                  <div className="pt-3 border-t border-zinc-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-900 tracking-wider">
                        Capsule Styling
                      </span>
                      {selectedCapsuleForConfig && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          Selected
                        </span>
                      )}
                    </div>

                    {selectedCapsuleForConfig ? (
                      <div className="space-y-3.5 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200">
                        {/* Selected Capsule Title Preview */}
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                            Editing Capsule
                          </span>
                          <p className="text-xs font-bold text-zinc-800 line-clamp-2 leading-snug mt-0.5">
                            {selectedCapsuleForConfig.title}
                          </p>
                        </div>

                        {/* Timestamp Toggle */}
                        <div className="pt-2 border-t border-zinc-200/80">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <span className="text-xs font-semibold text-zinc-700">
                              Show Creation Timestamp
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedCapsuleForConfig.show_timestamp !== false}
                              onChange={(e) => {
                                const updated = formSubtasks.map((s) =>
                                  s.subtask_id === selectedCapsuleForConfig.subtask_id
                                    ? { ...s, show_timestamp: e.target.checked }
                                    : s
                                );
                                setFormSubtasks(updated);
                                autoSaveTaskNow(undefined, updated);
                              }}
                              className="w-4 h-4 accent-zinc-900 rounded cursor-pointer"
                            />
                          </label>
                        </div>

                        {/* 20 Soft Pastel Color Palettes */}
                        <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase text-zinc-600 tracking-wider flex items-center gap-1">
                              <Palette className="w-3 h-3 text-zinc-500" />
                              <span>20 Soft Palettes</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 capitalize">
                              {selectedCapsuleForConfig.color || 'Default'}
                            </span>
                          </div>

                          <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                            {SOFT_CAPSULE_PALETTES.map((pal) => {
                              const isCurrent = selectedCapsuleForConfig.color === pal.id;
                              return (
                                <button
                                  key={pal.id}
                                  type="button"
                                  onClick={() => {
                                    const updated = formSubtasks.map((s) =>
                                      s.subtask_id === selectedCapsuleForConfig.subtask_id
                                        ? { ...s, color: pal.id }
                                        : s
                                    );
                                    setFormSubtasks(updated);
                                    autoSaveTaskNow(undefined, updated);
                                  }}
                                  style={{
                                    backgroundColor: pal.bgLight,
                                    borderColor: pal.border,
                                  }}
                                  className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'ring-2 ring-zinc-900 ring-offset-1 scale-105 shadow-2xs'
                                      : 'hover:scale-102 hover:border-zinc-400'
                                  }`}
                                  title={pal.name}
                                >
                                  <span
                                    style={{ backgroundColor: pal.dot }}
                                    className="w-3.5 h-3.5 rounded-full shadow-2xs"
                                  />
                                  <span className="text-[8px] font-bold text-zinc-700 truncate max-w-full mt-1">
                                    {pal.name.split(' ')[0]}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-center space-y-1.5">
                        <Sparkles className="w-5 h-5 text-zinc-400 mx-auto" />
                        <p className="text-xs font-bold text-zinc-700">No Capsule Selected</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Click any capsule on the left to customize its soft color and toggle its timestamp.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPANDED TASK EDIT & COPY POPUP MODAL */}
      {expandedSubtask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <ResizablePopupWrapper
            scope="tasks"
            popupId="capsule_details"
            defaultWidth={740}
            minWidth={460}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.bgElevated,
                borderRadius: '1.5rem',
                boxShadow: theme.shadows.lg,
              }}
              className="w-full flex flex-col overflow-hidden p-5 sm:p-6 space-y-4 border border-zinc-200"
            >
            {/* Header: Title on left, Clipboard logo + Cross (X) on right */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-sm font-black text-zinc-900 uppercase tracking-wider block">
                  Capsule Details
                </span>
                <span className="text-[11px] text-zinc-400 font-medium block mt-0.5">
                  First line is shown on the card · Everything after line break appears here
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(expandedEditText);
                    setSubtaskCopied(true);
                    setTimeout(() => setSubtaskCopied(false), 2000);
                  }}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Copy whole text to clipboard"
                >
                  {subtaskCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                      <span className="text-[11px] text-emerald-600 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-[11px] hidden sm:inline">Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setExpandedSubtask(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: Broad, spacious multi-line editor */}
            <div className="flex-1">
              <textarea
                rows={10}
                autoFocus
                value={expandedEditText}
                onChange={(e) => setExpandedEditText(e.target.value)}
                placeholder="Line 1: Capsule title (shown on the main card)&#10;&#10;Line 2+: Extended notes, ideas, or details (visible when opened)..."
                className="w-full p-4 text-sm bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:border-zinc-900 focus:outline-none resize-y leading-relaxed text-zinc-900 min-h-[220px]"
              />
            </div>

            {/* Footer */}
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
                  className="px-4 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg cursor-pointer shadow-xs hover:bg-zinc-800"
                >
                  Save
                </button>
              </div>
            </div>
            </div>
          </ResizablePopupWrapper>
        </div>
      )}
    </div>
  );
};
