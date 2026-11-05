import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DailyTask, TaskSubtask } from '../types/workspace';

/**
 * Format minutes into a clean readable string like "1h 24m", "45m", or "0m"
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
 * Format live ticking time as mm:ss or hh:mm:ss
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
 * Computes live total minutes for a task.
 * If task has subtasks: sums accumulated_minutes + elapsed time of any running subtask.
 * Else: returns stored all_time_total_minutes.
 */
export const computeTaskTotalMinutes = (task: DailyTask, now: number = Date.now()): number => {
  if (task.subtasks && task.subtasks.length > 0) {
    return task.subtasks.reduce((sum, sub) => {
      let subMin = Number(sub.accumulated_minutes) || 0;
      if (sub.is_running && sub.timer_started_at) {
        const startTime = new Date(sub.timer_started_at).getTime();
        if (!isNaN(startTime)) {
          const elapsedMin = Math.max(0, (now - startTime) / 60000);
          subMin += elapsedMin;
        }
      }
      return sum + subMin;
    }, 0);
  }
  return task.all_time_total_minutes || 0;
};

/**
 * Get subtask display time:
 * If running: live-ticking mm:ss (sum of accumulated + current elapsed session)
 * If stopped: static accumulated time (e.g. 1h 24m or 15m)
 */
export const getSubtaskDisplayTime = (subtask: TaskSubtask, now: number = Date.now()): string => {
  if (subtask.is_running && subtask.timer_started_at) {
    const startTime = new Date(subtask.timer_started_at).getTime();
    const elapsedSec = !isNaN(startTime) ? Math.max(0, Math.floor((now - startTime) / 1000)) : 0;
    const accumulatedSec = Math.round((subtask.accumulated_minutes || 0) * 60);
    return formatLiveSeconds(accumulatedSec + elapsedSec);
  }
  return formatDuration(subtask.accumulated_minutes || 0);
};

/**
 * Stop any active subtask timer across all tasks.
 * Updates accumulated_minutes, clears timer_started_at, sets is_running: false.
 */
export const stopAllRunningSubtaskTimers = async (
  allTasks: DailyTask[],
  excludeSubtaskId?: string
): Promise<void> => {
  const now = Date.now();
  for (const task of allTasks) {
    if (!task.subtasks || task.subtasks.length === 0) continue;
    let taskChanged = false;
    const updatedSubtasks = task.subtasks.map((sub) => {
      if (sub.is_running && sub.subtask_id !== excludeSubtaskId) {
        taskChanged = true;
        let additionalMin = 0;
        if (sub.timer_started_at) {
          const startTime = new Date(sub.timer_started_at).getTime();
          if (!isNaN(startTime)) {
            additionalMin = Math.max(0, (now - startTime) / 60000);
          }
        }
        const newAccum = Math.round(((sub.accumulated_minutes || 0) + additionalMin) * 100) / 100;
        return {
          ...sub,
          is_running: false,
          timer_started_at: null,
          accumulated_minutes: newAccum,
        };
      }
      return sub;
    });

    if (taskChanged) {
      try {
        await updateDoc(doc(db, 'daily_tasks', task.task_id), {
          subtasks: updatedSubtasks,
        });
      } catch (err) {
        console.error('Error stopping running subtask timer for task:', task.task_id, err);
      }
    }
  }
};

/**
 * Toggle a subtask timer.
 * Global timer rule: only one subtask timer can run at a time across the whole app.
 * Starting a new one auto-stops whichever was previously running.
 */
export const toggleSubtaskTimerRemote = async (
  taskId: string,
  subtaskId: string,
  allTasks: DailyTask[]
): Promise<void> => {
  const targetTask = allTasks.find((t) => t.task_id === taskId);
  if (!targetTask || !targetTask.subtasks) return;

  const targetSubtask = targetTask.subtasks.find((s) => s.subtask_id === subtaskId);
  if (!targetSubtask) return;

  const isCurrentlyRunning = Boolean(targetSubtask.is_running);
  const now = Date.now();

  if (isCurrentlyRunning) {
    // Stop this subtask
    let additionalMin = 0;
    if (targetSubtask.timer_started_at) {
      const startTime = new Date(targetSubtask.timer_started_at).getTime();
      if (!isNaN(startTime)) {
        additionalMin = Math.max(0, (now - startTime) / 60000);
      }
    }
    const newAccum = Math.round(((targetSubtask.accumulated_minutes || 0) + additionalMin) * 100) / 100;
    const updatedSubtasks = targetTask.subtasks.map((s) =>
      s.subtask_id === subtaskId
        ? {
            ...s,
            is_running: false,
            timer_started_at: null,
            accumulated_minutes: newAccum,
          }
        : s
    );

    await updateDoc(doc(db, 'daily_tasks', taskId), {
      subtasks: updatedSubtasks,
    });
  } else {
    // Auto-stop any other running subtask first
    await stopAllRunningSubtaskTimers(allTasks, subtaskId);

    // Stop any legacy top-level task timer stored in localStorage
    try {
      localStorage.removeItem('daily_task_active_timer');
    } catch {}

    // Start this subtask
    const updatedSubtasks = targetTask.subtasks.map((s) =>
      s.subtask_id === subtaskId
        ? {
            ...s,
            is_running: true,
            timer_started_at: new Date(now).toISOString(),
          }
        : {
            ...s,
            is_running: false,
            timer_started_at: null,
          }
    );

    await updateDoc(doc(db, 'daily_tasks', taskId), {
      subtasks: updatedSubtasks,
    });
  }
};
