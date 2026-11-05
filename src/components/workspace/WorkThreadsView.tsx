import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { WorkThread, ThreadNote } from '../../types/workspace';
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
  GripVertical,
  ChevronRight,
  Edit3,
  Sliders,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks, extractAllLinks } from '../../lib/linkUtils';

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
  if (note.cmyk_color) {
    if (note.cmyk_color === 'cyan') return MILD_PALETTES[1];
    if (note.cmyk_color === 'magenta') return MILD_PALETTES[3];
    if (note.cmyk_color === 'yellow') return MILD_PALETTES[4];
    if (note.cmyk_color === 'key') return MILD_PALETTES[7];
  }
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

  // Active Selected Note inside the open Thread Popup
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Note editor form fields
  const [noteTitleInput, setNoteTitleInput] = useState<string>('');
  const [noteBodyInput, setNoteBodyInput] = useState<string>('');
  const [noteColorInput, setNoteColorInput] = useState<string>('mint');

  // Search inside thread notes
  const [searchNoteQuery, setSearchNoteQuery] = useState('');

  // Draggable Split Ratio (% of left note editor width vs. right capsules)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('work_threads_split_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 30 && val <= 75) return val;
      }
    } catch {}
    return 60; // 60% left editor, 40% right capsules
  });

  // Draggable Unlimited Flexible Capsule Scale (0.75x to 1.5x)
  const [capsuleScale, setCapsuleScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('work_threads_capsule_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.75 && val <= 1.5) return val;
      }
    } catch {}
    return 1.0;
  });

  // Mobile layout tab inside popup: 'editor' | 'capsules'
  const [popupMobileTab, setPopupMobileTab] = useState<'editor' | 'capsules'>('editor');

  // New Thread Modal & Edit Thread Title
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [editingThreadTitle, setEditingThreadTitle] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState('');

  // Dedicated Delete Confirmation States (Own UI, no window.confirm)
  const [noteToDelete, setNoteToDelete] = useState<ThreadNote | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<WorkThread | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [copiedNote, setCopiedNote] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);

  // Refs for note textarea and live blue links overlay
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteOverlayRef = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitterRef = useRef<boolean>(false);

  const handleNoteBodyScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (noteOverlayRef.current) {
      noteOverlayRef.current.scrollTop = e.currentTarget.scrollTop;
      noteOverlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // 1. Subscribe to Firestore Work Threads
  useEffect(() => {
    if (!user) return;
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

  // Handle Capsule Scale Changes (Unlimited flexible bar)
  const handleScaleChange = (val: number) => {
    const clamped = Math.max(0.75, Math.min(1.5, val));
    setCapsuleScale(clamped);
    try {
      localStorage.setItem('work_threads_capsule_scale', clamped.toString());
    } catch {}
  };

  // Draggable Splitter Handler
  const handleStartSplitterDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingSplitterRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDraggingSplitterRef.current || !modalBodyRef.current) return;
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const rect = modalBodyRef.current.getBoundingClientRect();
      const currentWidth = rect.width;
      if (currentWidth <= 0) return;

      const rawRatio = ((clientX - rect.left) / currentWidth) * 100;
      const clamped = Math.max(30, Math.min(75, Math.round(rawRatio)));
      setSplitRatio(clamped);
      try {
        localStorage.setItem('work_threads_split_ratio', clamped.toString());
      } catch {}
    };

    const onPointerUp = () => {
      isDraggingSplitterRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);
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

  // Filtered threads in the main grid
  const filteredThreads = useMemo(() => {
    if (!searchThreadQuery.trim()) return threads;
    const q = searchThreadQuery.toLowerCase().trim();
    return threads.filter((t) => (t.title || '').toLowerCase().includes(q));
  }, [threads, searchThreadQuery]);

  // Detected links in current active note (both title & body)
  const activeNoteDetectedLinks = useMemo(() => {
    const combined = `${noteTitleInput} ${noteBodyInput}`;
    return extractAllLinks(combined);
  }, [noteTitleInput, noteBodyInput]);

  // When focused thread changes, initialize active note
  useEffect(() => {
    if (focusedThread) {
      setThreadTitleDraft(focusedThread.title || '');
      setEditingThreadTitle(false);
      setSearchNoteQuery('');
      setPopupMobileTab('editor');

      const notes = focusedThread.notes_list || [];
      if (notes.length > 0) {
        const newest = [...notes].sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        })[0];
        setActiveNoteId(newest.note_id);
        setNoteTitleInput(newest.title || '');
        setNoteBodyInput(newest.text || '');
        const pal = getNotePalette(newest, 0);
        setNoteColorInput(pal.id);
      } else {
        setActiveNoteId(null);
        setNoteTitleInput('');
        setNoteBodyInput('');
        setNoteColorInput(MILD_PALETTES[0].id);
      }
    } else {
      setActiveNoteId(null);
    }
  }, [focusedThreadId]);

  // Sync active note form when activeNoteId changes
  useEffect(() => {
    if (!focusedThread || !activeNoteId) return;
    const notes = focusedThread.notes_list || [];
    const idx = notes.findIndex((n) => n.note_id === activeNoteId);
    const currentNote = notes[idx];
    if (currentNote) {
      setNoteTitleInput(currentNote.title || '');
      setNoteBodyInput(currentNote.text || '');
      const pal = getNotePalette(currentNote, idx >= 0 ? idx : 0);
      setNoteColorInput(pal.id);
    }
  }, [activeNoteId, focusedThread]);

  // Register hardware/back button handler when modal/confirmation is open
  useEffect(() => {
    return registerBackHandler(() => {
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
  }, [noteToDelete, threadToDelete, showNewThreadModal, focusedThreadId, registerBackHandler]);

  // Helper to persist note changes to Firestore
  const saveNoteDebouncedRef = useRef<NodeJS.Timeout | null>(null);

  const persistCurrentNote = (
    noteId: string,
    title: string,
    text: string,
    colorId: string
  ) => {
    if (!focusedThread || !user) return;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    // Freshest list from threads state
    const currentThread = threads.find((t) => (t.id || t.thread_id) === threadDocId);
    const existingList = currentThread?.notes_list || focusedThread.notes_list || [];

    // Safety: If note was deleted while typing, do not revive it!
    const noteExists = existingList.some((n) => (n.note_id || (n as any).id) === noteId);
    if (!noteExists) return;

    const nowIso = new Date().toISOString();
    const updatedList = existingList.map((n) => {
      if ((n.note_id || (n as any).id) === noteId) {
        return {
          ...n,
          title: title.trim(),
          text,
          color: colorId,
          updated_at: nowIso,
        };
      }
      return n;
    });

    // Optimistically update threads state immediately
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

    setSaveIndicator('Saved');
    setTimeout(() => setSaveIndicator(null), 1800);
  };

  // Handle note body change with fast typing
  const handleBodyChange = (newBody: string) => {
    setNoteBodyInput(newBody);
    if (!activeNoteId) return;

    if (saveNoteDebouncedRef.current) {
      clearTimeout(saveNoteDebouncedRef.current);
    }
    saveNoteDebouncedRef.current = setTimeout(() => {
      persistCurrentNote(activeNoteId, noteTitleInput, newBody, noteColorInput);
    }, 400);
  };

  // Handle note title change
  const handleTitleChange = (newTitle: string) => {
    setNoteTitleInput(newTitle);
    if (!activeNoteId) return;

    if (saveNoteDebouncedRef.current) {
      clearTimeout(saveNoteDebouncedRef.current);
    }
    saveNoteDebouncedRef.current = setTimeout(() => {
      persistCurrentNote(activeNoteId, newTitle, noteBodyInput, noteColorInput);
    }, 400);
  };

  // Handle changing note color
  const handleColorChange = (newColorId: string) => {
    setNoteColorInput(newColorId);
    if (activeNoteId) {
      persistCurrentNote(activeNoteId, noteTitleInput, noteBodyInput, newColorId);
    }
  };

  // Create a brand new Note inside focused thread (different mild color each time)
  const handleCreateNote = async () => {
    if (!focusedThread || !user) return;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    const existingList = focusedThread.notes_list || [];

    // Automatically pick the next vibrant mild color in rotation
    const nextPalette = MILD_PALETTES[existingList.length % MILD_PALETTES.length];
    const newNoteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newNote: ThreadNote = {
      note_id: newNoteId,
      title: '',
      text: '',
      created_at: nowIso,
      updated_at: nowIso,
      color: nextPalette.id,
    };

    // Prepend so newest note is at the top
    const updatedList = [newNote, ...existingList];

    try {
      await updateDoc(doc(db, 'work_threads', threadDocId), {
        notes_list: updatedList,
        updated_at: nowIso,
      });
      setActiveNoteId(newNoteId);
      setNoteTitleInput('');
      setNoteBodyInput('');
      setNoteColorInput(nextPalette.id);
      setPopupMobileTab('editor');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_threads/${threadDocId}`);
    }
  };

  // Confirmed Delete Note Handler (executed after user confirms in Custom Modal UI)
  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete || !focusedThread || !user) return;
    const noteId = noteToDelete.note_id || (noteToDelete as any).id;
    const threadDocId = focusedThread.id || focusedThread.thread_id;
    const currentThread = threads.find((t) => (t.id || t.thread_id) === threadDocId);
    const existingList = currentThread?.notes_list || focusedThread.notes_list || [];
    const updatedList = existingList.filter(
      (n) => (n.note_id || (n as any).id) !== noteId
    );
    const nowIso = new Date().toISOString();

    // 1. Clear any pending debounced autosave immediately
    if (saveNoteDebouncedRef.current) {
      clearTimeout(saveNoteDebouncedRef.current);
      saveNoteDebouncedRef.current = null;
    }

    setIsDeleting(true);

    // 2. Optimistic update to React state: note disappears instantly
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

    // 3. If active note was deleted, transition to next newest note or empty state
    if (activeNoteId === noteId) {
      if (updatedList.length > 0) {
        const sorted = [...updatedList].sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });
        const next = sorted[0];
        const nextId = next.note_id || (next as any).id;
        setActiveNoteId(nextId);
        setNoteTitleInput(next.title || '');
        setNoteBodyInput(next.text || '');
        const pal = getNotePalette(next, 0);
        setNoteColorInput(pal.id);
      } else {
        setActiveNoteId(null);
        setNoteTitleInput('');
        setNoteBodyInput('');
      }
    }

    // 4. Close the confirmation modal
    setNoteToDelete(null);

    // 5. Persist to Firestore
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

  // Confirmed Delete Thread Handler (executed after user confirms in Custom Modal UI)
  const handleConfirmDeleteThread = async () => {
    if (!threadToDelete || !user) return;
    const threadDocId = threadToDelete.id || threadToDelete.thread_id;
    setIsDeleting(true);

    // Optimistic removal from state
    setThreads((prev) => prev.filter((t) => (t.id || t.thread_id) !== threadDocId));
    if (focusedThreadId === threadDocId) {
      setFocusedThreadId(null);
      setActiveNoteId(null);
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

  // Copy note text to clipboard
  const handleCopyNote = async () => {
    const fullText = noteTitleInput ? `${noteTitleInput}\n\n${noteBodyInput}` : noteBodyInput;
    if (!fullText.trim()) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 1600);
    } catch {}
  };

  // Create a new Thread from Main View
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newThreadTitle.trim()) return;

    const threadId = `thread_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const initialNote: ThreadNote = {
      note_id: `note_${Date.now()}_1`,
      title: 'First Thought',
      text: 'Start typing your thoughts, notes, and ideas here...',
      created_at: nowIso,
      updated_at: nowIso,
      color: MILD_PALETTES[0].id,
    };

    const payload: WorkThread = {
      thread_id: threadId,
      owner_uid: user.uid,
      title: newThreadTitle.trim(),
      notes_list: [initialNote],
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await setDoc(doc(db, 'work_threads', threadId), payload);
      setNewThreadTitle('');
      setShowNewThreadModal(false);
      setFocusedThreadId(threadId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `work_threads/${threadId}`);
    }
  };

  // Save renamed thread title
  const handleSaveThreadTitle = async () => {
    if (!focusedThread || !user || !threadTitleDraft.trim()) return;
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

  // Dynamically computed styling properties based on the continuous drag scale bar
  const computedCapsuleStyle = useMemo(() => {
    const s = capsuleScale;
    const padY = Math.round(12 * s);
    const padX = Math.round(16 * s);
    const radius = Math.round(22 * s);
    const titlePx = Math.round(14 * s);
    const bodyPx = Math.round(13 * s);
    const lineClamp = s < 0.88 ? 2 : s > 1.25 ? 4 : 3;

    return {
      padding: `${padY}px ${padX}px`,
      borderRadius: `${radius}px`,
      titleFontSize: `${titlePx}px`,
      bodyFontSize: `${bodyPx}px`,
      lineClampClass: lineClamp === 2 ? 'line-clamp-2' : lineClamp === 4 ? 'line-clamp-4' : 'line-clamp-3',
    };
  }, [capsuleScale]);

  // Current active note object
  const currentActiveNote = useMemo(() => {
    return threadNotes.find((n) => n.note_id === activeNoteId) || null;
  }, [threadNotes, activeNoteId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================== */}
      {/* MAIN VIEW: HEADER & SEARCH */}
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
              Click any thread box to open its contents and colorful capsule notes
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
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
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

          // Get preview mild palettes from the notes inside
          const colorPreviews = notes.slice(0, 5).map((n, idx) => getNotePalette(n, idx));

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
                {/* Header: Title + Capsule Count + Custom UI Delete Trigger */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-zinc-900 group-hover:text-purple-600 transition-colors truncate">
                      {thread.title || 'Untitled Thread'}
                    </h3>
                    <p className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                      {noteCount} {noteCount === 1 ? 'capsule note' : 'capsule notes'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreadToDelete(thread);
                    }}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Soft Color Swatch Halo Dots & Preview */}
                {noteCount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      {colorPreviews.map((pal, idx) => (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: pal.accent,
                            boxShadow: `0 0 8px ${pal.accent}50`,
                          }}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          title={pal.name}
                        />
                      ))}
                      {noteCount > 5 && (
                        <span className="text-[10px] font-bold text-zinc-400 pl-0.5">
                          +{noteCount - 5}
                        </span>
                      )}
                    </div>

                    {/* Preview of latest note snippet in bold */}
                    {notes[0] && (
                      <p className="text-xs font-bold text-zinc-600 line-clamp-2 leading-relaxed">
                        {notes[0].title ? `${notes[0].title} — ` : ''}
                        {notes[0].text.trim() || 'Empty note'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-dashed border-zinc-200 text-center text-xs font-semibold text-zinc-400">
                    No notes yet. Click to add capsules!
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
          className="p-5 border-2 border-dashed hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 min-h-[195px] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-white text-zinc-400 group-hover:text-zinc-900 group-hover:scale-105 transition-all flex items-center justify-center border border-zinc-200 shadow-2xs">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-zinc-700 group-hover:text-zinc-900">
            Create New Thread
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            Start a new thread box with colorful capsules
          </span>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* POPUP MODAL: MAIN CONTENTS (NOTE CANVAS ON LEFT, CAPSULES ON RIGHT)   */}
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
            className="w-full max-w-6xl h-[92vh] max-h-[880px] border flex flex-col overflow-hidden shadow-2xl relative"
          >
            {/* ========================================== */}
            {/* POPUP HEADER */}
            {/* ========================================== */}
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0 bg-white">
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
                      · {threadNotes.length} notes
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Draggable Capsule Resizing Bar & Close Button */}
              <div className="flex items-center gap-4 shrink-0">
                {/* Draggable Fluid Capsule Resizing Bar */}
                <div className="flex items-center gap-2 bg-zinc-100/80 px-3 py-1.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-zinc-500" />
                    <span className="hidden sm:inline">Capsule Zoom:</span>
                  </span>
                  <input
                    type="range"
                    min="0.75"
                    max="1.45"
                    step="0.02"
                    value={capsuleScale}
                    onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 bg-zinc-300 rounded-lg appearance-none cursor-pointer accent-zinc-900"
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

            {/* Mobile Tab Toggle inside Popup */}
            <div className="flex md:hidden items-center p-1 bg-zinc-100 border-b border-zinc-200 shrink-0">
              <button
                type="button"
                onClick={() => setPopupMobileTab('editor')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  popupMobileTab === 'editor' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                }`}
              >
                Note Editor
              </button>
              <button
                type="button"
                onClick={() => setPopupMobileTab('capsules')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  popupMobileTab === 'capsules' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                }`}
              >
                Capsules ({threadNotes.length})
              </button>
            </div>

            {/* ================================================================= */}
            {/* POPUP MAIN BODY: DUAL PANE WITH FLEXIBLE DRAGGABLE DIVIDER        */}
            {/* LEFT: NOTE WRITING CANVAS | RIGHT: CAPSULES STREAM                 */}
            {/* ================================================================= */}
            <div
              ref={modalBodyRef}
              className="flex-1 flex overflow-hidden relative select-auto bg-zinc-50/30"
            >
              {/* ========================================== */}
              {/* LEFT PANE: NOTE WRITING CANVAS             */}
              {/* ========================================== */}
              <div
                style={{
                  width: `${splitRatio}%`,
                }}
                className={`flex flex-col h-full bg-white p-5 sm:p-6 overflow-hidden ${
                  popupMobileTab === 'capsules' ? 'hidden md:flex' : 'flex'
                }`}
              >
                {activeNoteId && currentActiveNote ? (
                  <div className="flex-1 flex flex-col justify-between space-y-4 overflow-hidden">
                    <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                      {/* Note Header Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 shrink-0">
                        {/* Mild Color Swatch Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Tint:
                          </span>
                          <div className="flex items-center gap-1.5 bg-zinc-50 p-1.5 rounded-full border border-zinc-200">
                            {MILD_PALETTES.map((pal) => {
                              const isChosen = noteColorInput === pal.id;
                              return (
                                <button
                                  key={pal.id}
                                  type="button"
                                  onClick={() => handleColorChange(pal.id)}
                                  style={{
                                    backgroundColor: pal.accent,
                                    boxShadow: isChosen ? `0 0 10px ${pal.accent}` : 'none',
                                  }}
                                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                                    isChosen ? 'scale-125 ring-2 ring-white ring-offset-1' : 'opacity-65 hover:opacity-100'
                                  }`}
                                  title={pal.name}
                                />
                              );
                            })}
                          </div>

                          {/* Save Status Indicator */}
                          {saveIndicator && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              ✓ {saveIndicator}
                            </span>
                          )}
                        </div>

                        {/* Right: Copy & Delete Actions with Custom UI Confirmation */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyNote}
                            disabled={!noteBodyInput.trim() && !noteTitleInput.trim()}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            title="Copy note text"
                          >
                            {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                            <span className="hidden sm:inline">{copiedNote ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (currentActiveNote) {
                                setNoteToDelete({
                                  ...currentActiveNote,
                                  title: noteTitleInput,
                                  text: noteBodyInput,
                                  color: noteColorInput,
                                });
                              } else if (activeNoteId) {
                                setNoteToDelete({
                                  note_id: activeNoteId,
                                  title: noteTitleInput,
                                  text: noteBodyInput,
                                  created_at: new Date().toISOString(),
                                  color: noteColorInput,
                                });
                              }
                            }}
                            disabled={!activeNoteId}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            title="Delete this capsule note"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional Title Input */}
                      <div className="shrink-0">
                        <input
                          type="text"
                          value={noteTitleInput}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="Note title (optional)..."
                          className="w-full bg-transparent text-xl sm:text-2xl font-black text-zinc-900 placeholder:text-zinc-300 focus:outline-none border-b border-transparent focus:border-zinc-200 pb-1.5 transition-colors"
                        />
                      </div>

                      {/* Detected Links Quick Access Bar (Always visible whenever note contains links) */}
                      {activeNoteDetectedLinks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 shrink-0">
                          <div className="flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-wider pl-1 pr-1 shrink-0">
                            <Link2 className="w-3.5 h-3.5 text-[#2563eb]" />
                            <span>Links ({activeNoteDetectedLinks.length}):</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {activeNoteDetectedLinks.map((link) => (
                              <LinkWithPreview
                                key={link.id}
                                url={link.url}
                                domain={link.domain}
                                path={link.path}
                                variant="badge"
                                stopPropagation={true}
                              >
                                <span className="max-w-[170px] truncate text-[#2563eb] font-bold">{link.domain}{link.path ? link.path.slice(0, 14) : ''}</span>
                              </LinkWithPreview>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Live Interactive Note Typing Canvas (Links ALWAYS visible in bright blue & clickable) */}
                      <div className="flex-1 relative min-h-0 w-full overflow-hidden">
                        {/* Layer 1: Textarea for native typing, caret, and selection */}
                        <textarea
                          ref={textareaRef}
                          value={noteBodyInput}
                          onChange={(e) => handleBodyChange(e.target.value)}
                          onScroll={handleNoteBodyScroll}
                          placeholder="Type your thoughts freely. Links will automatically appear in bright blue..."
                          className="absolute inset-0 w-full h-full p-2 bg-transparent text-sm sm:text-base leading-relaxed text-transparent caret-zinc-900 placeholder:text-zinc-300 focus:outline-none resize-none font-sans font-medium whitespace-pre-wrap break-words select-text selection:bg-blue-200/60 selection:text-transparent z-10"
                          spellCheck={false}
                        />

                        {/* Layer 2: Real-time visual overlay (Regular text in zinc-800, Links in bright blue with hover preview & click) */}
                        <div
                          ref={noteOverlayRef}
                          className="absolute inset-0 w-full h-full p-2 pointer-events-none overflow-hidden text-sm sm:text-base leading-relaxed font-sans font-medium whitespace-pre-wrap break-words z-20"
                        >
                          {noteBodyInput.length > 0 ? (
                            <>
                              {tokenizeTextWithLinks(noteBodyInput).map((token, i) =>
                                token.type === 'link' && token.url ? (
                                  <LinkWithPreview
                                    key={`${token.url}-${i}`}
                                    url={token.url}
                                    domain={token.domain}
                                    path={token.path}
                                    variant="inline"
                                    className="pointer-events-auto !text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8] transition-all cursor-pointer"
                                    stopPropagation={true}
                                  >
                                    {token.content}
                                  </LinkWithPreview>
                                ) : (
                                  <span key={i} className="text-zinc-800">
                                    {token.content}
                                  </span>
                                )
                              )}
                              {noteBodyInput.endsWith('\n') && <span className="invisible">&#8203;</span>}
                            </>
                          ) : (
                            <span className="text-zinc-300 italic pointer-events-none select-none">
                              Type your thoughts freely. Instant capture without formatting clutter...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Counts & Status */}
                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400 shrink-0">
                      <span className="tabular-nums font-semibold">
                        {noteBodyInput.trim().split(/\s+/).filter(Boolean).length} words • {noteBodyInput.length} chars
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400">
                        Auto-saved in real-time
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center">
                      <Edit3 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-800">No Note Selected</h3>
                    <p className="text-xs text-zinc-400 max-w-sm">
                      Select a colorful capsule on the right or create a new note to start typing.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateNote()}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      + Create New Note
                    </button>
                  </div>
                )}
              </div>

              {/* ====================================================================== */}
              {/* DRAGGABLE DIVIDER SPLITTER (WITH BUTTON HANDLE TO RESIZE WIDTH RATIO)  */}
              {/* ====================================================================== */}
              <div
                onMouseDown={handleStartSplitterDrag}
                onTouchStart={handleStartSplitterDrag}
                className="hidden md:flex relative items-center justify-center w-2 hover:w-2.5 bg-zinc-200 hover:bg-purple-400 active:bg-purple-600 transition-colors cursor-col-resize shrink-0 z-20 group select-none"
                title="Drag to flexibly resize editor and capsules width ratio"
              >
                {/* Centered Small Draggable Button Handle */}
                <div className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-full bg-white border border-zinc-300 group-hover:border-purple-400 shadow-md flex items-center justify-center cursor-col-resize transition-transform group-hover:scale-105 active:scale-95">
                  <GripVertical className="w-3 h-3 text-zinc-400 group-hover:text-purple-600" />
                </div>
              </div>

              {/* ========================================== */}
              {/* RIGHT PANE: CAPSULES STREAM (MILDLY COLORFUL, NO OUTLINES) */}
              {/* ========================================== */}
              <div
                style={{
                  width: `${100 - splitRatio}%`,
                }}
                className={`flex flex-col h-full bg-zinc-50/50 overflow-hidden ${
                  popupMobileTab === 'editor' ? 'hidden md:flex' : 'flex w-full md:w-auto'
                }`}
              >
                {/* Search & Fast Add Note CTA */}
                <div className="p-3.5 border-b border-zinc-200/80 space-y-2.5 shrink-0 bg-white/70 backdrop-blur-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">
                      Capsules
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCreateNote()}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Add new colorful capsule note"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Note</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search capsules..."
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

                {/* Vertical Stream of Mildly Colorful Capsules */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                  {filteredNotes.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 space-y-2 border border-dashed border-zinc-200 rounded-2xl bg-white/50">
                      <Sparkles className="w-6 h-6 text-zinc-300 mx-auto" />
                      <p className="text-xs font-bold text-zinc-600">No capsules found</p>
                      <p className="text-[11px] text-zinc-400">
                        {searchNoteQuery ? 'Try another search term' : 'Click "+ Note" to capture your thoughts!'}
                      </p>
                      {!searchNoteQuery && (
                        <button
                          type="button"
                          onClick={() => handleCreateNote()}
                          className="mt-2 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          Create First Capsule
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredNotes.map((note, idx) => {
                      const isActive = note.note_id === activeNoteId;
                      const palette = getNotePalette(note, idx);
                      const timeLabel = formatDateTimeWithHM(note.updated_at || note.created_at);

                      return (
                        <div
                          key={note.note_id}
                          onClick={() => {
                            setActiveNoteId(note.note_id);
                            setPopupMobileTab('editor');
                          }}
                          style={{
                            padding: computedCapsuleStyle.padding,
                            borderRadius: computedCapsuleStyle.borderRadius,
                            border: 'none',
                            outline: 'none',
                            backgroundColor: isActive ? palette.bgActive : palette.bgLight,
                            boxShadow: isActive ? palette.activeGlow : palette.glowShadow,
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                          className={`cursor-pointer relative overflow-hidden group select-none ${
                            isActive ? 'scale-[1.01]' : 'hover:scale-[1.008]'
                          }`}
                        >
                          <div className="space-y-1.5">
                            {/* Top Row: Radiant Dot + Bold Title + Time + Direct Delete Trigger */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  style={{
                                    backgroundColor: palette.accent,
                                    boxShadow: `0 0 6px ${palette.accent}`,
                                  }}
                                  className="w-2 h-2 rounded-full shrink-0"
                                />

                                {/* Note Title in BOLD (with links support) */}
                                {note.title ? (
                                  <h4
                                    style={{
                                      fontSize: computedCapsuleStyle.titleFontSize,
                                      color: palette.textTitle,
                                    }}
                                    className="font-black truncate tracking-tight"
                                  >
                                    {tokenizeTextWithLinks(note.title).map((token, i) =>
                                      token.type === 'link' && token.url ? (
                                        <LinkWithPreview
                                          key={`${token.url}-${i}`}
                                          url={token.url}
                                          domain={token.domain}
                                          path={token.path}
                                          variant="capsule"
                                          className="!text-[#2563eb] hover:!text-[#1d4ed8] font-black !underline !decoration-[#3b82f6]"
                                          stopPropagation={true}
                                        >
                                          {token.content}
                                        </LinkWithPreview>
                                      ) : (
                                        <React.Fragment key={i}>{token.content}</React.Fragment>
                                      )
                                    )}
                                  </h4>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: computedCapsuleStyle.titleFontSize,
                                      color: palette.textMuted,
                                    }}
                                    className="font-bold italic truncate opacity-75"
                                  >
                                    Untitled Note
                                  </span>
                                )}
                              </div>

                              {/* Timestamp and In-Capsule Delete Trigger */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  style={{
                                    color: palette.textMuted,
                                  }}
                                  className="text-[10px] font-bold tabular-nums opacity-85"
                                >
                                  {timeLabel}
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (activeNoteId === (note.note_id || (note as any).id)) {
                                      setNoteToDelete({
                                        ...note,
                                        title: noteTitleInput,
                                        text: noteBodyInput,
                                        color: noteColorInput,
                                      });
                                    } else {
                                      setNoteToDelete(note);
                                    }
                                  }}
                                  style={{
                                    color: palette.textMuted,
                                    backgroundColor: `${palette.accent}20`,
                                  }}
                                  className="p-1 rounded-md hover:text-rose-600 hover:bg-rose-100/90 transition-all cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100"
                                  title="Delete note capsule"
                                >
                                  <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                </button>
                              </div>
                            </div>

                            {/* 3-4 Lines Clamped Note Text Preview in BOLD with Vibrant Blue Clickable Links */}
                            <p
                              style={{
                                fontSize: computedCapsuleStyle.bodyFontSize,
                                color: palette.textBody,
                              }}
                              className={`font-bold whitespace-pre-wrap leading-relaxed ${computedCapsuleStyle.lineClampClass}`}
                            >
                              {note.text.trim() ? (
                                tokenizeTextWithLinks(note.text).map((token, i) =>
                                  token.type === 'link' && token.url ? (
                                    <LinkWithPreview
                                      key={`${token.url}-${i}`}
                                      url={token.url}
                                      domain={token.domain}
                                      path={token.path}
                                      variant="capsule"
                                      className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                                      stopPropagation={true}
                                    >
                                      {token.content}
                                    </LinkWithPreview>
                                  ) : (
                                    <React.Fragment key={i}>{token.content}</React.Fragment>
                                  )
                                )
                              ) : (
                                <span className="opacity-40 font-normal italic">Empty note. Click to type...</span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 focus:outline-none text-zinc-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl transition-colors shadow-2xs cursor-pointer"
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
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/80 shadow-2xs">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                title="Cancel and close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">
                Delete Note Capsule?
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Are you sure you want to delete this capsule note? This action is permanent and cannot be undone.
              </p>
            </div>

            {/* Dedicated Capsule Preview Card */}
            {(() => {
              const pal = getNotePalette(noteToDelete, 0);
              const previewTime = formatDateTimeWithHM(noteToDelete.updated_at || noteToDelete.created_at);
              return (
                <div
                  style={{
                    backgroundColor: pal.bgLight,
                    boxShadow: pal.glowShadow,
                  }}
                  className="p-4 rounded-2xl space-y-2 border-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        style={{ backgroundColor: pal.accent }}
                        className="w-2 h-2 rounded-full shrink-0"
                      />
                      <h4
                        style={{ color: pal.textTitle }}
                        className="text-xs font-black truncate"
                      >
                        {noteToDelete.title?.trim() || 'Untitled Note'}
                      </h4>
                    </div>
                    {previewTime && (
                      <span
                        style={{ color: pal.textMuted }}
                        className="text-[10px] font-bold tabular-nums shrink-0"
                      >
                        {previewTime}
                      </span>
                    )}
                  </div>
                  <p
                    style={{ color: pal.textBody }}
                    className="text-[11px] font-bold line-clamp-3 leading-relaxed whitespace-pre-wrap"
                  >
                    {noteToDelete.text?.trim() || (
                      <span className="italic opacity-50 font-normal">Empty note content</span>
                    )}
                  </p>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Keep Note
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNote}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Delete Capsule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* DEDICATED IN-APP DELETE THREAD CONFIRMATION MODAL UI (NO WINDOW.CONFIRM) */}
      {/* ======================================================================== */}
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
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/80 shadow-2xs">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={isDeleting}
                className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                title="Cancel and close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">
                Delete Thread?
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Are you sure you want to permanently delete this thread box and all of its capsule notes?
              </p>
            </div>

            {/* Thread Details Preview */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-1">
              <h4 className="text-xs font-black text-zinc-900 truncate">
                {threadToDelete.title || 'Untitled Thread'}
              </h4>
              <p className="text-[11px] font-semibold text-zinc-500">
                {(threadToDelete.notes_list || []).length} capsule notes will be removed
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Keep Thread
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteThread}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Delete Thread</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
