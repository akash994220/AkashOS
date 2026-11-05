import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation } from '../../context/NavigationContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DailyTask, TaskSubtask } from '../../types/workspace';
import { getSubtaskDisplayTime, toggleSubtaskTimerRemote } from '../../lib/subtasks';
import { Pause, CheckCircle2, ChevronRight, Clock } from 'lucide-react';

export const GlobalTaskTimerBar: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { setActiveSection, setWorkspacePage } = useNavigation();

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [timerNow, setTimerNow] = useState<number>(Date.now());

  // Subscribe to user daily tasks
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qTasks,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
        setTasks(list);
      },
      (err) => {
        console.error('Error in GlobalTaskTimerBar tasks subscription:', err);
      }
    );
    return () => unsub();
  }, [user]);

  // Find any running subtask
  let runningTask: DailyTask | null = null;
  let runningSubtask: TaskSubtask | null = null;

  for (const t of tasks) {
    if (t.subtasks && t.subtasks.length > 0) {
      const active = t.subtasks.find((s) => s.is_running);
      if (active) {
        runningTask = t;
        runningSubtask = active;
        break;
      }
    }
  }

  // Live timer tick every 1000ms while a subtask is running
  useEffect(() => {
    if (!runningSubtask) return;
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [Boolean(runningSubtask)]);

  if (!runningTask || !runningSubtask) {
    return null;
  }

  const liveTime = getSubtaskDisplayTime(runningSubtask, timerNow);

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!runningTask || !runningSubtask) return;
    try {
      await toggleSubtaskTimerRemote(runningTask.task_id, runningSubtask.subtask_id, tasks);
    } catch (err) {
      console.error('Failed to pause running subtask timer:', err);
    }
  };

  const handleBarClick = () => {
    setActiveSection('workspace');
    setWorkspacePage('daily_tasks');
  };

  return (
    <div
      role="region"
      aria-label="Active Subtask Focus Timer"
      className="fixed z-40 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 pointer-events-auto"
      style={{
        bottom: 'calc(max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px)) + 74px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '360px',
      }}
    >
      <div
        onClick={handleBarClick}
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.full,
          boxShadow: theme.shadows.lg,
        }}
        className="flex items-center justify-between gap-2.5 px-3.5 py-2 border backdrop-blur-2xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg group select-none"
      >
        {/* Left: Pulsing Status Dot + Subtask & Task Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-rose-500 relative" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span
                style={{ color: theme.colors.textPrimary }}
                className="text-xs font-bold truncate tracking-tight"
              >
                {runningSubtask.title}
              </span>
            </div>
            <span
              style={{ color: theme.colors.textMuted }}
              className="text-[10px] truncate block leading-tight"
            >
              {runningTask.title}
            </span>
          </div>
        </div>

        {/* Right: Live Ticking Time + Pause Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.full,
            }}
            className="flex items-center gap-1 px-2.5 py-0.5"
          >
            <Clock className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="text-xs font-poppins tabular-nums font-bold text-zinc-900 tracking-tight">
              {liveTime}
            </span>
          </div>

          {/* Pause Button */}
          <button
            type="button"
            id="pause-global-subtask-timer"
            onClick={handlePause}
            title="Pause subtask timer"
            aria-label="Pause subtask timer"
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.full,
              minWidth: '32px',
              minHeight: '32px',
            }}
            className="w-8 h-8 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shrink-0 shadow-xs"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
