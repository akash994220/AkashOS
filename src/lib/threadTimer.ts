import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { WorkThread, ThreadTask, DailyTask } from '../types/workspace';
import { stopAllRunningSubtaskTimers } from './subtasks';

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in local time
 */
export const getTodayDateStr = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Format total minutes into human-readable string: e.g. "1h 45m", "45m", "0m"
 */
export const formatDuration = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

/**
 * Format seconds into digital stopwatch format: "mm:ss" or "h:mm:ss"
 */
export const formatLiveSeconds = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

/**
 * Format any ISO timestamp or Date string with Month, Date, Hour, and Minute
 * Example: "Today, 2:30 PM", "Yesterday, 10:15 AM", "Oct 15, 4:45 PM", "Nov 12, 2025, 11:20 AM"
 */
export const formatDateTimeWithHM = (isoString?: string | null): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: isSameYear ? undefined : 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
};

/**
 * Friendly label for date string: "Today (Sep 27)", "Yesterday (Sep 26)", or "Sep 24, 2026"
 */
export const formatDateLabel = (dateStr: string): string => {
  const today = getTodayDateStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getTodayDateStr(yesterday);

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formatted = dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  if (dateStr === today) return `Today (${formatted})`;
  if (dateStr === yesterdayStr) return `Yesterday (${formatted})`;
  return formatted;
};

/**
 * Computes live elapsed minutes currently running for a task
 */
export const getTaskRunningElapsedMinutes = (task: ThreadTask, now = Date.now()): number => {
  if (!task.is_running || !task.timer_started_at) return 0;
  const startTime = new Date(task.timer_started_at).getTime();
  if (isNaN(startTime)) return 0;
  return Math.max(0, (now - startTime) / 60000);
};

/**
 * Computes total minutes for a task, summing date_logs + live session elapsed
 */
export const computeTaskTotalMinutes = (task: ThreadTask, now = Date.now()): number => {
  const logs = task.date_logs || {};
  let baseSum = Object.values(logs).reduce((a, b) => a + (Number(b) || 0), 0);
  // Add running session
  baseSum += getTaskRunningElapsedMinutes(task, now);
  return Math.round(baseSum * 10) / 10;
};

/**
 * Computes minutes spent on a specific date for a task, including running session if today
 */
export const computeTaskDateMinutes = (task: ThreadTask, date: string, now = Date.now()): number => {
  const logs = task.date_logs || {};
  let minutes = Number(logs[date]) || 0;
  if (task.is_running && task.timer_started_at) {
    const today = getTodayDateStr();
    if (date === today) {
      minutes += getTaskRunningElapsedMinutes(task, now);
    }
  }
  return Math.round(minutes * 10) / 10;
};

/**
 * Computes total cumulative minutes for an entire thread across all its tasks
 */
export const computeThreadTotalMinutes = (thread: WorkThread, now = Date.now()): number => {
  const tasks = thread.tasks || [];
  return tasks.reduce((sum, t) => sum + computeTaskTotalMinutes(t, now), 0);
};

/**
 * Computes date-separated rollup of total minutes spent across ALL tasks in a thread
 * Returns object: { '2026-09-27': 105, '2026-09-26': 130 }
 */
export const computeThreadDateRollup = (
  thread: WorkThread,
  now = Date.now()
): Record<string, number> => {
  const rollup: Record<string, number> = {};
  const tasks = thread.tasks || [];

  tasks.forEach((t) => {
    const logs = t.date_logs || {};
    Object.entries(logs).forEach(([date, min]) => {
      rollup[date] = (rollup[date] || 0) + (Number(min) || 0);
    });

    if (t.is_running && t.timer_started_at) {
      const today = getTodayDateStr();
      rollup[today] = (rollup[today] || 0) + getTaskRunningElapsedMinutes(t, now);
    }
  });

  return rollup;
};

/**
 * Gets live ticking display for a thread task: "mm:ss" if running, or "1h 24m" if stopped
 */
export const getThreadTaskDisplayTime = (task: ThreadTask, now = Date.now()): string => {
  if (task.is_running && task.timer_started_at) {
    const startTime = new Date(task.timer_started_at).getTime();
    const elapsedSec = !isNaN(startTime) ? Math.max(0, Math.floor((now - startTime) / 1000)) : 0;
    const baseSec = Math.round((task.total_minutes || 0) * 60);
    return formatLiveSeconds(baseSec + elapsedSec);
  }
  return formatDuration(computeTaskTotalMinutes(task, now));
};

/**
 * Stop any running thread task timer across all threads
 */
export const stopAllRunningThreadTimers = async (
  allThreads: WorkThread[],
  excludeTaskId?: string
): Promise<void> => {
  const now = Date.now();
  for (const thread of allThreads) {
    const tasks = thread.tasks || [];
    let changed = false;

    const updatedTasks = tasks.map((t) => {
      if (t.is_running && t.task_id !== excludeTaskId) {
        changed = true;
        let additionalMin = 0;
        const startDateStr = t.timer_started_at ? t.timer_started_at.slice(0, 10) : getTodayDateStr();
        const todayStr = getTodayDateStr();

        if (t.timer_started_at) {
          const startTime = new Date(t.timer_started_at).getTime();
          if (!isNaN(startTime)) {
            additionalMin = Math.max(0, (now - startTime) / 60000);
          }
        }

        const dateLogs = { ...(t.date_logs || {}) };
        // Attribute to today (or split if spanning)
        dateLogs[todayStr] = Math.round(((dateLogs[todayStr] || 0) + additionalMin) * 10) / 10;
        const newTotal = Object.values(dateLogs).reduce((a, b) => a + (Number(b) || 0), 0);

        return {
          ...t,
          is_running: false,
          timer_started_at: null,
          total_minutes: Math.round(newTotal * 10) / 10,
          date_logs: dateLogs,
        };
      }
      return t;
    });

    if (changed) {
      try {
        const threadDocId = thread.id || thread.thread_id;
        const totalThreadMin = updatedTasks.reduce((s, tk) => s + (tk.total_minutes || 0), 0);
        await updateDoc(doc(db, 'work_threads', threadDocId), {
          tasks: updatedTasks,
          total_thread_minutes: totalThreadMin,
        });
      } catch (err) {
        console.error('Error stopping running thread timer for thread:', thread.thread_id, err);
      }
    }
  }
};

/**
 * Thread timer tracking & task management utilities
 */

/**
 * Adds a new task to a thread
 */
export const addThreadTask = async (
  threadId: string,
  title: string,
  existingTasks: ThreadTask[] = []
): Promise<void> => {
  if (!title.trim()) return;

  const newTask: ThreadTask = {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    created_at: new Date().toISOString(),
    is_done: false,
    is_running: false,
    timer_started_at: null,
    total_minutes: 0,
    date_logs: {},
  };

  // Newest subtask is always at the top
  const updatedTasks = [newTask, ...existingTasks];
  await updateDoc(doc(db, 'work_threads', threadId), {
    tasks: updatedTasks,
  });
};

/**
 * Deletes a task from a thread
 */
export const deleteThreadTask = async (
  threadId: string,
  taskId: string,
  existingTasks: ThreadTask[] = []
): Promise<void> => {
  const updatedTasks = existingTasks.filter((t) => t.task_id !== taskId);
  const totalThreadMin = updatedTasks.reduce((s, tk) => s + (tk.total_minutes || 0), 0);

  await updateDoc(doc(db, 'work_threads', threadId), {
    tasks: updatedTasks,
    total_thread_minutes: totalThreadMin,
  });
};

/**
 * Toggle task done / undone status. If running, auto-stops first.
 */
export const toggleThreadTaskDone = async (
  threadId: string,
  taskId: string,
  existingTasks: ThreadTask[] = []
): Promise<void> => {
  const target = existingTasks.find((t) => t.task_id === taskId);
  if (!target) return;

  const nextDone = !target.is_done;
  const now = Date.now();
  const todayStr = getTodayDateStr();

  const updatedTasks = existingTasks.map((t) => {
    if (t.task_id === taskId) {
      let dateLogs = { ...(t.date_logs || {}) };
      let newTotal = t.total_minutes || 0;

      if (t.is_running && t.timer_started_at) {
        const startTime = new Date(t.timer_started_at).getTime();
        const additionalMin = !isNaN(startTime) ? Math.max(0, (now - startTime) / 60000) : 0;
        dateLogs[todayStr] = Math.round(((dateLogs[todayStr] || 0) + additionalMin) * 10) / 10;
        newTotal = Object.values(dateLogs).reduce((a, b) => a + (Number(b) || 0), 0);
      }

      return {
        ...t,
        is_done: nextDone,
        is_running: false,
        timer_started_at: null,
        date_logs: dateLogs,
        total_minutes: Math.round(newTotal * 10) / 10,
      };
    }
    return t;
  });

  const totalThreadMin = updatedTasks.reduce((s, tk) => s + (tk.total_minutes || 0), 0);

  await updateDoc(doc(db, 'work_threads', threadId), {
    tasks: updatedTasks,
    total_thread_minutes: totalThreadMin,
  });
};

/**
 * Manually logs or adjusts minutes for a specific task and date.
 * If minutes <= 0, deletes the date log.
 */
export const adjustThreadTaskDateLog = async (
  threadDocId: string,
  taskId: string,
  dateStr: string,
  minutes: number,
  allThreads: WorkThread[]
): Promise<void> => {
  const targetThread = allThreads.find((t) => (t.id || t.thread_id) === threadDocId || t.thread_id === threadDocId);
  if (!targetThread) return;

  const tasks = targetThread.tasks || [];
  const targetTask = tasks.find((tk) => tk.task_id === taskId);
  if (!targetTask) return;

  const dateLogs = { ...(targetTask.date_logs || {}) };
  if (minutes <= 0) {
    delete dateLogs[dateStr];
  } else {
    dateLogs[dateStr] = Math.round(minutes * 10) / 10;
  }

  const newTotal = Object.values(dateLogs).reduce((a, b) => a + (Number(b) || 0), 0);

  const updatedTasks = tasks.map((tk) =>
    tk.task_id === taskId
      ? {
          ...tk,
          date_logs: dateLogs,
          total_minutes: Math.round(newTotal * 10) / 10,
        }
      : tk
  );

  const totalThreadMin = updatedTasks.reduce((s, tk) => s + (tk.total_minutes || 0), 0);

  await updateDoc(doc(db, 'work_threads', threadDocId), {
    tasks: updatedTasks,
    total_thread_minutes: totalThreadMin,
  });
};
