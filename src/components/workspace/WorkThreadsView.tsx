import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { WorkThread, ThreadNote, CapsuleCategory } from '../../types/workspace';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import {
  GitBranch,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Sparkles,
  X,
  ChevronRight,
  Edit3,
  Sliders,
  AlertTriangle,
  Link2,
  Rocket,
  Lightbulb,
  FileText,
  Layers,
  Palette,
  ExternalLink,
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { extractAllLinks } from '../../lib/linkUtils';

// ==========================================
// MILDLY COLORFUL PALETTES (NO OUTLINES, SOFT TOTAL TINT)
// ==========================================
export interface SoftCapsulePalette {
  id: string;
  name: string;
  bgLight: string;
  bgActive: string;
  hoverBg: string;
  accent: string;
  glowShadow: string;
  activeGlow: string;
  textTitle: string;
  textBody: string;
  textMuted: string;
}

export const MILD_PALETTES: SoftCapsulePalette[] = [
  {
    id: 'mint',
    name: 'Mint Emerald',
    bgLight: '#ECFDF5',
    bgActive: '#D1FAE5',
    hoverBg: '#E6FAF0',
    accent: '#10B981',
    glowShadow: '0 4px 16px -2px rgba(16, 185, 129, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(16, 185, 129, 0.32)',
    textTitle: '#064E3B',
    textBody: '#065F46',
    textMuted: '#047857',
  },
  {
    id: 'sky',
    name: 'Sky Cyan',
    bgLight: '#F0F9FF',
    bgActive: '#E0F2FE',
    hoverBg: '#E8F5FE',
    accent: '#0284C7',
    glowShadow: '0 4px 16px -2px rgba(14, 165, 233, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(14, 165, 233, 0.32)',
    textTitle: '#0C4A6E',
    textBody: '#0369A1',
    textMuted: '#0284C7',
  },
  {
    id: 'lavender',
    name: 'Soft Lavender',
    bgLight: '#F5F3FF',
    bgActive: '#EDE9FE',
    hoverBg: '#F0ECFE',
    accent: '#8B5CF6',
    glowShadow: '0 4px 16px -2px rgba(139, 92, 246, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(139, 92, 246, 0.32)',
    textTitle: '#4C1D95',
    textBody: '#5B21B6',
    textMuted: '#6D28D9',
  },
  {
    id: 'rose',
    name: 'Blush Rose',
    bgLight: '#FFF1F2',
    bgActive: '#FFE4E6',
    hoverBg: '#FFEAEB',
    accent: '#F43F5E',
    glowShadow: '0 4px 16px -2px rgba(244, 63, 94, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(244, 63, 94, 0.32)',
    textTitle: '#881337',
    textBody: '#9F1239',
    textMuted: '#BE123C',
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    bgLight: '#FFFBEB',
    bgActive: '#FEF3C7',
    hoverBg: '#FEF7D6',
    accent: '#D97706',
    glowShadow: '0 4px 16px -2px rgba(245, 158, 11, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(245, 158, 11, 0.32)',
    textTitle: '#78350F',
    textBody: '#92400E',
    textMuted: '#B45309',
  },
  {
    id: 'peach',
    name: 'Coral Peach',
    bgLight: '#FFF7ED',
    bgActive: '#FFEDD5',
    hoverBg: '#FFF1E0',
    accent: '#EA580C',
    glowShadow: '0 4px 16px -2px rgba(234, 88, 12, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(234, 88, 12, 0.32)',
    textTitle: '#7C2D12',
    textBody: '#9A3412',
    textMuted: '#C2410C',
  },
  {
    id: 'teal',
    name: 'Mellow Teal',
    bgLight: '#F0FDFA',
    bgActive: '#CCFBF1',
    hoverBg: '#DDFBF6',
    accent: '#0D9488',
    glowShadow: '0 4px 16px -2px rgba(13, 148, 136, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(13, 148, 136, 0.32)',
    textTitle: '#134E4A',
    textBody: '#115E59',
    textMuted: '#0F766E',
  },
  {
    id: 'indigo',
    name: 'Nordic Indigo',
    bgLight: '#EEF2FF',
    bgActive: '#E0E7FF',
    hoverBg: '#E7ECFF',
    accent: '#4F46E5',
    glowShadow: '0 4px 16px -2px rgba(79, 70, 229, 0.14), 0 1px 3px rgba(0, 0, 0, 0.02)',
    activeGlow: '0 8px 24px -2px rgba(79, 70, 229, 0.32)',
    textTitle: '#312E81',
    textBody: '#3730A3',
    textMuted: '#4338CA',
  },
];

const getNotePalette = (note: ThreadNote, index: number): SoftCapsulePalette => {
  if (note.color) {
    const found = MILD_PALETTES.find((c) => c.id === note.color);
    if (found) return found;
  }
  // Category default
  if (note.category === 'update') return MILD_PALETTES[0]; // mint
  if (note.category === 'idea') return MILD_PALETTES[1]; // sky
  if (note.category === 'note') return MILD_PALETTES[2]; // lavender
  return MILD_PALETTES[index % MILD_PALETTES.length];
};

export const WorkThreadsView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { registerBackHandler } = useNavigation();

  // All Threads from Firestore
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [searchThreadQuery, setSearchThreadQuery] = useState('');

  // Active Focused Thread (Opens the Popup Modal)
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);

  // Search inside thread notes
  const [searchNoteQuery, setSearchNoteQuery] = useState('');

  // Category filter inside open thread ('all' | 'update' | 'idea' | 'note')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | CapsuleCategory>('all');

  // Floating speed-dial button state
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  // Draggable Unlimited Flexible Capsule Scale (0.75x to 1.45x)
  const [capsuleScale, setCapsuleScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('work_threads_capsule_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.75 && val <= 1.45) return val;
      }
    } catch {}
    return 1.0;
  });

  // New Thread Modal & Edit Thread Title
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [editingThreadTitle, setEditingThreadTitle] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState('');

  // Dedicated Delete Confirmation States (Own UI, no window.confirm)
  const [noteToDelete, setNoteToDelete] = useState<ThreadNote | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<WorkThread | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Copy feedback tracking
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Active newly created capsule id for auto-scrolling
  const [highlightedCapsuleId, setHighlightedCapsuleId] = useState<string | null>(null);

  // Autosave status per capsule
  const [saveStatusMap, setSaveStatusMap] = useState<Record<string, string>>({});

  // Debounce refs map for capsules
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const modalScrollRef = useRef<HTMLDivElement>(null);

  // 1. Subscribe to Firestore Work Threads
  useEffect(() => {
    if (!user || !db) return;
    const qThreads = query(
      collection(db, 'work_threads'),
      where('owner_uid', '==', user.uid)
    );

    const unsub = onSnapshot(
      qThreads,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkThread));
        list.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
        setThreads(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'work_threads')
    );

    return () => unsub();
  }, [user]);

  // Handle Capsule Scale Changes
  const handleScaleChange = (val: number) => {
    const clamped = Math.max(0.75, Math.min(1.45, val));
    setCapsuleScale(clamped);
    try {
      localStorage.setItem('work_threads_capsule_scale', clamped.toString());
    } catch {}
  };

  // Find currently open thread for the Popup
  const focusedThread = useMemo(() => {
    if (!focusedThreadId) return null;
    return threads.find((t) => (t.id || t.thread_id) === focusedThreadId) || null;
  }, [threads, focusedThreadId]);

  // Notes of focused thread, sorted newest first
  const threadNotes = useMemo(() => {
    if (!focusedThread || !focusedThread.notes_list) return [];
    return [...focusedThread.notes_list].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA; // Newest at top
    });
  }, [focusedThread]);

  // Filtered notes inside open thread
  const filteredNotes = useMemo(() => {
    if (!searchNoteQuery.trim()) return threadNotes;
    const q = searchNoteQuery.toLowerCase().trim();
    return threadNotes.filter((n) =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.text && n.text.toLowerCase().includes(q))
    );
  }, [threadNotes, searchNoteQuery]);

  // 3 Categorized lists (Updates, Idea, Additional Note)
  const updatesList = useMemo(() => {
    return filteredNotes.filter((n) => n.category === 'update');
  }, [filteredNotes]);

  const ideaList = useMemo(() => {
    return filteredNotes.filter((n) => n.category === 'idea');
  }, [filteredNotes]);

  const additionalNotesList = useMemo(() => {
    // Legacy notes without category default to 'note'
    return filteredNotes.filter((n) => n.category === 'note' || !n.category);
  }, [filteredNotes]);

  // Filtered threads in the main grid
  const filteredThreads = useMemo(() => {
    if (!searchThreadQuery.trim()) return threads;
    const q = searchThreadQuery.toLowerCase().trim();
    return threads.filter((t) => (t.title || '').toLowerCase().includes(q));
  }, [threads, searchThreadQuery]);

  // When focused thread changes, initialize draft
  useEffect(() => {
    if (focusedThread) {
      setThreadTitleDraft(focusedThread.title || '');
      setEditingThreadTitle(false);
      setSearchNoteQuery('');
      setActiveCategoryFilter('all');
      setIsSpeedDialOpen(false);
    }
  }, [focusedThreadId]);

  // Register hardware/back button handler when modal/confirmation is open
  useEffect(() => {
    return registerBackHandler(() => {
      if (isSpeedDialOpen) {
        setIsSpeedDialOpen(false);
        return true;
      }
      if (noteToDelete) {
        setNoteToDelete(null);
        return true;
      }
      if (threadToDelete) {
        setThreadToDelete(null);
        return true;
      }
      if (showNewThreadModal) {
        setShowNewThreadModal(false);
        return true;
      }
      if (focusedThreadId) {
        setFocusedThreadId(null);
        return true;
      }
      return false;
    });
  }, [isSpeedDialOpen, noteToDelete, threadToDelete, showNewThreadModal, focusedThreadId, registerBackHandler]);

  // Dynamically computed styling properties based on the continuous drag scale bar
  const computedCapsuleStyle = useMemo(() => {
    const s = capsuleScale;
    const padY = Math.round(14 * s);
    const padX = Math.round(18 * s);
    const radius = Math.round(20 * s);
    const titlePx = Math.round(14 * s);
    const bodyPx = Math.round(13 * s);

    return {
      padding: `${padY}px ${padX}px`,
      borderRadius: `${radius}px`,
      titleFontSize: `${titlePx}px`,
      bodyFontSize: `${bodyPx}px`,
    };
  }, [capsuleScale]);

  // Helper to persist capsule changes to Firestore
  const persistCapsuleChange = useCallback((
    noteId: string,
    updates: Partial<ThreadNote>
  ) => {
    if (!focusedThread || !user || !db) return;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    const currentThread = threads.find((t) => (t.id || t.thread_id) === threadDocId);
    const existingList = currentThread?.notes_list || focusedThread.notes_list || [];

    const nowIso = new Date().toISOString();
    const updatedList = existingList.map((n) => {
      if ((n.note_id || (n as any).id) === noteId) {
        return {
          ...n,
          ...updates,
          updated_at: nowIso,
        };
      }
      return n;
    });

    // Optimistically update threads state
    setThreads((prev) =>
      prev.map((t) => {
        if ((t.id || t.thread_id) === threadDocId) {
          return {
            ...t,
            notes_list: updatedList,
            updated_at: nowIso,
          };
        }
        return t;
      })
    );

    updateDoc(doc(db, 'work_threads', threadDocId), {
      notes_list: updatedList,
      updated_at: nowIso,
    }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    });

    setSaveStatusMap((prev) => ({ ...prev, [noteId]: 'Saved' }));
    setTimeout(() => {
      setSaveStatusMap((prev) => {
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
    }, 1800);
  }, [focusedThread, user, threads]);

  // Change title with auto-save debounce
  const handleNoteTitleInput = (noteId: string, title: string) => {
    // Optimistically update local thread notes
    if (focusedThread) {
      const threadDocId = focusedThread.id || focusedThread.thread_id;
      setThreads((prev) =>
        prev.map((t) => {
          if ((t.id || t.thread_id) === threadDocId) {
            return {
              ...t,
              notes_list: (t.notes_list || []).map((n) =>
                (n.note_id || (n as any).id) === noteId ? { ...n, title } : n
              ),
            };
          }
          return t;
        })
      );
    }

    if (debounceTimersRef.current[`title_${noteId}`]) {
      clearTimeout(debounceTimersRef.current[`title_${noteId}`]);
    }
    debounceTimersRef.current[`title_${noteId}`] = setTimeout(() => {
      persistCapsuleChange(noteId, { title });
    }, 400);
  };

  // Change body with auto-save debounce
  const handleNoteTextInput = (noteId: string, text: string) => {
    // Optimistically update local thread notes
    if (focusedThread) {
      const threadDocId = focusedThread.id || focusedThread.thread_id;
      setThreads((prev) =>
        prev.map((t) => {
          if ((t.id || t.thread_id) === threadDocId) {
            return {
              ...t,
              notes_list: (t.notes_list || []).map((n) =>
                (n.note_id || (n as any).id) === noteId ? { ...n, text } : n
              ),
            };
          }
          return t;
        })
      );
    }

    if (debounceTimersRef.current[`text_${noteId}`]) {
      clearTimeout(debounceTimersRef.current[`text_${noteId}`]);
    }
    debounceTimersRef.current[`text_${noteId}`] = setTimeout(() => {
      persistCapsuleChange(noteId, { text });
    }, 450);
  };

  // Instant save on blur
  const handleCapsuleBlur = (note: ThreadNote) => {
    const noteId = note.note_id || (note as any).id;
    if (debounceTimersRef.current[`title_${noteId}`]) {
      clearTimeout(debounceTimersRef.current[`title_${noteId}`]);
    }
    if (debounceTimersRef.current[`text_${noteId}`]) {
      clearTimeout(debounceTimersRef.current[`text_${noteId}`]);
    }
    persistCapsuleChange(noteId, { title: note.title, text: note.text });
  };

  // Change color tint
  const handleCapsuleColorChange = (noteId: string, colorId: string) => {
    persistCapsuleChange(noteId, { color: colorId });
  };

  // Create a new Capsule under specific Category (Updates, Idea, Additional Note)
  const handleCreateCapsule = async (category: CapsuleCategory) => {
    if (!focusedThread || !user || !db) return;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    const existingList = focusedThread.notes_list || [];

    const newNoteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const defaultColor = category === 'update' ? 'mint' : category === 'idea' ? 'sky' : 'lavender';

    const newNote: ThreadNote = {
      note_id: newNoteId,
      category,
      title: '',
      text: '',
      color: defaultColor,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Prepend so newest appears at the top of that category
    const updatedList = [newNote, ...existingList];

    try {
      await updateDoc(doc(db, 'work_threads', threadDocId), {
        notes_list: updatedList,
        updated_at: nowIso,
      });

      setHighlightedCapsuleId(newNoteId);
      setIsSpeedDialOpen(false);

      // Scroll smoothly to the target category section
      setTimeout(() => {
        const el = document.getElementById(`capsule-${newNoteId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const ta = el.querySelector('textarea');
          if (ta) ta.focus();
        }
      }, 150);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    }
  };

  // Global & In-Modal Keyboard Shortcuts Listener (Alt+U for Update, Alt+I for Idea, Alt+N for Note)
  useEffect(() => {
    if (!focusedThreadId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Alt (Option on macOS)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          handleCreateCapsule('update');
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          handleCreateCapsule('idea');
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleCreateCapsule('note');
        }
      }

      if (e.key === 'Escape') {
        if (isSpeedDialOpen) {
          setIsSpeedDialOpen(false);
        } else if (!noteToDelete && !threadToDelete && !showNewThreadModal) {
          setFocusedThreadId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedThreadId, isSpeedDialOpen, noteToDelete, threadToDelete, showNewThreadModal, focusedThread, user]);

  // Copy Capsule Text
  const handleCopyCapsule = (note: ThreadNote) => {
    const combined = note.title ? `${note.title}\n\n${note.text}` : note.text;
    navigator.clipboard.writeText(combined);
    const nId = note.note_id || (note as any).id;
    setCopiedNoteId(nId);
    setTimeout(() => setCopiedNoteId(null), 1800);
  };

  // Confirmed Delete Note Handler
  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete || !focusedThread || !user || !db) return;
    const noteId = noteToDelete.note_id || (noteToDelete as any).id;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    const currentThread = threads.find((t) => (t.id || t.thread_id) === threadDocId);
    const existingList = currentThread?.notes_list || focusedThread.notes_list || [];
    const updatedList = existingList.filter(
      (n) => (n.note_id || (n as any).id) !== noteId
    );
    const nowIso = new Date().toISOString();

    setIsDeleting(true);

    // Optimistic update
    setThreads((prev) =>
      prev.map((t) => {
        if ((t.id || t.thread_id) === threadDocId) {
          return {
            ...t,
            notes_list: updatedList,
            updated_at: nowIso,
          };
        }
        return t;
      })
    );

    setNoteToDelete(null);

    try {
      await updateDoc(doc(db, 'work_threads', threadDocId), {
        notes_list: updatedList,
        updated_at: nowIso,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirmed Delete Thread Handler
  const handleConfirmDeleteThread = async () => {
    if (!threadToDelete || !user || !db) return;
    const threadDocId = threadToDelete.id || threadToDelete.thread_id;
    setIsDeleting(true);

    // Optimistic update
    setThreads((prev) => prev.filter((t) => (t.id || t.thread_id) !== threadDocId));

    if (focusedThreadId === threadDocId) {
      setFocusedThreadId(null);
    }
    setThreadToDelete(null);

    try {
      await deleteDoc(doc(db, 'work_threads', threadDocId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `work_threads/${threadDocId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Create New Thread
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() || !user || !db) return;

    const threadDocId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newThread: WorkThread = {
      id: threadDocId,
      thread_id: threadDocId,
      owner_uid: user.uid,
      title: newThreadTitle.trim(),
      created_at: nowIso,
      updated_at: nowIso,
      notes_list: [],
    };

    try {
      await setDoc(doc(db, 'work_threads', threadDocId), newThread);
      setNewThreadTitle('');
      setShowNewThreadModal(false);
      setFocusedThreadId(threadDocId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'work_threads');
    }
  };

  // Save Thread Title
  const handleSaveThreadTitle = async () => {
    if (!focusedThread || !user || !db || !threadTitleDraft.trim()) return;
    const threadDocId = focusedThread.id || focusedThread.thread_id;

    try {
      await updateDoc(doc(db, 'work_threads', threadDocId), {
        title: threadTitleDraft.trim(),
        updated_at: new Date().toISOString(),
      });
      setEditingThreadTitle(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    }
  };

  // Render Capsule Chunk Card
  const renderCapsuleCard = (note: ThreadNote, idx: number, category: CapsuleCategory) => {
    const noteId = note.note_id || (note as any).id;
    const palette = getNotePalette(note, idx);
    const timeLabel = formatDateTimeWithHM(note.updated_at || note.created_at);
    const detectedLinks = extractAllLinks(`${note.title || ''} ${note.text || ''}`);
    const isCopied = copiedNoteId === noteId;
    const saveStatus = saveStatusMap[noteId];

    return (
      <div
        key={noteId}
        id={`capsule-${noteId}`}
        style={{
          padding: computedCapsuleStyle.padding,
          borderRadius: computedCapsuleStyle.borderRadius,
          backgroundColor: palette.bgLight,
          boxShadow: palette.glowShadow,
        }}
        className="relative group transition-all duration-200 border border-black/5 hover:border-black/10 flex flex-col space-y-2.5"
      >
        {/* Top Header of Capsule */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              style={{
                backgroundColor: palette.accent,
                boxShadow: `0 0 6px ${palette.accent}`,
              }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
            />
            {/* Inline Capsule Title */}
            <input
              type="text"
              value={note.title || ''}
              onChange={(e) => handleNoteTitleInput(noteId, e.target.value)}
              onBlur={() => handleCapsuleBlur(note)}
              placeholder="Title (optional)..."
              style={{
                fontSize: computedCapsuleStyle.titleFontSize,
                color: palette.textTitle,
              }}
              className="font-black bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none w-full min-w-0 py-0.5 transition-colors placeholder:text-zinc-400 placeholder:font-normal"
            />
          </div>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saveStatus && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-fade-in">
                ✓ {saveStatus}
              </span>
            )}

            <span className="text-[11px] font-medium text-zinc-400 tabular-nums hidden xs:inline">
              {timeLabel}
            </span>

            {/* Mild Color Swatch Selector */}
            <div className="flex items-center gap-1 bg-white/70 p-1 rounded-full border border-zinc-200/80">
              {MILD_PALETTES.slice(0, 4).map((pal) => (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => handleCapsuleColorChange(noteId, pal.id)}
                  style={{ backgroundColor: pal.accent }}
                  className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                    (note.color || palette.id) === pal.id ? 'scale-125 ring-2 ring-white shadow-xs' : 'opacity-40 hover:opacity-100'
                  }`}
                  title={pal.name}
                />
              ))}
            </div>

            {/* Copy Button */}
            <button
              type="button"
              onClick={() => handleCopyCapsule(note)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-white/90 transition-colors cursor-pointer"
              title="Copy capsule content"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => setNoteToDelete(note)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete capsule"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Capsule Body: Native Textarea (Works 100% on Android keyboards!) */}
        <textarea
          value={note.text || ''}
          onChange={(e) => handleNoteTextInput(noteId, e.target.value)}
          onBlur={() => handleCapsuleBlur(note)}
          placeholder={`Write what you want in this ${category === 'update' ? 'update' : category === 'idea' ? 'idea' : 'note'}...`}
          style={{
            fontSize: computedCapsuleStyle.bodyFontSize,
            color: palette.textBody,
          }}
          className="w-full bg-transparent min-h-[72px] sm:min-h-[88px] resize-y font-sans font-medium leading-relaxed placeholder:text-zinc-400/80 focus:outline-none select-text touch-manipulation"
          spellCheck={false}
        />

        {/* Detected Links Pill Bar (Bright blue, tappable, does not break typing) */}
        {detectedLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-black/5">
            <span className="text-[10px] font-black uppercase text-blue-700 flex items-center gap-1">
              <Link2 className="w-3 h-3 text-[#2563eb]" />
              <span>Links:</span>
            </span>
            {detectedLinks.map((link) => (
              <LinkWithPreview
                key={link.id}
                url={link.url}
                domain={link.domain}
                path={link.path}
                variant="badge"
                stopPropagation={true}
              >
                <span className="max-w-[200px] truncate text-[#2563eb] font-bold">
                  {link.domain}{link.path ? link.path.slice(0, 16) : ''}
                </span>
              </LinkWithPreview>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* ========================================== */}
      {/* WORK THREADS TOP HEADER & SEARCH */}
      {/* ========================================== */}
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.xl,
        }}
        className="p-4 sm:p-5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0 shadow-2xs">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
              Work Threads
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              Categorized 3-capsule workspace: Updates, Ideas, and Additional Notes
            </p>
          </div>
        </div>

        {/* Search & New Thread Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchThreadQuery}
              onChange={(e) => setSearchThreadQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900 font-medium"
            />
            {searchThreadQuery && (
              <button
                type="button"
                onClick={() => setSearchThreadQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowNewThreadModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Thread</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* THREADS IN BOXES (CARDS GRID) */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredThreads.map((thread) => {
          const threadId = thread.id || thread.thread_id;
          const notes = thread.notes_list || [];
          const noteCount = notes.length;
          const updatedTime = formatDateTimeWithHM(thread.updated_at || thread.created_at);

          const upCount = notes.filter((n) => n.category === 'update').length;
          const idCount = notes.filter((n) => n.category === 'idea').length;
          const notCount = notes.filter((n) => n.category === 'note' || !n.category).length;

          return (
            <div
              key={threadId}
              onClick={() => setFocusedThreadId(threadId)}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: '1.5rem',
              }}
              className="p-5 border shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[195px] relative overflow-hidden"
            >
              <div className="space-y-3.5">
                {/* Header: Title + Capsule Count + Delete Trigger */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-zinc-900 group-hover:text-purple-600 transition-colors truncate">
                      {thread.title || 'Untitled Thread'}
                    </h3>
                    <p className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                      {noteCount} {noteCount === 1 ? 'capsule' : 'capsules'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreadToDelete(thread);
                    }}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 3 Capsule Category Badges Summary */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                    <Rocket className="w-2.5 h-2.5 text-emerald-600" />
                    <span>{upCount} Updates</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-bold">
                    <Lightbulb className="w-2.5 h-2.5 text-sky-600" />
                    <span>{idCount} Ideas</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold">
                    <FileText className="w-2.5 h-2.5 text-purple-600" />
                    <span>{notCount} Notes</span>
                  </span>
                </div>

                {/* Preview of latest note snippet in bold */}
                {notes[0] ? (
                  <p className="text-xs font-bold text-zinc-600 line-clamp-2 leading-relaxed">
                    {notes[0].title ? `${notes[0].title} — ` : ''}
                    {notes[0].text.trim() || 'Empty capsule'}
                  </p>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-dashed border-zinc-200 text-center text-xs font-semibold text-zinc-400">
                    No capsules yet. Click to open & write!
                  </div>
                )}
              </div>

              {/* Footer: Timestamp with Hour and Minute + Open CTA */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] font-semibold text-zinc-400 mt-2">
                <span className="tabular-nums">
                  {updatedTime}
                </span>
                <span className="text-zinc-900 font-bold group-hover:text-purple-600 group-hover:underline flex items-center gap-0.5 transition-colors">
                  Open <ChevronRight className="w-3.5 h-3.5 inline group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}

        {/* Create New Thread Card in Grid */}
        <div
          onClick={() => setShowNewThreadModal(true)}
          style={{
            borderColor: theme.colors.borderLight,
            borderRadius: '1.5rem',
          }}
          className="p-5 border-2 border-dashed hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 min-h-[195px] group min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-2xl bg-white text-zinc-400 group-hover:text-zinc-900 group-hover:scale-105 transition-all flex items-center justify-center border border-zinc-200 shadow-2xs">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-zinc-700 group-hover:text-zinc-900">
            Create New Thread
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            Start a new thread with categorized capsules
          </span>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* EXTENDED POPUP MODAL: 3 CATEGORIZED CAPSULE STYLE (UPDATES, IDEA, NOTE) */}
      {/* ====================================================================== */}
      {focusedThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: theme.colors.borderLight,
              borderRadius: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            className="w-full max-w-5xl h-[94dvh] sm:h-[90vh] max-h-[920px] border flex flex-col overflow-hidden shadow-2xl relative"
          >
            {/* ========================================== */}
            {/* POPUP HEADER */}
            {/* ========================================== */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0 bg-white">
              {/* Left: Thread Title (Click to edit) */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
                  <GitBranch className="w-4 h-4" />
                </div>

                {editingThreadTitle ? (
                  <div className="flex items-center gap-1.5 flex-1 max-w-md">
                    <input
                      type="text"
                      autoFocus
                      value={threadTitleDraft}
                      onChange={(e) => setThreadTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveThreadTitle();
                        if (e.key === 'Escape') setEditingThreadTitle(false);
                      }}
                      className="w-full px-3 py-1 text-sm font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveThreadTitle}
                      className="px-2.5 py-1 text-xs font-bold bg-zinc-900 text-white rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingThreadTitle(false)}
                      className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <h2
                      onClick={() => setEditingThreadTitle(true)}
                      className="text-base sm:text-lg font-bold text-zinc-900 truncate hover:text-purple-600 transition-colors cursor-pointer"
                      title="Click to rename thread"
                    >
                      {focusedThread.title || 'Untitled Thread'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEditingThreadTitle(true)}
                      className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors cursor-pointer"
                      title="Rename thread"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                      · {threadNotes.length} capsules
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Capsule Zoom Scale & Close */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Capsule Zoom Bar */}
                <div className="hidden sm:flex items-center gap-2 bg-zinc-100/80 px-2.5 py-1.5 rounded-xl border border-zinc-200">
                  <Sliders className="w-3 h-3 text-zinc-500" />
                  <input
                    type="range"
                    min="0.75"
                    max="1.45"
                    step="0.02"
                    value={capsuleScale}
                    onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 h-1.5 bg-zinc-300 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                    title={`Capsule zoom scale: ${Math.round(capsuleScale * 100)}%`}
                  />
                  <span className="text-[10px] font-black text-zinc-700 tabular-nums w-8 text-right">
                    {Math.round(capsuleScale * 100)}%
                  </span>
                </div>

                {/* Delete Thread Button inside Popup */}
                <button
                  type="button"
                  onClick={() => setThreadToDelete(focusedThread)}
                  className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-rose-100/70"
                  title="Delete entire thread"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Close Popup Button */}
                <button
                  type="button"
                  onClick={() => setFocusedThreadId(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* SUBHEADER: CATEGORY JUMP / FILTER TABS + FAST CAPSULE SEARCH       */}
            {/* ================================================================= */}
            <div className="px-4 sm:px-6 py-2.5 bg-zinc-50 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                    activeCategoryFilter === 'all'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All ({threadNotes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('update')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                    activeCategoryFilter === 'update'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Rocket className="w-3 h-3 text-emerald-700" />
                  <span>Updates ({updatesList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('idea')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                    activeCategoryFilter === 'idea'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                  }`}
                >
                  <Lightbulb className="w-3 h-3 text-sky-700" />
                  <span>Ideas ({ideaList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('note')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                    activeCategoryFilter === 'note'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <FileText className="w-3 h-3 text-purple-700" />
                  <span>Notes ({additionalNotesList.length})</span>
                </button>
              </div>

              {/* In-Thread Fast Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter capsules..."
                  value={searchNoteQuery}
                  onChange={(e) => setSearchNoteQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:border-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900 font-medium"
                />
                {searchNoteQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchNoteQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* MAIN SCROLLABLE BODY: 3 STACKED CATEGORIZED SECTIONS              */}
            {/* ================================================================= */}
            <div
              ref={modalScrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 pb-32 bg-zinc-50/40 relative"
            >
              {/* SECTION 1: UPDATES */}
              {(activeCategoryFilter === 'all' || activeCategoryFilter === 'update') && (
                <section id="section-updates" className="space-y-3">
                  {/* Category Header Banner */}
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                          Updates
                        </h3>
                        <p className="text-[11px] text-emerald-700 font-medium hidden sm:block">
                          Progress notes, milestones, changelogs & status reports
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/90 text-emerald-800 tabular-nums">
                        {updatesList.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateCapsule('update')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[36px]"
                      title="Add Update (Shortcut: Alt+U)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Update</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] bg-emerald-800/40 rounded font-mono">
                        Alt+U
                      </kbd>
                    </button>
                  </div>

                  {/* List of Update Capsules */}
                  {updatesList.length > 0 ? (
                    <div className="space-y-3">
                      {updatesList.map((note, idx) => renderCapsuleCard(note, idx, 'update'))}
                    </div>
                  ) : (
                    <div
                      onClick={() => handleCreateCapsule('update')}
                      className="p-5 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/80 transition-all cursor-pointer space-y-1 group"
                    >
                      <Rocket className="w-5 h-5 text-emerald-500 mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-emerald-900">No updates logged yet</p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Click here or press <span className="font-mono font-bold">Alt+U</span> to record an update
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* SECTION 2: IDEA */}
              {(activeCategoryFilter === 'all' || activeCategoryFilter === 'idea') && (
                <section id="section-idea" className="space-y-3">
                  {/* Category Header Banner */}
                  <div className="flex items-center justify-between pb-2 border-b border-sky-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shadow-2xs">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-sky-950 uppercase tracking-wide">
                          Idea
                        </h3>
                        <p className="text-[11px] text-sky-700 font-medium hidden sm:block">
                          Brainstorming sparks, concepts, angles & future directions
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100/90 text-sky-800 tabular-nums">
                        {ideaList.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateCapsule('idea')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[36px]"
                      title="Add Idea (Shortcut: Alt+I)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Idea</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] bg-sky-800/40 rounded font-mono">
                        Alt+I
                      </kbd>
                    </button>
                  </div>

                  {/* List of Idea Capsules */}
                  {ideaList.length > 0 ? (
                    <div className="space-y-3">
                      {ideaList.map((note, idx) => renderCapsuleCard(note, idx, 'idea'))}
                    </div>
                  ) : (
                    <div
                      onClick={() => handleCreateCapsule('idea')}
                      className="p-5 text-center rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40 hover:bg-sky-50/80 transition-all cursor-pointer space-y-1 group"
                    >
                      <Lightbulb className="w-5 h-5 text-sky-500 mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-sky-900">No ideas recorded yet</p>
                      <p className="text-[11px] text-sky-600 font-medium">
                        Click here or press <span className="font-mono font-bold">Alt+I</span> to capture an idea
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* SECTION 3: ADDITIONAL NOTE */}
              {(activeCategoryFilter === 'all' || activeCategoryFilter === 'note') && (
                <section id="section-note" className="space-y-3">
                  {/* Category Header Banner */}
                  <div className="flex items-center justify-between pb-2 border-b border-purple-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shadow-2xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-purple-950 uppercase tracking-wide">
                          Additional Note
                        </h3>
                        <p className="text-[11px] text-purple-700 font-medium hidden sm:block">
                          Reference snippets, credentials, scratchpad notes & links
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100/90 text-purple-800 tabular-nums">
                        {additionalNotesList.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateCapsule('note')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[36px]"
                      title="Add Note (Shortcut: Alt+N)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] bg-purple-800/40 rounded font-mono">
                        Alt+N
                      </kbd>
                    </button>
                  </div>

                  {/* List of Additional Note Capsules */}
                  {additionalNotesList.length > 0 ? (
                    <div className="space-y-3">
                      {additionalNotesList.map((note, idx) => renderCapsuleCard(note, idx, 'note'))}
                    </div>
                  ) : (
                    <div
                      onClick={() => handleCreateCapsule('note')}
                      className="p-5 text-center rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/40 hover:bg-purple-50/80 transition-all cursor-pointer space-y-1 group"
                    >
                      <FileText className="w-5 h-5 text-purple-500 mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-purple-900">No additional notes yet</p>
                      <p className="text-[11px] text-purple-600 font-medium">
                        Click here or press <span className="font-mono font-bold">Alt+N</span> to add an additional note
                      </p>
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* ================================================================= */}
            {/* FLOATING SPEED-DIAL BUTTON (THUMB ZONE WITH 3 CAPSULE ACTIONS)     */}
            {/* ================================================================= */}
            <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end pointer-events-auto">
              {/* Speed-Dial Sub-Buttons (Visible when open) */}
              {isSpeedDialOpen && (
                <div className="mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
                  {/* Option 1: Additional Note */}
                  <button
                    type="button"
                    onClick={() => handleCreateCapsule('note')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer min-h-[44px]"
                  >
                    <span className="font-semibold text-purple-100 text-[11px]">Alt+N</span>
                    <span>+ Additional Note</span>
                    <FileText className="w-4 h-4 ml-1" />
                  </button>

                  {/* Option 2: Idea */}
                  <button
                    type="button"
                    onClick={() => handleCreateCapsule('idea')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer min-h-[44px]"
                  >
                    <span className="font-semibold text-sky-100 text-[11px]">Alt+I</span>
                    <span>+ Idea</span>
                    <Lightbulb className="w-4 h-4 ml-1" />
                  </button>

                  {/* Option 3: Updates */}
                  <button
                    type="button"
                    onClick={() => handleCreateCapsule('update')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer min-h-[44px]"
                  >
                    <span className="font-semibold text-emerald-100 text-[11px]">Alt+U</span>
                    <span>+ Update</span>
                    <Rocket className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}

              {/* Main FAB Trigger Button */}
              <button
                type="button"
                onClick={() => setIsSpeedDialOpen((prev) => !prev)}
                style={{
                  boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.3)',
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer text-white min-h-[48px] min-w-[48px] ${
                  isSpeedDialOpen
                    ? 'bg-zinc-800 rotate-45'
                    : 'bg-zinc-900 hover:bg-zinc-800 hover:scale-105 active:scale-95'
                }`}
                title={isSpeedDialOpen ? 'Close capsule speed-dial' : 'Trigger new capsule (Alt+U, Alt+I, Alt+N)'}
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE NEW THREAD BOX */}
      {/* ========================================== */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '1.5rem',
              border: `1px solid ${theme.colors.borderLight}`,
              boxShadow: theme.shadows.lg,
            }}
            className="w-full max-w-md p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900">Create New Thread</h3>
              <button
                onClick={() => setShowNewThreadModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1">
                  Thread Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Project Orion, Product Design, Marketing..."
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none text-zinc-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl transition-colors shadow-2xs cursor-pointer min-h-[44px]"
                >
                  Create Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* DEDICATED IN-APP DELETE NOTE CONFIRMATION MODAL UI (NO WINDOW.CONFIRM) */}
      {/* ====================================================================== */}
      {noteToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setNoteToDelete(null);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            className="w-full max-w-sm p-6 text-left space-y-4 border border-zinc-100 animate-in zoom-in-95 duration-150"
          >
            {/* Header: Destructive Icon + Close Button */}
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation text */}
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">Delete Capsule Note?</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Are you sure you want to permanently delete this capsule?
                {noteToDelete.title && (
                  <span className="block mt-1 font-bold text-zinc-800">
                    &quot;{noteToDelete.title}&quot;
                  </span>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNote}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                {isDeleting ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* DEDICATED IN-APP DELETE THREAD CONFIRMATION MODAL UI (NO WINDOW.CONFIRM)*/}
      {/* ====================================================================== */}
      {threadToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setThreadToDelete(null);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            className="w-full max-w-sm p-6 text-left space-y-4 border border-zinc-100 animate-in zoom-in-95 duration-150"
          >
            {/* Header: Destructive Icon + Close Button */}
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={isDeleting}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation text */}
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">Delete Entire Thread?</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will delete the thread{' '}
                <span className="font-bold text-zinc-800">
                  &quot;{threadToDelete.title || 'Untitled Thread'}&quot;
                </span>{' '}
                and all {threadToDelete.notes_list?.length || 0} of its capsule notes.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteThread}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                {isDeleting ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
