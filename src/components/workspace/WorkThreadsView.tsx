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
import { ResizablePopupWrapper } from '../common/ResizablePopupWrapper';

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

// ==========================================
// 3-CAPSULE TEXT CHUNKS (UPDATE, IDEA, NOTE)
// ==========================================
export interface CapsuleChunk {
  id: string;
  type: CapsuleCategory; // 'update' | 'idea' | 'note'
  text: string;
  created_at?: string;
}

export const parseChunks = (rawText: string, defaultType: CapsuleCategory = 'note'): CapsuleChunk[] => {
  if (!rawText || !rawText.trim()) return [];
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return parsed.map((item: any, idx: number) => ({
        id: item.id || `chunk_${idx}_${Date.now()}`,
        type: (item.type === 'update' || item.type === 'idea' || item.type === 'note') ? item.type : defaultType,
        text: typeof item.text === 'string' ? item.text : '',
        created_at: item.created_at,
      }));
    }
  } catch {}
  return [{ id: 'legacy_1', type: defaultType, text: rawText }];
};

export const serializeChunks = (chunks: CapsuleChunk[]): string => {
  return JSON.stringify(chunks);
};

export const getCapsulePlainText = (rawText: string): string => {
  if (!rawText) return '';
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => c.text).filter(Boolean).join(' · ');
    }
  } catch {}
  return rawText;
};

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

  // Active Selected Capsule inside Thread Popup
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mobileActivePane, setMobileActivePane] = useState<'list' | 'editor'>('list');

  // Adaptive movable split divider (default 340px, clamped)
  const [splitLeftWidth, setSplitLeftWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('thread_split_left_width');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 220 && parsed <= 600) return parsed;
      }
    } catch {}
    return 340;
  });

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingDividerRef = useRef(false);

  // Mouse drag handler for adaptive divider line
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingDividerRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingDividerRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newLeft = moveEvent.clientX - rect.left;
      const clamped = Math.max(220, Math.min(rect.width - 280, newLeft));
      setSplitLeftWidth(clamped);
    };

    const onMouseUp = () => {
      if (isDraggingDividerRef.current) {
        isDraggingDividerRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        try {
          localStorage.setItem('thread_split_left_width', splitLeftWidth.toString());
        } catch {}
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch drag handler for adaptive divider line
  const handleDividerTouchStart = () => {
    if (!splitContainerRef.current) return;
    isDraggingDividerRef.current = true;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingDividerRef.current || !splitContainerRef.current) return;
      const t = moveEvent.touches[0];
      if (!t) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newLeft = t.clientX - rect.left;
      const clamped = Math.max(200, Math.min(rect.width - 240, newLeft));
      setSplitLeftWidth(clamped);
    };

    const onTouchEnd = () => {
      if (isDraggingDividerRef.current) {
        isDraggingDividerRef.current = false;
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        try {
          localStorage.setItem('thread_split_left_width', splitLeftWidth.toString());
        } catch {}
      }
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
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

  // Currently selected capsule
  const selectedNote = useMemo(() => {
    if (!threadNotes.length) return null;
    if (selectedNoteId) {
      const found = threadNotes.find((n) => (n.note_id || (n as any).id) === selectedNoteId);
      if (found) return found;
    }
    return threadNotes[0];
  }, [threadNotes, selectedNoteId]);

  // Filtered notes inside open thread
  const filteredNotes = useMemo(() => {
    if (!searchNoteQuery.trim()) return threadNotes;
    const q = searchNoteQuery.toLowerCase().trim();
    return threadNotes.filter((n) =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (getCapsulePlainText(n.text || '').toLowerCase().includes(q))
    );
  }, [threadNotes, searchNoteQuery]);

  // 3 Categorized lists (Updates, Idea, Additional Note)
  const updatesList = useMemo(() => {
    return filteredNotes.filter((n) => {
      if (n.category === 'update') return true;
      const chunks = parseChunks(n.text, n.category || 'note');
      return chunks.some((c) => c.type === 'update');
    });
  }, [filteredNotes]);

  const ideaList = useMemo(() => {
    return filteredNotes.filter((n) => {
      if (n.category === 'idea') return true;
      const chunks = parseChunks(n.text, n.category || 'note');
      return chunks.some((c) => c.type === 'idea');
    });
  }, [filteredNotes]);

  const additionalNotesList = useMemo(() => {
    return filteredNotes.filter((n) => {
      if (n.category === 'note' || !n.category) return true;
      const chunks = parseChunks(n.text, n.category || 'note');
      return chunks.some((c) => c.type === 'note');
    });
  }, [filteredNotes]);

  // Filtered threads in the main grid
  const filteredThreads = useMemo(() => {
    if (!searchThreadQuery.trim()) return threads;
    const q = searchThreadQuery.toLowerCase().trim();
    return threads.filter((t) => (t.title || '').toLowerCase().includes(q));
  }, [threads, searchThreadQuery]);

  // When focused thread changes, initialize draft and selected capsule
  useEffect(() => {
    if (focusedThread) {
      setThreadTitleDraft(focusedThread.title || '');
      setEditingThreadTitle(false);
      setSearchNoteQuery('');
      setActiveCategoryFilter('all');
      setIsSpeedDialOpen(false);
      setMobileActivePane('list');
      const list = focusedThread.notes_list || [];
      if (list.length > 0) {
        setSelectedNoteId(list[0].note_id || (list[0] as any).id);
      } else {
        setSelectedNoteId(null);
      }
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
  const handleCreateCapsule = async (category: CapsuleCategory = 'note') => {
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

      setSelectedNoteId(newNoteId);
      setMobileActivePane('editor');
      setHighlightedCapsuleId(newNoteId);
      setIsSpeedDialOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    }
  };

  // Add a 3-capsule text block (Update, Idea, Note) inside currently selected capsule
  const handleAddChunk = (type: CapsuleCategory) => {
    if (!selectedNote) {
      handleCreateCapsule(type);
      return;
    }
    const noteId = selectedNote.note_id || (selectedNote as any).id;
    const currentChunks = parseChunks(selectedNote.text, selectedNote.category || 'note');
    const newChunk: CapsuleChunk = {
      id: `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      text: '',
      created_at: new Date().toISOString(),
    };
    const updated = [...currentChunks, newChunk];
    const serialized = serializeChunks(updated);
    handleNoteTextInput(noteId, serialized);
    persistCapsuleChange(noteId, { text: serialized });

    setTimeout(() => {
      const el = document.getElementById(`chunk-textarea-${newChunk.id}`);
      if (el) el.focus();
    }, 60);
  };

  // Update text of a specific chunk
  const handleUpdateChunkText = (chunkId: string, text: string) => {
    if (!selectedNote) return;
    const noteId = selectedNote.note_id || (selectedNote as any).id;
    const currentChunks = parseChunks(selectedNote.text, selectedNote.category || 'note');
    const updated = currentChunks.map((c) => (c.id === chunkId ? { ...c, text } : c));
    const serialized = serializeChunks(updated);
    handleNoteTextInput(noteId, serialized);
  };

  // Change type of a chunk (Update, Idea, Note)
  const handleChangeChunkType = (chunkId: string, newType: CapsuleCategory) => {
    if (!selectedNote) return;
    const noteId = selectedNote.note_id || (selectedNote as any).id;
    const currentChunks = parseChunks(selectedNote.text, selectedNote.category || 'note');
    const updated = currentChunks.map((c) => (c.id === chunkId ? { ...c, type: newType } : c));
    const serialized = serializeChunks(updated);
    handleNoteTextInput(noteId, serialized);
    persistCapsuleChange(noteId, { text: serialized });
  };

  // Delete a specific chunk
  const handleDeleteChunk = (chunkId: string) => {
    if (!selectedNote) return;
    const noteId = selectedNote.note_id || (selectedNote as any).id;
    const currentChunks = parseChunks(selectedNote.text, selectedNote.category || 'note');
    const updated = currentChunks.filter((c) => c.id !== chunkId);
    const serialized = serializeChunks(updated);
    handleNoteTextInput(noteId, serialized);
    persistCapsuleChange(noteId, { text: serialized });
  };

  // Global & In-Modal Keyboard Shortcuts Listener (Alt+U for Update, Alt+I for Idea, Alt+N for Note)
  useEffect(() => {
    if (!focusedThreadId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Alt (Option on macOS)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          if (selectedNote) {
            handleAddChunk('update');
          } else {
            handleCreateCapsule('update');
          }
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          if (selectedNote) {
            handleAddChunk('idea');
          } else {
            handleCreateCapsule('idea');
          }
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          if (selectedNote) {
            handleAddChunk('note');
          } else {
            handleCreateCapsule('note');
          }
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
    const plain = getCapsulePlainText(note.text);
    const combined = note.title ? `${note.title}\n\n${plain}` : plain;
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
          <div className="w-11 h-11 rounded-full bg-purple-100/90 text-purple-600 flex items-center justify-center shrink-0">
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
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-[0_6px_16px_-4px_rgba(37,99,235,0.38)] cursor-pointer shrink-0 min-h-[44px]"
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
                    {getCapsulePlainText(notes[0].text).trim() || 'Empty capsule'}
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
          <ResizablePopupWrapper
            scope="threads"
            popupId="thread_detail"
            defaultWidth={1080}
            minWidth={640}
            maxWidth={1600}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: theme.colors.borderLight,
                borderRadius: '1.75rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
              className="w-full h-[92dvh] sm:h-[88vh] max-h-[920px] border flex flex-col overflow-hidden shadow-2xl relative"
            >
              {/* ========================================== */}
              {/* POPUP HEADER */}
              {/* ========================================== */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0 bg-white">
                {/* Left: Thread Title (Click to edit) */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-purple-100/90 text-purple-600 flex items-center justify-center shrink-0">
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

                {/* Right: Capsule Zoom Scale, Delete Thread, & Close */}
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
                      className="w-16 sm:w-20 h-1.5 bg-zinc-300 rounded-lg appearance-none cursor-pointer accent-zinc-900"
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

              {/* Mobile Tab Switcher (< md) */}
              <div className="flex md:hidden items-center border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileActivePane('list')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    mobileActivePane === 'list'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Capsules ({threadNotes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMobileActivePane('editor')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    mobileActivePane === 'editor'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Text Editor
                </button>
              </div>

              {/* ================================================================= */}
              {/* 2-PART SPLIT CONTAINER (CAPSULES AT LEFT, TEXT BOX AT RIGHT)      */}
              {/* ================================================================= */}
              <div
                ref={splitContainerRef}
                className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative"
              >
                {/* =============================================================== */}
                {/* LEFT PANE: CAPSULES LIST                                        */}
                {/* =============================================================== */}
                <div
                  style={{
                    width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${splitLeftWidth}px` : undefined,
                  }}
                  className={`${
                    mobileActivePane === 'list' ? 'flex' : 'hidden md:flex'
                  } flex-col border-r border-zinc-200/80 bg-zinc-50/70 shrink-0 h-full overflow-hidden`}
                >
                  {/* Left Pane Top: Search & Category Filter */}
                  <div className="p-3 border-b border-zinc-200/80 space-y-2 bg-white/60 shrink-0">
                    {/* In-Thread Fast Search + Small Round Plus Icon */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search capsules..."
                          value={searchNoteQuery}
                          onChange={(e) => setSearchNoteQuery(e.target.value)}
                          className="w-full pl-7 pr-6 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:border-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900 font-medium"
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

                      {/* Small Round Plus Icon Button */}
                      <button
                        type="button"
                        onClick={() => handleCreateCapsule('note')}
                        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_-2px_rgba(37,99,235,0.35)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="New Capsule (Alt+N)"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Filter Category Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter('all')}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          activeCategoryFilter === 'all'
                            ? 'bg-zinc-900 text-white'
                            : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                        }`}
                      >
                        All ({threadNotes.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter('update')}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          activeCategoryFilter === 'update'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        Updates ({updatesList.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter('idea')}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          activeCategoryFilter === 'idea'
                            ? 'bg-sky-600 text-white'
                            : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                        }`}
                      >
                        Ideas ({ideaList.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter('note')}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          activeCategoryFilter === 'note'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        Notes ({additionalNotesList.length})
                      </button>
                    </div>
                  </div>

                  {/* Capsules List (Vertical Stream) */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {filteredNotes.length === 0 ? (
                      <div
                        onClick={() => handleCreateCapsule('note')}
                        className="p-5 text-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white/60 hover:bg-white transition-all cursor-pointer space-y-1.5"
                      >
                        <Sparkles className="w-5 h-5 text-zinc-400 mx-auto" />
                        <p className="text-xs font-bold text-zinc-700">No capsules found</p>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          Click to create a capsule
                        </p>
                      </div>
                    ) : (
                      filteredNotes.map((note, idx) => {
                        const noteId = note.note_id || (note as any).id;
                        const isSelected = selectedNote && (selectedNote.note_id || (selectedNote as any).id) === noteId;
                        const palette = getNotePalette(note, idx);
                        const timeLabel = formatDateTimeWithHM(note.updated_at || note.created_at);
                        const plainPreview = getCapsulePlainText(note.text);
                        const chunks = parseChunks(note.text, note.category || 'note');
                        const upCount = chunks.filter((c) => c.type === 'update').length;
                        const idCount = chunks.filter((c) => c.type === 'idea').length;
                        const ntCount = chunks.filter((c) => c.type === 'note').length;

                        return (
                          <div
                            key={noteId}
                            onClick={() => {
                              setSelectedNoteId(noteId);
                              setMobileActivePane('editor');
                            }}
                            style={{
                              backgroundColor: isSelected ? '#FFFFFF' : palette.bgLight,
                              borderColor: isSelected ? palette.accent : 'transparent',
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer relative group flex flex-col gap-1.5 ${
                              isSelected
                                ? 'shadow-md ring-2 ring-purple-400/20'
                                : 'hover:shadow-xs hover:border-zinc-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  style={{ backgroundColor: palette.accent }}
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                />
                                <span className="text-xs font-bold text-zinc-900 truncate">
                                  {note.title || plainPreview.slice(0, 28) || 'Untitled Capsule'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNoteToDelete(note);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer shrink-0"
                                title="Delete capsule"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Snippet preview */}
                            <p className="text-[11px] text-zinc-500 font-medium line-clamp-1">
                              {plainPreview || 'Empty text box'}
                            </p>

                            {/* Bottom badges: category/chunks count & timestamp */}
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-black/5 text-[10px] text-zinc-400">
                              <div className="flex items-center gap-1">
                                {upCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                    {upCount} up
                                  </span>
                                )}
                                {idCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold">
                                    {idCount} idea
                                  </span>
                                )}
                                {ntCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                                    {ntCount} note
                                  </span>
                                )}
                                {chunks.length === 0 && (
                                  <span className="text-zinc-400">0 blocks</span>
                                )}
                              </div>
                              <span className="tabular-nums">{timeLabel}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Left Pane Footer Counter */}
                  <div className="px-3 py-2 border-t border-zinc-200/80 text-[10px] text-zinc-400 font-semibold flex items-center justify-between shrink-0 bg-white/40">
                    <span>{filteredNotes.length} capsules</span>
                    <span>Alt+U / Alt+I / Alt+N</span>
                  </div>
                </div>

                {/* =============================================================== */}
                {/* MOVABLE ADAPTIVE VERTICAL DIVIDER LINE                          */}
                {/* =============================================================== */}
                <div
                  onMouseDown={handleDividerMouseDown}
                  onTouchStart={handleDividerTouchStart}
                  className="hidden md:flex w-2.5 hover:w-3 bg-zinc-200/70 hover:bg-purple-300 active:bg-purple-500 cursor-col-resize transition-all items-center justify-center group select-none shrink-0 z-10 relative"
                  title="Drag to resize capsules panel"
                >
                  <div className="w-1 h-8 rounded-full bg-zinc-400 group-hover:bg-purple-700 transition-colors" />
                </div>

                {/* =============================================================== */}
                {/* RIGHT PANE: TEXT BOX CANVAS FOR SELECTED CAPSULE                */}
                {/* =============================================================== */}
                <div
                  className={`${
                    mobileActivePane === 'editor' ? 'flex' : 'hidden md:flex'
                  } flex-1 min-w-0 flex-col bg-white h-full overflow-hidden`}
                >
                  {selectedNote ? (
                    <>
                      {/* Top Header of Selected Capsule */}
                      <div className="px-4 sm:px-6 py-3 border-b border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/40 shrink-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Mobile Back Button */}
                          <button
                            type="button"
                            onClick={() => setMobileActivePane('list')}
                            className="md:hidden p-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 shrink-0"
                            title="Back to capsules list"
                          >
                            ←
                          </button>

                          {/* Capsule Title Input */}
                          <input
                            type="text"
                            value={selectedNote.title || ''}
                            onChange={(e) => {
                              const noteId = selectedNote.note_id || (selectedNote as any).id;
                              handleNoteTitleInput(noteId, e.target.value);
                            }}
                            onBlur={() => handleCapsuleBlur(selectedNote)}
                            placeholder="Capsule Title (optional)..."
                            className="font-black text-sm sm:text-base text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none w-full min-w-0 py-0.5 transition-colors placeholder:text-zinc-400 placeholder:font-normal"
                          />
                        </div>

                        {/* Top Right Badges & Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {saveStatusMap[selectedNote.note_id || (selectedNote as any).id] && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ {saveStatusMap[selectedNote.note_id || (selectedNote as any).id]}
                            </span>
                          )}

                          {/* Color Swatch Picker */}
                          <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-full border border-zinc-200">
                            {MILD_PALETTES.slice(0, 4).map((pal) => (
                              <button
                                key={pal.id}
                                type="button"
                                onClick={() => {
                                  const noteId = selectedNote.note_id || (selectedNote as any).id;
                                  handleCapsuleColorChange(noteId, pal.id);
                                }}
                                style={{ backgroundColor: pal.accent }}
                                className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                                  (selectedNote.color || 'lavender') === pal.id
                                    ? 'scale-125 ring-2 ring-white shadow-xs'
                                    : 'opacity-40 hover:opacity-100'
                                }`}
                                title={pal.name}
                              />
                            ))}
                          </div>

                          {/* Copy Capsule */}
                          <button
                            type="button"
                            onClick={() => handleCopyCapsule(selectedNote)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="Copy capsule"
                          >
                            {copiedNoteId === (selectedNote.note_id || (selectedNote as any).id) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete Capsule */}
                          <button
                            type="button"
                            onClick={() => setNoteToDelete(selectedNote)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete capsule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Scrollable Canvas for Capsule Text Blocks */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-zinc-50/30">
                        {(() => {
                          const chunks = parseChunks(selectedNote.text, selectedNote.category || 'note');

                          if (chunks.length === 0) {
                            return (
                              <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-200 rounded-3xl bg-white text-center space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200 shadow-xs flex items-center justify-center text-zinc-400">
                                  <Sparkles className="w-6 h-6 text-purple-500" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                  <h4 className="text-sm font-bold text-zinc-800">
                                    Text box is empty
                                  </h4>
                                  <p className="text-xs text-zinc-500 font-medium">
                                    Add a categorized capsule below to write your update, idea, or note instead of plain text.
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddChunk('update')}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <Rocket className="w-3.5 h-3.5" />
                                    <span>+ Update</span>
                                    <kbd className="text-[10px] bg-emerald-800/40 px-1 py-0.5 rounded font-mono">
                                      Alt+U
                                    </kbd>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddChunk('idea')}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    <span>+ Idea</span>
                                    <kbd className="text-[10px] bg-sky-800/40 px-1 py-0.5 rounded font-mono">
                                      Alt+I
                                    </kbd>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddChunk('note')}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>+ Note</span>
                                    <kbd className="text-[10px] bg-purple-800/40 px-1 py-0.5 rounded font-mono">
                                      Alt+N
                                    </kbd>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4">
                              {chunks.map((chunk, cIdx) => {
                                const detectedLinks = extractAllLinks(chunk.text || '');

                                // Styling by chunk category
                                const chunkStyle =
                                  chunk.type === 'update'
                                    ? {
                                        bg: 'bg-emerald-50/70',
                                        border: 'border-emerald-200/90',
                                        badgeBg: 'bg-emerald-100 text-emerald-800',
                                        badgeBorder: 'border-emerald-200',
                                        icon: <Rocket className="w-3 h-3 text-emerald-700" />,
                                        label: 'Update',
                                        placeholder: 'Write update text (milestone, changelog, progress)...',
                                      }
                                    : chunk.type === 'idea'
                                    ? {
                                        bg: 'bg-sky-50/70',
                                        border: 'border-sky-200/90',
                                        badgeBg: 'bg-sky-100 text-sky-800',
                                        badgeBorder: 'border-sky-200',
                                        icon: <Lightbulb className="w-3 h-3 text-sky-700" />,
                                        label: 'Idea',
                                        placeholder: 'Write idea text (concept, spark, brainstorm)...',
                                      }
                                    : {
                                        bg: 'bg-purple-50/70',
                                        border: 'border-purple-200/90',
                                        badgeBg: 'bg-purple-100 text-purple-800',
                                        badgeBorder: 'border-purple-200',
                                        icon: <FileText className="w-3 h-3 text-purple-700" />,
                                        label: 'Note',
                                        placeholder: 'Write note text (scratchpad, reference, details)...',
                                      };

                                return (
                                  <div
                                    key={chunk.id}
                                    style={{
                                      padding: computedCapsuleStyle.padding,
                                      borderRadius: computedCapsuleStyle.borderRadius,
                                    }}
                                    className={`border transition-all duration-200 flex flex-col space-y-2 group shadow-2xs hover:shadow-xs ${chunkStyle.bg} ${chunkStyle.border}`}
                                  >
                                    {/* Chunk Header */}
                                    <div className="flex items-center justify-between gap-2 shrink-0">
                                      {/* Type Selector Pill */}
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${chunkStyle.badgeBg} ${chunkStyle.badgeBorder}`}
                                        >
                                          {chunkStyle.icon}
                                          <span>{chunkStyle.label}</span>
                                        </span>

                                        {/* Quick Type Switchers */}
                                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                          {chunk.type !== 'update' && (
                                            <button
                                              type="button"
                                              onClick={() => handleChangeChunkType(chunk.id, 'update')}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                              title="Switch to Update"
                                            >
                                              → Update
                                            </button>
                                          )}
                                          {chunk.type !== 'idea' && (
                                            <button
                                              type="button"
                                              onClick={() => handleChangeChunkType(chunk.id, 'idea')}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-sky-700 hover:bg-sky-100 cursor-pointer"
                                              title="Switch to Idea"
                                            >
                                              → Idea
                                            </button>
                                          )}
                                          {chunk.type !== 'note' && (
                                            <button
                                              type="button"
                                              onClick={() => handleChangeChunkType(chunk.id, 'note')}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-purple-700 hover:bg-purple-100 cursor-pointer"
                                              title="Switch to Note"
                                            >
                                              → Note
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Chunk Actions */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(chunk.text);
                                            setCopiedNoteId(chunk.id);
                                            setTimeout(() => setCopiedNoteId(null), 1500);
                                          }}
                                          className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors cursor-pointer"
                                          title="Copy chunk text"
                                        >
                                          {copiedNoteId === chunk.id ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteChunk(chunk.id)}
                                          className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                          title="Delete chunk"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Chunk Textarea */}
                                    <textarea
                                      id={`chunk-textarea-${chunk.id}`}
                                      rows={Math.max(2, Math.min(10, (chunk.text.match(/\n/g) || []).length + 2))}
                                      value={chunk.text}
                                      onChange={(e) => handleUpdateChunkText(chunk.id, e.target.value)}
                                      onBlur={() => handleCapsuleBlur(selectedNote)}
                                      placeholder={chunkStyle.placeholder}
                                      style={{
                                        fontSize: computedCapsuleStyle.bodyFontSize,
                                      }}
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-y text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal leading-relaxed"
                                    />

                                    {/* Detected Links Preview */}
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
                              })}

                              {/* Bottom Append Buttons */}
                              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-zinc-100">
                                <span className="text-[11px] font-bold text-zinc-400">Append chunk:</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddChunk('update')}
                                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 transition-all cursor-pointer min-h-[30px]"
                                >
                                  <Rocket className="w-3 h-3 text-emerald-600" />
                                  <span>+ Update</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddChunk('idea')}
                                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1 transition-all cursor-pointer min-h-[30px]"
                                >
                                  <Lightbulb className="w-3 h-3 text-sky-600" />
                                  <span>+ Idea</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddChunk('note')}
                                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 transition-all cursor-pointer min-h-[30px]"
                                >
                                  <FileText className="w-3 h-3 text-purple-600" />
                                  <span>+ Note</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-zinc-800">No capsule selected</h4>
                      <p className="text-xs text-zinc-500 max-w-xs">
                        Select a capsule from the left or create a new one to begin editing.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCreateCapsule('note')}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
                      >
                        + Create Capsule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ResizablePopupWrapper>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE NEW THREAD BOX */}
      {/* ========================================== */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <ResizablePopupWrapper
            scope="threads"
            popupId="new_thread"
            defaultWidth={500}
            minWidth={380}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '1.5rem',
                border: `1px solid ${theme.colors.borderLight}`,
                boxShadow: theme.shadows.lg,
              }}
              className="w-full p-5 sm:p-6 space-y-4"
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
          </ResizablePopupWrapper>
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
