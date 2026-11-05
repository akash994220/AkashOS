import { collection, query, where, getDocs, doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface BackupManifest {
  version: string;
  export_format: string;
  app_name: string;
  exported_at: string;
  exported_by_uid: string;
  exported_by_email?: string | null;
  total_records: number;
  counts: Record<string, number>;
}

export interface BackupDataPayload {
  manifest: BackupManifest;
  collections: Record<string, any[]>;
  user_settings?: Record<string, any> | null;
  local_preferences?: Record<string, any>;
}

export const BACKUP_COLLECTIONS = [
  { id: 'idea_notes', label: 'Ideas & Notes', icon: 'FileText' },
  { id: 'idea_folders', label: 'Note Folders', icon: 'Folder' },
  { id: 'work_threads', label: 'Work Threads & Logs', icon: 'GitBranch' },
  { id: 'daily_tasks', label: 'Daily Tasks', icon: 'ListTodo' },
  { id: 'daily_task_sessions', label: 'Task Focus Sessions', icon: 'Clock' },
  { id: 'content_items', label: 'Content Pipeline Items', icon: 'Clapperboard' },
  { id: 'content_categories', label: 'Content Categories', icon: 'Folder' },
  { id: 'content_youtube', label: 'YouTube Content', icon: 'Video' },
  { id: 'content_tiktok', label: 'TikTok Content', icon: 'Smartphone' },
  { id: 'content_facebook', label: 'Facebook Content', icon: 'Share2' },
  { id: 'content_instagram', label: 'Instagram Content', icon: 'Share2' },
  { id: 'financial_entries', label: 'Financial Transactions', icon: 'Wallet' },
  { id: 'budgets', label: 'Monthly Budgets', icon: 'PiggyBank' },
  { id: 'savings_goals', label: 'Savings Goals', icon: 'Target' },
  { id: 'financial_calculations', label: 'Saved Financial Calculations', icon: 'Calculator' },
  { id: 'vault_folders', label: 'Vault Folders', icon: 'Folder' },
  { id: 'vault_credentials', label: 'Vault Logins & Passwords', icon: 'Key' },
  { id: 'vault_bank_cards', label: 'Vault Cards', icon: 'CreditCard' },
  { id: 'vault_custom', label: 'Vault Custom Secure Items', icon: 'Shield' },
] as const;

export type BackupCollectionId = typeof BACKUP_COLLECTIONS[number]['id'];

/**
 * Exports all user data across all Firestore collections and settings into a single comprehensive JSON payload.
 */
export async function exportAllUserData(
  uid: string,
  userEmail?: string | null,
  onProgress?: (msg: string, percent: number) => void
): Promise<BackupDataPayload> {
  const resultCollections: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  let totalRecords = 0;

  const totalSteps = BACKUP_COLLECTIONS.length + 1; // +1 for user_settings

  for (let i = 0; i < BACKUP_COLLECTIONS.length; i++) {
    const colConfig = BACKUP_COLLECTIONS[i];
    const colName = colConfig.id;

    if (onProgress) {
      const pct = Math.round((i / totalSteps) * 90);
      onProgress(`Exporting ${colConfig.label}...`, pct);
    }

    try {
      const q = query(collection(db, colName), where('owner_uid', '==', uid));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({
        _id: d.id,
        ...d.data(),
      }));

      resultCollections[colName] = docs;
      counts[colName] = docs.length;
      totalRecords += docs.length;
    } catch (err) {
      console.warn(`Warning: Could not fetch collection ${colName}:`, err);
      resultCollections[colName] = [];
      counts[colName] = 0;
    }
  }

  // Fetch user_settings
  let userSettingsData: Record<string, any> | null = null;
  try {
    if (onProgress) {
      onProgress('Exporting user settings and preferences...', 95);
    }
    const settingsSnap = await getDoc(doc(db, 'user_settings', uid));
    if (settingsSnap.exists()) {
      userSettingsData = settingsSnap.data();
    }
  } catch (err) {
    console.warn('Could not export user_settings:', err);
  }

  // Gather local preferences
  const localPreferences: Record<string, any> = {
    app_theme_id: localStorage.getItem('app_theme_id'),
    app_glass_transparency: localStorage.getItem('app_glass_transparency'),
    glassmorphism_v1_active: localStorage.getItem('glassmorphism_v1_active'),
  };

  const manifest: BackupManifest = {
    version: '1.0.0',
    export_format: 'omnihub_full_backup',
    app_name: 'AkashOS Workspace',
    exported_at: new Date().toISOString(),
    exported_by_uid: uid,
    exported_by_email: userEmail || null,
    total_records: totalRecords,
    counts,
  };

  if (onProgress) {
    onProgress('Backup package ready!', 100);
  }

  return {
    manifest,
    collections: resultCollections,
    user_settings: userSettingsData,
    local_preferences: localPreferences,
  };
}

/**
 * Triggers a browser download of the JSON backup.
 */
export function triggerJsonDownload(payload: BackupDataPayload, filenamePrefix = 'omnihub-full-backup') {
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${filenamePrefix}-${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a human-readable Markdown summary of all notes, tasks, and work threads.
 */
export function triggerMarkdownNotesDownload(payload: BackupDataPayload) {
  const notes = payload.collections.idea_notes || [];
  const threads = payload.collections.work_threads || [];
  const tasks = payload.collections.daily_tasks || [];
  const finance = payload.collections.financial_entries || [];

  let md = `# Workspace Data Backup Export\n\n`;
  md += `> Exported at: ${payload.manifest.exported_at}\n`;
  md += `> Account: ${payload.manifest.exported_by_email || payload.manifest.exported_by_uid}\n`;
  md += `> Total Records: ${payload.manifest.total_records}\n\n`;
  md += `---\n\n`;

  // Section 1: Notes
  md += `## 📝 Ideas & Notes (${notes.length})\n\n`;
  if (notes.length === 0) {
    md += `*No notes recorded.*\n\n`;
  } else {
    notes.forEach((note: any, idx: number) => {
      md += `### ${idx + 1}. ${note.title || 'Untitled Note'}\n`;
      md += `**Created**: ${note.created_at || 'Unknown'} | **Updated**: ${note.updated_at || 'Unknown'}\n`;
      if (note.tags && note.tags.length > 0) {
        md += `**Tags**: ${note.tags.join(', ')}\n`;
      }
      md += `\n${note.body || '*No content*'}\n\n---\n\n`;
    });
  }

  // Section 2: Work Threads
  md += `## 🧵 Work Threads (${threads.length})\n\n`;
  if (threads.length === 0) {
    md += `*No work threads recorded.*\n\n`;
  } else {
    threads.forEach((t: any, idx: number) => {
      md += `### ${idx + 1}. ${t.title || 'Untitled Thread'} [${(t.status || 'open').toUpperCase()}]\n`;
      md += `**Priority**: ${t.priority || 'medium'} | **Created**: ${t.created_at || 'Unknown'}\n\n`;
      if (t.notes) {
        md += `**Overview**:\n${t.notes}\n\n`;
      }
      if (t.updates && Array.isArray(t.updates) && t.updates.length > 0) {
        md += `**Activity Log**:\n`;
        t.updates.forEach((u: any) => {
          md += `- *${u.timestamp || ''}*: ${u.content || u.note || JSON.stringify(u)}\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });
  }

  // Section 3: Daily Tasks
  md += `## ⚡ Daily Tasks (${tasks.length})\n\n`;
  if (tasks.length === 0) {
    md += `*No tasks recorded.*\n\n`;
  } else {
    tasks.forEach((task: any, idx: number) => {
      const check = task.status === 'done' || task.status === 'completed' ? '[x]' : '[ ]';
      md += `- ${check} **${task.title || 'Task'}** (${task.category || 'general'} | Priority: ${task.priority || 'medium'})\n`;
      if (task.notes) {
        md += `  > Note: ${task.notes}\n`;
      }
      if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
        task.subtasks.forEach((st: any) => {
          const sCheck = st.completed ? '[x]' : '[ ]';
          md += `  - ${sCheck} ${st.title}\n`;
        });
      }
    });
    md += `\n---\n\n`;
  }

  // Section 4: Financial Summary
  md += `## 💰 Financial Transactions (${finance.length})\n\n`;
  if (finance.length > 0) {
    let totalIncome = 0;
    let totalExpense = 0;
    finance.forEach((f: any) => {
      const amt = Number(f.amount) || 0;
      if (f.type === 'income') totalIncome += amt;
      if (f.type === 'expense') totalExpense += amt;
    });
    md += `- Total Income Logged: **${totalIncome.toLocaleString()} BDT**\n`;
    md += `- Total Expenses Logged: **${totalExpense.toLocaleString()} BDT**\n`;
    md += `- Net Balance: **${(totalIncome - totalExpense).toLocaleString()} BDT**\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 10);
  const filename = `omnihub-readable-summary-${dateStr}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates a parsed JSON backup payload and returns errors or an inspection summary.
 */
export function validateBackupFile(data: any): {
  valid: boolean;
  error?: string;
  manifest?: BackupManifest;
  collections?: Record<string, any[]>;
  counts?: Record<string, number>;
  totalRecords?: number;
} {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'The uploaded file is not a valid JSON document.' };
  }

  // Check if collections exists or manifest exists
  const hasCollections = Boolean(data.collections && typeof data.collections === 'object');
  const hasManifest = Boolean(data.manifest && typeof data.manifest === 'object');

  if (!hasCollections && !hasManifest) {
    return {
      valid: false,
      error: 'Invalid backup file structure: missing collections or manifest data.',
    };
  }

  const collections = data.collections || {};
  const counts: Record<string, number> = {};
  let calculatedTotal = 0;

  for (const col of BACKUP_COLLECTIONS) {
    const list = Array.isArray(collections[col.id]) ? collections[col.id] : [];
    counts[col.id] = list.length;
    calculatedTotal += list.length;
  }

  const manifest: BackupManifest = data.manifest || {
    version: '1.0.0',
    export_format: 'omnihub_full_backup',
    app_name: 'AkashOS Workspace',
    exported_at: 'Unknown Date',
    exported_by_uid: 'Unknown',
    exported_by_email: null,
    total_records: calculatedTotal,
    counts,
  };

  return {
    valid: true,
    manifest,
    collections,
    counts,
    totalRecords: calculatedTotal,
  };
}

/**
 * Restores data from a backup into Firestore for the target user.
 * Rebinds owner_uid to targetUid, preserving document IDs, timestamps, and relationships.
 */
export async function restoreUserData(
  targetUid: string,
  backupData: BackupDataPayload,
  options: {
    restoreSettings?: boolean;
    restorePreferences?: boolean;
    onProgress?: (step: string, percent: number, currentItem: number, totalItems: number) => void;
  } = {}
): Promise<{ success: boolean; totalRestored: number; counts: Record<string, number>; error?: string }> {
  const collections = backupData.collections || {};
  const counts: Record<string, number> = {};
  let totalRestored = 0;

  // Calculate total items to write
  let totalDocsToRestore = 0;
  for (const col of BACKUP_COLLECTIONS) {
    const list = Array.isArray(collections[col.id]) ? collections[col.id] : [];
    totalDocsToRestore += list.length;
  }
  if (options.restoreSettings && backupData.user_settings) {
    totalDocsToRestore += 1;
  }

  let processedCount = 0;

  // Maximum operations per Firestore batch is 500. We use 250 for high safety margin.
  const BATCH_CHUNK_SIZE = 250;

  for (const colConfig of BACKUP_COLLECTIONS) {
    const colName = colConfig.id;
    const items = Array.isArray(collections[colName]) ? collections[colName] : [];
    if (items.length === 0) {
      counts[colName] = 0;
      continue;
    }

    if (options.onProgress) {
      const pct = totalDocsToRestore > 0 ? Math.round((processedCount / totalDocsToRestore) * 100) : 0;
      options.onProgress(`Restoring ${colConfig.label}...`, pct, processedCount, totalDocsToRestore);
    }

    let restoredForCol = 0;

    // Process items in chunks
    for (let i = 0; i < items.length; i += BATCH_CHUNK_SIZE) {
      const chunk = items.slice(i, i + BATCH_CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const rawItem of chunk) {
        // Clone item so we don't mutate input
        const item = { ...rawItem };
        const docId = item._id || item.id || doc(collection(db, colName)).id;
        delete item._id; // Remove the temporary _id property

        // Always rebind to target user UID so security rules permit write & owner reading
        item.owner_uid = targetUid;

        const docRef = doc(db, colName, docId);
        batch.set(docRef, item, { merge: true });
        restoredForCol++;
        processedCount++;
      }

      await batch.commit();

      if (options.onProgress) {
        const pct = totalDocsToRestore > 0 ? Math.round((processedCount / totalDocsToRestore) * 100) : 0;
        options.onProgress(`Restored ${processedCount} of ${totalDocsToRestore} items...`, pct, processedCount, totalDocsToRestore);
      }
    }

    counts[colName] = restoredForCol;
    totalRestored += restoredForCol;
  }

  // Restore user_settings if requested
  if (options.restoreSettings && backupData.user_settings) {
    try {
      if (options.onProgress) {
        options.onProgress('Restoring personal user settings and vault keys...', 98, processedCount, totalDocsToRestore);
      }
      const settingsRef = doc(db, 'user_settings', targetUid);
      const cleanSettings = { ...backupData.user_settings };
      cleanSettings.owner_uid = targetUid;
      await setDoc(settingsRef, cleanSettings, { merge: true });
      processedCount++;
    } catch (err) {
      console.warn('Could not restore user_settings:', err);
    }
  }

  // Restore local preferences (theme, glass transparency)
  if (options.restorePreferences && backupData.local_preferences) {
    try {
      const prefs = backupData.local_preferences;
      if (prefs.app_theme_id) {
        localStorage.setItem('app_theme_id', prefs.app_theme_id);
      }
      if (prefs.app_glass_transparency) {
        localStorage.setItem('app_glass_transparency', String(prefs.app_glass_transparency));
      }
      if (prefs.glassmorphism_v1_active) {
        localStorage.setItem('glassmorphism_v1_active', prefs.glassmorphism_v1_active);
      }
    } catch (e) {
      console.warn('Could not restore local preferences:', e);
    }
  }

  if (options.onProgress) {
    options.onProgress('All data successfully restored and synced!', 100, totalDocsToRestore, totalDocsToRestore);
  }

  return {
    success: true,
    totalRestored,
    counts,
  };
}
