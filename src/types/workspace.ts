export type WorkspaceSection =
  | 'hub'
  | 'daily_tasks'
  | 'work_threads'
  | 'ideas_notes'
  | 'content'
  | 'financial'
  | 'vault';

export interface TaskSubtask {
  subtask_id: string;
  title: string;
  created_at: string;
  is_running: boolean;
  timer_started_at: string | null;
  accumulated_minutes: number;
  is_done: boolean;
  color?: string;
  show_timestamp?: boolean;
}

export interface DailyTask {
  id?: string;
  task_id: string;
  owner_uid: string;
  title: string;
  subtitle: string;
  notes: string;
  created_at: string;
  last_completed_at: string | null;
  all_time_total_minutes?: number;
  subtasks?: TaskSubtask[];
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
}

export interface DailyTaskSession {
  id?: string;
  session_id: string;
  task_id: string;
  owner_uid: string;
  date: string; // 'YYYY-MM-DD'
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export type CapsuleCategory = 'update' | 'idea' | 'note';

export interface ThreadCapsule {
  id: string;
  category: CapsuleCategory;
  title?: string;
  body: string;
  color?: string;
  created_at: string;
  updated_at?: string;
  tags?: string[];
}

export interface ThreadNote {
  note_id: string;
  title?: string;
  text: string;
  created_at: string;
  updated_at?: string;
  color?: string;
  cmyk_color?: string;
  category?: CapsuleCategory;
}

export interface ThreadTask {
  task_id: string;
  title: string;
  created_at: string;
  is_done: boolean;
  is_running?: boolean;
  timer_started_at?: string | null;
  total_minutes?: number;
  // Date-separated time logs: key is 'YYYY-MM-DD', value is minutes spent on that date
  date_logs?: Record<string, number>;
}

export type WorkThreadStatus = 'in_progress' | 'done' | 'paused' | 'active' | 'archived' | 'completed';

export interface WorkThread {
  id?: string;
  thread_id: string;
  owner_uid: string;
  title?: string;
  sites_or_apps?: string[];
  accounts_used?: string[];
  notes_list?: ThreadNote[];
  capsules?: ThreadCapsule[];
  link_url?: string;
  // Sub-tasks / sub-threads with time-lapse & date-separated tracking
  tasks?: ThreadTask[];
  total_thread_minutes?: number;
  // Legacy fields for backward compatibility
  site_or_app_name?: string;
  account_used?: string;
  status?: WorkThreadStatus;
  notes?: string;
  left_off_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaFolder {
  id?: string;
  folder_id: string;
  owner_uid: string;
  folder_name: string;
  parent_folder_id: string | null;
  created_at: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface IdeaNote {
  id?: string;
  note_id: string;
  owner_uid: string;
  folder_id: string | null;
  title?: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
}
