import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { 
  exportAllUserData, 
  triggerJsonDownload, 
  triggerMarkdownNotesDownload, 
  validateBackupFile, 
  restoreUserData,
  BACKUP_COLLECTIONS,
  BackupDataPayload
} from '../../lib/backupService';
import {
  Download,
  Upload,
  Database,
  FileCheck2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  HardDrive,
  Shield,
  Layers,
  Sparkles,
  Info,
  Check,
  ChevronRight
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import';
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export',
}) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; percent: number }>({
    message: '',
    percent: 0,
  });
  const [lastExportPayload, setLastExportPayload] = useState<BackupDataPayload | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Import State
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupDataPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreSettings, setRestoreSettings] = useState(true);
  const [restorePreferences, setRestorePreferences] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{
    step: string;
    percent: number;
    current: number;
    total: number;
  }>({
    step: '',
    percent: 0,
    current: 0,
    total: 0,
  });
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    totalRestored: number;
    counts: Record<string, number>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExportSuccessMessage(null);
      setRestoreResult(null);
      setParseError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Handle Export Action
  const handleExport = async (format: 'json' | 'markdown' | 'both' = 'json') => {
    if (!user) return;
    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      const payload = await exportAllUserData(user.uid, user.email, (msg, pct) => {
        setExportProgress({ message: msg, percent: pct });
      });

      setLastExportPayload(payload);

      if (format === 'json' || format === 'both') {
        triggerJsonDownload(payload);
      }
      if (format === 'markdown' || format === 'both') {
        triggerMarkdownNotesDownload(payload);
      }

      setExportSuccessMessage(
        `Successfully exported ${payload.manifest.total_records} total records across all workspace modules!`
      );
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err?.message || 'Unknown error occurred.'));
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setParsedBackup(null);
    setRestoreResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFile(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        const validation = validateBackupFile(json);

        if (!validation.valid) {
          setParseError(validation.error || 'Invalid backup file structure.');
          return;
        }

        setParsedBackup(json as BackupDataPayload);
      } catch (err: any) {
        setParseError('Failed to parse file: Please ensure this is a valid JSON backup file.');
      }
    };

    reader.onerror = () => {
      setParseError('Error reading uploaded file.');
    };

    reader.readAsText(file);
  };

  // Handle Restore Execution
  const handleExecuteRestore = async () => {
    if (!user || !parsedBackup) return;

    const confirmMsg =
      `Are you sure you want to restore ${parsedBackup.manifest.total_records} records into your account?\n\n` +
      `Existing items with identical IDs will be seamlessly updated, and all your notes, tasks, folders, and threads will be placed back exactly where they belong.`;

    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const result = await restoreUserData(user.uid, parsedBackup, {
        restoreSettings,
        restorePreferences,
        onProgress: (step, percent, current, total) => {
          setRestoreProgress({ step, percent, current, total });
        },
      });

      setRestoreResult(result);
    } catch (err: any) {
      console.error('Restore failed:', err);
      alert('Restore failed: ' + (err?.message || 'Unknown error occurred during write.'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.colors.bgElevated,
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadows.lg,
          border: `1px solid ${theme.colors.borderLight}`,
          fontFamily: theme.typography.fontSans,
          maxHeight: '92vh',
        }}
        className="w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div
          className="p-4 sm:p-5 flex items-center justify-between border-b"
          style={{ borderColor: theme.colors.borderLight }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textPrimary,
              }}
            >
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight" style={{ color: theme.colors.textPrimary }}>
                Full-Fidelity Universal Backup & Restore
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Export every byte of your data or import a backup to get everything right back in its place
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex border-b px-4 sm:px-6 pt-2 bg-zinc-50/50" style={{ borderColor: theme.colors.borderLight }}>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Everything</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import & Restore</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: EXPORT VIEW */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Highlight Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed space-y-1">
                  <p className="font-semibold text-blue-950">100% Complete & Portable Backup</p>
                  <p>
                    If you ever lose access to this site or want an offline copy, this export contains <strong>every single document</strong>: all your notes, custom folders, work threads, activity logs, daily tasks, focus sessions, content pipelines, financial ledgers, encrypted vault items, and custom theme settings.
                  </p>
                </div>
              </div>

              {/* Progress Indicator when Exporting */}
              {isExporting && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {exportProgress.message || 'Gathering workspace data...'}
                    </span>
                    <span>{exportProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-blue-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200 rounded-full"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Banner */}
              {exportSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{exportSuccessMessage}</span>
                  </div>
                  <button
                    onClick={() => setExportSuccessMessage(null)}
                    className="text-emerald-700 hover:text-emerald-950"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Export Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Universal JSON Option */}
                <div className="p-4 rounded-xl border border-zinc-200 hover:border-blue-300 bg-white/70 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <span>Universal JSON (.json)</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Complete machine-readable dump with original document IDs, timestamps, and nested trees. Guaranteed 100% loss-less restore.
                    </p>
                  </div>

                  <button
                    id="btn-export-json"
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleExport('json')}
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: theme.colors.accentText,
                      borderRadius: theme.radius.md,
                    }}
                    className="w-full py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export JSON Backup</span>
                  </button>
                </div>

                {/* 2. Markdown Summary Option */}
                <div className="p-4 rounded-xl border border-zinc-200 hover:border-blue-300 bg-white/70 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span>Readable Markdown (.md)</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Human-friendly summary formatted with headers, notes text, daily task checklists, and financial ledger totals for reading anywhere.
                    </p>
                  </div>

                  <button
                    id="btn-export-markdown"
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleExport('markdown')}
                    className="w-full py-2.5 px-3 text-xs font-bold rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <Download className="w-4 h-4 text-zinc-600" />
                    <span>Export Markdown Digest</span>
                  </button>
                </div>
              </div>

              {/* Collections Coverage Checklist */}
              <div className="pt-2 space-y-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Included Collections ({BACKUP_COLLECTIONS.length} Modules)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BACKUP_COLLECTIONS.map((c) => (
                    <div
                      key={c.id}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100/70 border border-zinc-200/60 text-zinc-700 text-xs flex items-center gap-2"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT & RESTORE VIEW */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* File Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed rounded-xl border-zinc-300 hover:border-blue-500 transition-colors bg-zinc-50/50 hover:bg-blue-50/20 flex flex-col items-center justify-center text-center cursor-pointer space-y-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-900 block">
                    {importedFile ? importedFile.name : 'Choose or drop your JSON backup file'}
                  </span>
                  <span className="text-xs text-zinc-500 block mt-0.5">
                    Select a previously exported .json file from this app
                  </span>
                </div>
                <input
                  id="backup-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Parse Error Display */}
              {parseError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Validation Failed</span>
                    <span>{parseError}</span>
                  </div>
                </div>
              )}

              {/* Pre-Import Inspection Summary */}
              {parsedBackup && (
                <div className="space-y-4 p-4 rounded-xl border border-blue-200 bg-blue-50/30">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <span className="text-sm font-bold text-zinc-900 block">
                          Valid Backup Verified
                        </span>
                        <span className="text-xs text-zinc-500">
                          Exported {new Date(parsedBackup.manifest.exported_at).toLocaleString()} • {parsedBackup.manifest.total_records} items found
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Ready to Restore
                    </span>
                  </div>

                  {/* Per-Collection Counts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {BACKUP_COLLECTIONS.map((col) => {
                      const count = Array.isArray(parsedBackup.collections[col.id])
                        ? parsedBackup.collections[col.id].length
                        : 0;
                      if (count === 0) return null;
                      return (
                        <div
                          key={col.id}
                          className="p-2 rounded-lg bg-white/90 border border-zinc-200/80 flex items-center justify-between shadow-2xs"
                        >
                          <span className="text-zinc-600 truncate mr-2">{col.label}</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Restore Options */}
                  <div className="pt-2 space-y-2 border-t border-blue-200/60 text-xs">
                    <label className="flex items-center gap-2 text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreSettings}
                        onChange={(e) => setRestoreSettings(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Restore personal user settings & Vault PIN credentials</span>
                    </label>

                    <label className="flex items-center gap-2 text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restorePreferences}
                        onChange={(e) => setRestorePreferences(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Restore appearance theme and glass transparency preferences</span>
                    </label>
                  </div>

                  {/* Live Progress Bar when Restoring */}
                  {isRestoring && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-800">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {restoreProgress.step || 'Writing documents to Firestore...'}
                        </span>
                        <span>{restoreProgress.percent}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-blue-200 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-150 rounded-full"
                          style={{ width: `${restoreProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Execute Button */}
                  {!isRestoring && !restoreResult && (
                    <button
                      id="btn-confirm-restore"
                      type="button"
                      onClick={handleExecuteRestore}
                      style={{
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        borderRadius: theme.radius.md,
                      }}
                      className="w-full py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Start Complete Restore ({parsedBackup.manifest.total_records} items)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Restore Result Card */}
              {restoreResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2.5 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Complete Restoration Finished Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Restored <strong>{restoreResult.totalRestored} documents</strong> across all collections. Every note, folder, task, focus session, thread, pipeline item, and vault record has been securely placed in your account.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="py-2 px-3 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reload App to Reflect All Restored Data</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 sm:p-4 border-t flex items-center justify-between bg-zinc-50"
          style={{ borderColor: theme.colors.borderLight }}
        >
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>Encrypted items remain client-side secured by your Vault PIN.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: theme.radius.md,
              borderColor: theme.colors.borderLight,
              color: theme.colors.textPrimary,
            }}
            className="px-4 py-2 text-xs font-semibold border hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
