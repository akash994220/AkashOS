import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useNavigation, WorkspaceSection } from '../../context/NavigationContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DailyTask, WorkThread, IdeaNote } from '../../types/workspace';
import { FinancialEntry } from '../../types/financial';
import {
  Search,
  X,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Wallet,
  Clapperboard,
  Briefcase,
  Settings as SettingsIcon,
  Palette,
  ArrowRight,
  Plus,
  Clock,
  Sparkles,
  Command,
  Network,
  ShieldCheck,
} from 'lucide-react';

interface GlobalOmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  category: 'Navigation' | 'Tasks' | 'Work Threads' | 'Ideas & Notes' | 'Finances' | 'Actions';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const GlobalOmniSearchModal: React.FC<GlobalOmniSearchModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { theme, availableThemes, themeId, setThemeId } = useTheme();
  const { setActiveSection, setWorkspacePage, openWorkspaceApp } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Firestore local mirrors for instant client-side search
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [notes, setNotes] = useState<IdeaNote[]>([]);
  const [finEntries, setFinEntries] = useState<FinancialEntry[]>([]);

  // Subscriptions when modal opens
  useEffect(() => {
    if (!isOpen || !user || !db) return;

    const qTasks = query(collection(db, 'daily_tasks'), where('owner_uid', '==', user.uid));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'daily_tasks'));

    const qThreads = query(collection(db, 'work_threads'), where('owner_uid', '==', user.uid));
    const unsubThreads = onSnapshot(qThreads, (snap) => {
      setThreads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkThread)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'work_threads'));

    const qNotes = query(collection(db, 'idea_notes'), where('owner_uid', '==', user.uid));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaNote)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'idea_notes'));

    const qFin = query(collection(db, 'financial_entries'), where('owner_uid', '==', user.uid));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setFinEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'financial_entries'));

    return () => {
      unsubTasks();
      unsubThreads();
      unsubNotes();
      unsubFin();
    };
  }, [isOpen, user]);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable index
  const results = useMemo<SearchResultItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    const items: SearchResultItem[] = [];

    // 1. Navigation items
    items.push(
      {
        id: 'nav-workspace',
        category: 'Navigation',
        title: 'Workspace Hub',
        subtitle: 'Tasks, threads, and knowledge base',
        icon: Briefcase,
        action: () => {
          setActiveSection('workspace');
          setWorkspacePage('hub');
          onClose();
        },
      },
      {
        id: 'nav-tasks',
        category: 'Navigation',
        title: 'Tasks',
        subtitle: 'Routines, tasks & focus timers',
        icon: CheckCircle2,
        action: () => {
          openWorkspaceApp('daily_tasks');
          onClose();
        },
      },
      {
        id: 'nav-threads',
        category: 'Navigation',
        title: 'Work Threads',
        subtitle: 'Project studios, session logs & time tracking',
        icon: GitBranch,
        action: () => {
          openWorkspaceApp('work_threads');
          onClose();
        },
      },
      {
        id: 'nav-ideas',
        category: 'Navigation',
        title: 'Ideas & Notes',
        subtitle: 'Markdown notes, folders & brainstorms',
        icon: Lightbulb,
        action: () => {
          openWorkspaceApp('ideas_notes');
          onClose();
        },
      },
      {
        id: 'nav-content',
        category: 'Navigation',
        title: 'Content Studio',
        subtitle: 'Pipeline for YouTube, TikTok, Blogs',
        icon: Clapperboard,
        action: () => {
          openWorkspaceApp('content');
          onClose();
        },
      },
      {
        id: 'nav-idea-tree',
        category: 'Navigation',
        title: 'Idea Tree & Branches',
        subtitle: 'Visual mind-map & brainstorm outliner',
        icon: Network,
        action: () => {
          openWorkspaceApp('idea_tree');
          onClose();
        },
      },
      {
        id: 'nav-finances',
        category: 'Navigation',
        title: 'Financial Hub',
        subtitle: 'Income, expenses, budgets & BDT rates',
        icon: Wallet,
        action: () => {
          openWorkspaceApp('financial');
          onClose();
        },
      },
      {
        id: 'nav-vault',
        category: 'Navigation',
        title: 'Secret Vault',
        subtitle: 'Logins, passwords, cards & custom secrets',
        icon: ShieldCheck,
        action: () => {
          openWorkspaceApp('vault');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Settings & Appearance',
        subtitle: 'Themes, wallpaper, currencies & backup',
        icon: SettingsIcon,
        action: () => {
          setActiveSection('settings');
          onClose();
        },
      }
    );

    // 2. Action commands
    const nextTheme = availableThemes[(availableThemes.findIndex((t) => t.id === themeId) + 1) % availableThemes.length];
    items.push({
      id: 'action-cycle-theme',
      category: 'Actions',
      title: `Cycle Theme → ${nextTheme?.name || 'Next Theme'}`,
      subtitle: `Currently active: ${theme.name}`,
      icon: Palette,
      action: () => {
        setThemeId(nextTheme.id);
        onClose();
      },
    });

    // 3. User Daily Tasks
    tasks.forEach((t) => {
      const isTaskDone = Boolean(t.last_completed_at?.startsWith(new Date().toISOString().split('T')[0]));
      items.push({
        id: `task-${t.task_id || t.id}`,
        category: 'Tasks',
        title: t.title,
        subtitle: isTaskDone ? 'Completed task' : 'Pending daily task',
        badge: isTaskDone ? 'Done' : 'Active',
        icon: CheckCircle2,
        action: () => {
          openWorkspaceApp('daily_tasks');
          onClose();
        },
      });
    });

    // 4. User Work Threads
    threads.forEach((th) => {
      const taskCount = th.tasks?.length || 0;
      items.push({
        id: `thread-${th.thread_id || th.id}`,
        category: 'Work Threads',
        title: th.title || 'Untitled Work Thread',
        subtitle: th.sites_or_apps?.length ? `Apps: ${th.sites_or_apps.join(', ')}` : `${taskCount} sub-tasks`,
        badge: `${taskCount} tasks`,
        icon: GitBranch,
        action: () => {
          openWorkspaceApp('work_threads');
          onClose();
        },
      });
    });

    // 5. User Ideas & Notes
    notes.forEach((n) => {
      items.push({
        id: `note-${n.note_id || n.id}`,
        category: 'Ideas & Notes',
        title: n.title || 'Untitled Note',
        subtitle: n.body ? n.body.replace(/#|\*|`|\[|\]/g, '').substring(0, 70) + '...' : 'Empty note',
        badge: n.folder_id ? 'App Space' : 'Inbox',
        icon: Lightbulb,
        action: () => {
          openWorkspaceApp('ideas_notes');
          onClose();
        },
      });
    });

    // 6. User Finances
    finEntries.slice(0, 30).forEach((f) => {
      items.push({
        id: `fin-${f.id}`,
        category: 'Finances',
        title: `${f.entry_type === 'income' ? '+' : '-'}৳${(f.amount_bdt || 0).toLocaleString()} • ${f.category}`,
        subtitle: f.notes ? `${f.notes} (${f.date})` : f.date,
        badge: f.entry_type === 'income' ? 'Income' : 'Expense',
        icon: Wallet,
        action: () => {
          openWorkspaceApp('financial');
          onClose();
        },
      });
    });

    if (!q) {
      // Default view: Navigation + Actions + Recent Notes & Tasks
      return items.filter((item) => item.category === 'Navigation' || item.category === 'Actions').slice(0, 10);
    }

    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, tasks, threads, notes, finEntries, availableThemes, themeId, theme.name, openWorkspaceApp, setActiveSection, setWorkspacePage, setThemeId, onClose]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{
          backgroundColor: theme.colors.bgElevated,
          borderRadius: theme.radius.xl,
          borderColor: theme.colors.borderLight,
          boxShadow: theme.shadows.lg,
        }}
        className="w-full max-w-xl border overflow-hidden flex flex-col max-h-[80vh] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-black/5 flex items-center gap-3">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, task, thread, note, or transaction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none text-sm text-zinc-900 focus:outline-none placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-100 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-black/5 space-y-1">
          {results.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-400 space-y-1">
              <p>No results found for "{searchQuery}".</p>
              <p className="text-[11px] text-zinc-400">Try searching for a project name, task, or note.</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    backgroundColor: isSelected ? theme.colors.bgSecondary : 'transparent',
                    borderRadius: theme.radius.md,
                  }}
                  className={`flex items-center justify-between p-2.5 transition-colors cursor-pointer ${
                    isSelected ? 'shadow-xs' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      style={{
                        backgroundColor: isSelected ? theme.colors.accent : 'rgba(0,0,0,0.04)',
                        color: isSelected ? theme.colors.accentText : theme.colors.textPrimary,
                        borderRadius: theme.radius.sm,
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-600 font-semibold border border-zinc-200 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-2.5 bg-black/2 border-t border-black/5 flex items-center justify-between text-[11px] text-zinc-400 px-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-[9px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-[9px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-[9px]">↵</kbd>
              <span>to select</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <Command className="w-3 h-3" />
            <span>K from anywhere</span>
          </div>
        </div>
      </div>
    </div>
  );
};
