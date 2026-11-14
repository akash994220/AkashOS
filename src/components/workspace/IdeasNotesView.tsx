import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { IdeaFolder, IdeaNote } from '../../types/workspace';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import { IdeaFolders, APP_COLOR_PALETTES } from './IdeaFolders';
import { EditorToolbar } from '../common/EditorToolbar';
import { 
  detectAndConvertClipboard, 
  autoFormatNoteText, 
  FormattedDetectionResult 
} from '../../lib/smartFormatDetector';
import { RichNoteRenderer } from '../common/RichNoteRenderer';
import { SmartFormatNotification } from '../common/SmartFormatNotification';
import { 
  Plus, 
  FileText, 
  Inbox, 
  Trash2, 
  X, 
  Clock, 
  Save,
  Search,
  Send,
  Edit3,
  Layers,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Quote,
  Code,
  Bold,
  Italic,
  Eye,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Calendar,
  CheckCircle2,
  Undo2,
  Redo2,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks, extractAllLinks } from '../../lib/linkUtils';
import { ResizablePopupWrapper } from '../common/ResizablePopupWrapper';

export const IdeasNotesView: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { registerBackHandler } = useNavigation();

  const [folders, setFolders] = useState<IdeaFolder[]>([]);
  const [notes, setNotes] = useState<IdeaNote[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick inline capture
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  // Note Modal / Editor State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<IdeaNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteFolderId, setNoteFolderId] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [copiedType, setCopiedType] = useState<'text' | 'markdown' | null>(null);

  // Original tracking for Dirty State & Unsaved Guard
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalBody, setOriginalBody] = useState('');
  const [originalFolderId, setOriginalFolderId] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Undo & Redo In-App History Stack
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Widescreen & Editor View Modes
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  // Smart Format Detection on Paste (AI Chat, MS Word, Web pages)
  const [detectedPaste, setDetectedPaste] = useState<FormattedDetectionResult | null>(null);
  const [isUsingRawPaste, setIsUsingRawPaste] = useState(false);
  const [rawPastedBackup, setRawPastedBackup] = useState<{
    rawText: string;
    formattedText: string;
    previousBody: string;
    insertStart: number;
    insertEnd: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 1. Subscribe to idea folders (App Spaces)
  useEffect(() => {
    if (!user || !db) return;
    const qFolders = query(collection(db, 'idea_folders'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qFolders,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaFolder));
        setFolders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_folders')
    );
    return () => unsub();
  }, [user]);

  // 2. Subscribe to idea notes
  useEffect(() => {
    if (!user || !db) return;
    const qNotes = query(collection(db, 'idea_notes'), where('owner_uid', '==', user.uid));
    const unsub = onSnapshot(
      qNotes,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IdeaNote));
        list.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
        setNotes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'idea_notes')
    );
    return () => unsub();
  }, [user]);

  // Counts of notes per app space
  const noteCountsByFolder = useMemo(() => {
    return notes.reduce((acc, note) => {
      const fid = note.folder_id || '__inbox__';
      acc[fid] = (acc[fid] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [notes]);

  // Format timestamp with date, hour, and minute
  const getRelativeEdited = (isoString?: string): string => {
    if (!isoString) return 'recently';
    return formatDateTimeWithHM(isoString);
  };

  // App Space Operations
  const handleCreateFolder = async (
    folderName: string, 
    icon?: string, 
    color?: string, 
    description?: string
  ) => {
    if (!user) return;
    const docId = `folder_${Date.now()}`;
    const payload: IdeaFolder = {
      folder_id: docId,
      owner_uid: user.uid,
      folder_name: folderName,
      parent_folder_id: null,
      icon: icon || '💡',
      color: color || 'indigo',
      description: description || '',
      created_at: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'idea_folders', docId), payload);
      setCurrentFolderId(docId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `idea_folders/${docId}`);
    }
  };

  const handleUpdateFolder = async (folderId: string, updates: Partial<IdeaFolder>) => {
    try {
      await updateDoc(doc(db, 'idea_folders', folderId), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `idea_folders/${folderId}`);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteDoc(doc(db, 'idea_folders', folderId));
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `idea_folders/${folderId}`);
    }
  };

  // Record undo/redo snapshot
  const recordSnapshot = (newText: string) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      if (trimmed[trimmed.length - 1] === newText) return prev;
      const next = [...trimmed, newText];
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      const targetText = history[nextIndex];
      setHistoryIndex(nextIndex);
      setNoteBody(targetText);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetText = history[nextIndex];
      setHistoryIndex(nextIndex);
      setNoteBody(targetText);
    }
  };

  const handleBodyChange = (val: string) => {
    setNoteBody(val);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      recordSnapshot(val);
    }, 400);
  };

  // Quick inline note creation
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickNoteText.trim()) return;

    setQuickAdding(true);
    const nowIso = new Date().toISOString();
    const noteId = `note_${Date.now()}`;
    const text = quickNoteText.trim();

    const lines = text.split('\n');
    const firstLine = lines[0].trim();
    const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : text;

    const payload: IdeaNote = {
      note_id: noteId,
      owner_uid: user.uid,
      folder_id: currentFolderId === '__inbox__' ? null : currentFolderId,
      title: title,
      body: body,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await setDoc(doc(db, 'idea_notes', noteId), payload);
      setQuickNoteText('');
      // Open in broad editor
      setSelectedNote(payload);
      setNoteTitle(payload.title || '');
      setNoteBody(payload.body || '');
      setNoteFolderId(payload.folder_id || null);
      setOriginalTitle(payload.title || '');
      setOriginalBody(payload.body || '');
      setOriginalFolderId(payload.folder_id || null);
      setHistory([payload.body || '']);
      setHistoryIndex(0);
      setActiveTab('write');
      setShowUnsavedConfirm(false);
      setDetectedPaste(null);
      setIsUsingRawPaste(false);
      setRawPastedBackup(null);
      setShowNoteModal(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `idea_notes/${noteId}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // Quick-capture: prominent "+ New Note"
  const handleOpenNewNote = () => {
    const initialFid = currentFolderId === '__inbox__' ? null : currentFolderId;
    setSelectedNote(null);
    setNoteTitle('');
    setNoteBody('');
    setNoteFolderId(initialFid);
    setOriginalTitle('');
    setOriginalBody('');
    setOriginalFolderId(initialFid);
    setHistory(['']);
    setHistoryIndex(0);
    setActiveTab('write');
    setShowUnsavedConfirm(false);
    setDetectedPaste(null);
    setIsUsingRawPaste(false);
    setRawPastedBackup(null);
    setShowNoteModal(true);
  };

  // Open existing note detail
  const handleOpenNoteDetail = (note: IdeaNote) => {
    setSelectedNote(note);
    const title = note.title || '';
    const body = note.body || '';
    const fid = note.folder_id || null;
    setNoteTitle(title);
    setNoteBody(body);
    setNoteFolderId(fid);
    setOriginalTitle(title);
    setOriginalBody(body);
    setOriginalFolderId(fid);
    setHistory([body]);
    setHistoryIndex(0);
    setActiveTab('write');
    setShowUnsavedConfirm(false);
    setDetectedPaste(null);
    setIsUsingRawPaste(false);
    setRawPastedBackup(null);
    setShowNoteModal(true);
  };

  // Save Note (Create or Edit)
  const handleSaveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSavingNote(true);

    const nowIso = new Date().toISOString();
    const noteId = selectedNote ? selectedNote.note_id : `note_${Date.now()}`;
    const payload: IdeaNote = {
      note_id: noteId,
      owner_uid: user.uid,
      folder_id: noteFolderId,
      title: noteTitle.trim(),
      body: noteBody,
      created_at: selectedNote ? selectedNote.created_at : nowIso,
      updated_at: nowIso,
    };

    try {
      await setDoc(doc(db, 'idea_notes', noteId), payload, { merge: true });
      setShowUnsavedConfirm(false);
      setDetectedPaste(null);
      setRawPastedBackup(null);
      setShowNoteModal(false);
      setSelectedNote(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `idea_notes/${noteId}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Move note to another app space
  const handleMoveNote = async (targetFolderId: string | null) => {
    if (!user || !selectedNote) return;
    const nowIso = new Date().toISOString();
    try {
      await setDoc(
        doc(db, 'idea_notes', selectedNote.note_id),
        {
          folder_id: targetFolderId,
          updated_at: nowIso,
        },
        { merge: true }
      );
      setNoteFolderId(targetFolderId);
      setSelectedNote((prev) => (prev ? { ...prev, folder_id: targetFolderId, updated_at: nowIso } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `idea_notes/${selectedNote.note_id}`);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await deleteDoc(doc(db, 'idea_notes', noteId));
      if (selectedNote?.note_id === noteId) {
        setShowUnsavedConfirm(false);
        setShowNoteModal(false);
        setSelectedNote(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `idea_notes/${noteId}`);
    }
  };

  // Check if current note has unsaved changes
  const isDirty = useMemo(() => {
    return (
      noteTitle !== originalTitle ||
      noteBody !== originalBody ||
      noteFolderId !== originalFolderId
    );
  }, [noteTitle, originalTitle, noteBody, originalBody, noteFolderId, originalFolderId]);

  // Detected links in current modal note (title & body)
  const detectedNoteLinks = useMemo(() => {
    return extractAllLinks(`${noteTitle} ${noteBody}`);
  }, [noteTitle, noteBody]);

  // Request close: guarded by unsaved changes check
  const handleRequestClose = () => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      setShowNoteModal(false);
      setSelectedNote(null);
    }
  };

  // Back handler registration: checks dirty state before closing
  useEffect(() => {
    if (showNoteModal) {
      return registerBackHandler(() => {
        if (showUnsavedConfirm) {
          setShowUnsavedConfirm(false);
          return true;
        }
        if (isDirty) {
          setShowUnsavedConfirm(true);
          return true;
        }
        setShowNoteModal(false);
        setSelectedNote(null);
        return true;
      });
    }
    if (currentFolderId !== null) {
      return registerBackHandler(() => {
        setCurrentFolderId(null);
        return true;
      });
    }
  }, [showNoteModal, showUnsavedConfirm, isDirty, currentFolderId, registerBackHandler]);

  // Notes filtered to current app space, unfiled inbox, or all notes, plus search filter
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchBody = (n.body || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBody) return false;
      }

      if (currentFolderId === null || currentFolderId === 'all') {
        return true;
      }
      if (currentFolderId === '__inbox__' || currentFolderId === 'inbox') {
        return !n.folder_id;
      }
      return n.folder_id === currentFolderId;
    });
  }, [notes, searchQuery, currentFolderId]);

  const unfiledNotesCount = notes.filter((n) => !n.folder_id).length;

  const getDisplayTitle = (note: IdeaNote): string => {
    if (note.title?.trim()) return note.title.trim();
    if (note.body?.trim()) {
      const firstLine = note.body.trim().split('\n')[0];
      return firstLine.slice(0, 60) || 'Untitled Note';
    }
    return 'Untitled Note';
  };

  // Stats
  const wordCount = useMemo(() => {
    return noteBody.trim() ? noteBody.trim().split(/\s+/).length : 0;
  }, [noteBody]);

  const charCount = noteBody.length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const checklistStats = useMemo(() => {
    const total = (noteBody.match(/\[[ x]\]/gi) || []).length;
    const completed = (noteBody.match(/\[x\]/gi) || []).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [noteBody]);

  // SMART KEYBOARD FORMATTING ON ENTER & TAB & UNDO/REDO
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Undo: Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    // Redo: Ctrl+Y or Cmd+Y
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Bold: Ctrl+B or Cmd+B
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**');
      return;
    }

    // Italic: Ctrl+I or Cmd+I
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      handleBodyChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const value = textarea.value;
      const currentLineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(currentLineStart, start);

      const emptyChecklist = /^(\s*)\[[ x]\]\s*$/i.test(currentLine);
      const emptyBullet = /^(\s*)[•\-\*]\s*$/.test(currentLine);
      const emptyNumber = /^(\s*)\d+\.\s*$/.test(currentLine);

      if (emptyChecklist || emptyBullet || emptyNumber) {
        e.preventDefault();
        const newValue = value.substring(0, currentLineStart) + value.substring(start);
        handleBodyChange(newValue);
        recordSnapshot(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = currentLineStart;
        }, 0);
        return;
      }

      const checklistMatch = currentLine.match(/^(\s*)\[[ x]\]\s+/i);
      if (checklistMatch) {
        e.preventDefault();
        const indent = checklistMatch[1];
        const insert = `\n${indent}[ ] `;
        const newValue = value.substring(0, start) + insert + value.substring(start);
        handleBodyChange(newValue);
        recordSnapshot(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insert.length;
        }, 0);
        return;
      }

      const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s+/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const bulletChar = bulletMatch[2] === '-' || bulletMatch[2] === '*' ? '•' : bulletMatch[2];
        const insert = `\n${indent}${bulletChar} `;
        const newValue = value.substring(0, start) + insert + value.substring(start);
        handleBodyChange(newValue);
        recordSnapshot(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insert.length;
        }, 0);
        return;
      }

      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (numberMatch) {
        e.preventDefault();
        const indent = numberMatch[1];
        const nextNum = parseInt(numberMatch[2], 10) + 1;
        const insert = `\n${indent}${nextNum}. `;
        const newValue = value.substring(0, start) + insert + value.substring(start);
        handleBodyChange(newValue);
        recordSnapshot(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insert.length;
        }, 0);
        return;
      }
    }
  };

  // Toolbar Formatting Insert Helper
  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    let newCursorPos = start;

    if (
      prefix === '• ' ||
      prefix === '1. ' ||
      prefix === '[ ] ' ||
      prefix === '# ' ||
      prefix === '## ' ||
      prefix === '> '
    ) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      replacement = text.substring(0, lineStart) + prefix + text.substring(lineStart);
      newCursorPos = start + prefix.length;
      setNoteBody(replacement);
      recordSnapshot(replacement);
    } else {
      replacement = text.substring(0, start) + prefix + (selectedText || 'text') + suffix + text.substring(end);
      newCursorPos = selectedText ? end + prefix.length + suffix.length : start + prefix.length;
      setNoteBody(replacement);
      recordSnapshot(replacement);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleInsertDateStamp = () => {
    const stamp = `[${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] `;
    insertFormatting(stamp);
  };

  // SMART FORMAT DETECTION ON PASTE (AI Chat, MS Word, Web pages)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const result = detectAndConvertClipboard(e.clipboardData);
    if (result.hasFormatting) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const prev = noteBody;

      const insertedText = result.convertedText;
      const updated = prev.substring(0, start) + insertedText + prev.substring(end);
      handleBodyChange(updated);
      recordSnapshot(updated);

      setDetectedPaste(result);
      setIsUsingRawPaste(false);
      setRawPastedBackup({
        rawText: result.rawText,
        formattedText: result.convertedText,
        previousBody: prev,
        insertStart: start,
        insertEnd: start + insertedText.length,
      });

      // Auto-suggest or set note title if currently empty
      if (result.suggestedTitle && !noteTitle.trim()) {
        setNoteTitle(result.suggestedTitle);
      }

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + insertedText.length;
        }
      }, 0);
    }
  };

  // Toggle between converted structured markdown and raw pasted text
  const handleToggleRawOrFormatted = () => {
    if (!rawPastedBackup) return;
    if (!isUsingRawPaste) {
      // Switch to raw text
      const { previousBody, insertStart, rawText } = rawPastedBackup;
      const updated = previousBody.substring(0, insertStart) + rawText + previousBody.substring(insertStart);
      handleBodyChange(updated);
      recordSnapshot(updated);
      setIsUsingRawPaste(true);
    } else {
      // Switch back to formatted text
      const { previousBody, insertStart, formattedText } = rawPastedBackup;
      const updated = previousBody.substring(0, insertStart) + formattedText + previousBody.substring(insertStart);
      handleBodyChange(updated);
      recordSnapshot(updated);
      setIsUsingRawPaste(false);
    }
  };

  // Trigger Smart Auto-Format on existing text
  const handleSmartFormatClick = () => {
    if (!noteBody.trim()) return;
    const { formattedText, suggestedTitle, stats } = autoFormatNoteText(noteBody);
    handleBodyChange(formattedText);
    recordSnapshot(formattedText);

    if (suggestedTitle && !noteTitle.trim()) {
      setNoteTitle(suggestedTitle);
    }

    setDetectedPaste({
      source: 'structured_text',
      sourceLabel: 'Auto-Structured Note',
      hasFormatting: true,
      suggestedTitle,
      convertedText: formattedText,
      rawText: noteBody,
      stats,
    });
    setIsUsingRawPaste(false);
  };

  // Smart Paste on Quick Note input: automatically opens expansive modal if rich content pasted
  const handleQuickNotePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const result = detectAndConvertClipboard(e.clipboardData);
    if (
      result.hasFormatting &&
      (result.stats.headingsCount > 0 || result.stats.bulletsCount > 0 || result.convertedText.includes('\n'))
    ) {
      e.preventDefault();
      const initialFid = currentFolderId === '__inbox__' ? null : currentFolderId;
      const suggestedT =
        result.suggestedTitle ||
        result.convertedText.split('\n')[0].replace(/^#+\s*/, '').slice(0, 50) ||
        'Captured Formatted Note';

      setSelectedNote(null);
      setNoteTitle(suggestedT);
      setNoteBody(result.convertedText);
      setNoteFolderId(initialFid);
      setOriginalTitle('');
      setOriginalBody('');
      setOriginalFolderId(initialFid);
      setHistory([result.convertedText]);
      setHistoryIndex(0);
      setActiveTab('write');
      setShowUnsavedConfirm(false);
      setDetectedPaste(result);
      setIsUsingRawPaste(false);
      setRawPastedBackup({
        rawText: result.rawText,
        formattedText: result.convertedText,
        previousBody: '',
        insertStart: 0,
        insertEnd: result.convertedText.length,
      });
      setQuickNoteText('');
      setShowNoteModal(true);
    }
  };

  const handleToggleChecklistLine = (lineIndex: number) => {
    const lines = noteBody.split('\n');
    if (lines[lineIndex] !== undefined) {
      if (lines[lineIndex].includes('[ ]')) {
        lines[lineIndex] = lines[lineIndex].replace('[ ]', '[x]');
      } else if (lines[lineIndex].includes('[x]')) {
        lines[lineIndex] = lines[lineIndex].replace('[x]', '[ ]');
      }
      const updatedBody = lines.join('\n');
      setNoteBody(updatedBody);
      recordSnapshot(updatedBody);

      if (selectedNote && user) {
        setDoc(
          doc(db, 'idea_notes', selectedNote.note_id),
          { body: updatedBody, updated_at: new Date().toISOString() },
          { merge: true }
        ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `idea_notes/${selectedNote.note_id}`));
      }
    }
  };

  const handleCopy = (type: 'text' | 'markdown') => {
    const content = type === 'markdown' 
      ? (noteTitle ? `# ${noteTitle}\n\n${noteBody}` : noteBody)
      : (noteTitle ? `${noteTitle}\n\n${noteBody}` : noteBody);
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const activeApp = currentFolderId && currentFolderId !== '__inbox__' && currentFolderId !== 'all'
    ? folders.find((f) => (f.folder_id || f.id) === currentFolderId)
    : null;

  return (
    <div className="space-y-4">
      {/* Top Header & Prominent Quick-Capture Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight truncate" style={{ color: theme.colors.textPrimary }}>
            Ideas & Note Spaces
          </h2>
          <p className="text-xs text-zinc-500 truncate">
            Expansive widescreen notes, formatted lists & categorized apps
          </p>
        </div>

        <button
          type="button"
          id="new-note-open-btn"
          onClick={handleOpenNewNote}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.full,
            minHeight: '36px',
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {/* QUICK INLINE CAPTURE STRIP */}
      <form
        onSubmit={handleQuickAdd}
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        }}
        className="p-1.5 sm:p-2 border flex items-center gap-2 shadow-xs"
      >
        <FileText className="w-4 h-4 text-zinc-400 ml-2 shrink-0" />
        <input
          type="text"
          id="quick-note-input"
          placeholder={
            activeApp 
              ? `Quick capture idea for ${activeApp.folder_name}...`
              : "Capture raw idea or paste formatted text (Word, AI chat, web)..."
          }
          value={quickNoteText}
          onChange={(e) => setQuickNoteText(e.target.value)}
          onPaste={handleQuickNotePaste}
          style={{ minHeight: '36px' }}
          className="flex-1 bg-transparent px-2 text-xs focus:outline-none text-zinc-900 placeholder:text-zinc-400"
        />
        <button
          type="submit"
          id="quick-note-submit-btn"
          disabled={quickAdding || !quickNoteText.trim()}
          style={{
            backgroundColor: quickNoteText.trim() ? theme.colors.accent : theme.colors.bgSecondary,
            color: quickNoteText.trim() ? theme.colors.accentText : theme.colors.textSecondary,
            borderRadius: theme.radius.md,
            minHeight: '32px',
          }}
          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shrink-0"
        >
          <Send className="w-3 h-3" />
          <span className="hidden xs:inline">{quickAdding ? 'Saving...' : 'Add & Expand'}</span>
        </button>
      </form>

      {/* App Spaces / Folders Grid Pill Strip */}
      <IdeaFolders
        folders={folders}
        currentFolderId={currentFolderId}
        onSelectFolder={(id) => setCurrentFolderId(id)}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        unfiledCount={unfiledNotesCount}
        notesCountByFolder={noteCountsByFolder}
      />

      {/* Search Input Filter */}
      <div className="flex items-center justify-between gap-3">
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.full,
          }}
          className="flex items-center gap-2 px-3 py-1 border text-xs sm:w-72 shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search notes, points, headings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full focus:outline-none text-xs text-zinc-900 placeholder:text-zinc-400 py-1"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-xs text-zinc-500 font-medium">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* NOTES GRID DISPLAY */}
      {filteredNotes.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
            borderWidth: '1px',
            borderStyle: 'dashed',
            padding: theme.spacing.xl,
          }}
          className="text-center space-y-2 py-10"
        >
          <FileText className="w-8 h-8 mx-auto" style={{ color: theme.colors.textMuted }} />
          <p className="text-xs font-semibold" style={{ color: theme.colors.textPrimary }}>
            {searchQuery ? 'No notes match your search' : 'No notes in this space'}
          </p>
          <p className="text-[11px] max-w-sm mx-auto" style={{ color: theme.colors.textSecondary }}>
            {searchQuery
              ? 'Try clearing the search query to see all notes.'
              : 'Write down thoughts, checklists, bullet points, and plans.'}
          </p>
          <div className="pt-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.sm,
                }}
                className="px-3 py-1.5 text-xs font-medium hover:bg-zinc-200 cursor-pointer"
              >
                Clear search
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenNewNote}
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentText,
                  borderRadius: theme.radius.sm,
                }}
                className="px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create first note</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredNotes.map((note) => {
            const displayTitle = getDisplayTitle(note);
            const hasExplicitTitle = Boolean(note.title?.trim());
            const app = folders.find((f) => (f.folder_id || f.id) === note.folder_id);
            const palette = app ? APP_COLOR_PALETTES[app.color || 'indigo'] || APP_COLOR_PALETTES.indigo : null;

            const noteCheckTotal = (note.body.match(/\[[ x]\]/gi) || []).length;
            const noteCheckDone = (note.body.match(/\[x\]/gi) || []).length;
            const hasChecklist = noteCheckTotal > 0;

            const bulletCount = (note.body.match(/^[•\-\*]\s+/gm) || []).length;
            const headingCount = (note.body.match(/^#{1,4}\s+/gm) || []).length;
            const hasCode = note.body.includes('```');

            return (
              <div
                key={note.note_id}
                onClick={() => handleOpenNoteDetail(note)}
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: theme.colors.borderLight,
                  borderRadius: '1.125rem',
                }}
                className="p-4 border transition-all hover:border-zinc-400 hover:shadow-md cursor-pointer space-y-3 group shadow-xs flex flex-col justify-between relative"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-zinc-900 truncate flex-1 group-hover:text-blue-600 transition-colors">
                      {tokenizeTextWithLinks(displayTitle).map((token, i) =>
                        token.type === 'link' && token.url ? (
                          <LinkWithPreview
                            key={`${token.url}-${i}`}
                            url={token.url}
                            domain={token.domain}
                            path={token.path}
                            variant="inline"
                            className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                            stopPropagation={true}
                          >
                            {token.content}
                          </LinkWithPreview>
                        ) : (
                          <React.Fragment key={i}>{token.content}</React.Fragment>
                        )
                      )}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenNoteDetail(note)}
                        style={{ minHeight: '28px', minWidth: '28px' }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 rounded transition-opacity flex items-center justify-center cursor-pointer"
                        title="Edit note"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNote(note.note_id, e)}
                        style={{ minHeight: '28px', minWidth: '28px' }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 rounded transition-opacity flex items-center justify-center cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {hasChecklist && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-50 px-2 py-1 rounded-lg border border-zinc-200/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-medium text-zinc-600">{noteCheckTotal} checklist {noteCheckTotal === 1 ? 'item' : 'items'}</span>
                    </div>
                  )}

                  {/* Formatted Content Badges */}
                  {(bulletCount > 0 || headingCount > 0 || hasCode) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {headingCount > 0 && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          H {headingCount} {headingCount === 1 ? 'headline' : 'headlines'}
                        </span>
                      )}
                      {bulletCount > 0 && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          • {bulletCount} points
                        </span>
                      )}
                      {hasCode && (
                        <span className="text-[10px] font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 font-mono">
                          &lt;/&gt; code
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-zinc-600 line-clamp-4 leading-relaxed font-sans whitespace-pre-line">
                    {tokenizeTextWithLinks(
                      hasExplicitTitle
                        ? note.body
                        : note.body.split('\n').slice(1).join('\n').trim() || note.body
                    ).map((token, i) =>
                      token.type === 'link' && token.url ? (
                        <LinkWithPreview
                          key={`${token.url}-${i}`}
                          url={token.url}
                          domain={token.domain}
                          path={token.path}
                          variant="inline"
                          className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                          stopPropagation={true}
                        >
                          {token.content}
                        </LinkWithPreview>
                      ) : (
                        <React.Fragment key={i}>{token.content}</React.Fragment>
                      )
                    )}
                  </p>
                </div>

                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.borderLight}`,
                    paddingTop: theme.spacing.xs,
                  }}
                  className="flex items-center justify-between text-[11px] text-zinc-400 pt-1"
                >
                  <span className="flex items-center gap-1 font-sans">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{getRelativeEdited(note.updated_at)}</span>
                  </span>

                  {app && palette ? (
                    <span
                      style={{
                        backgroundColor: palette.light,
                        borderColor: palette.border,
                        color: palette.text,
                      }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs"
                    >
                      <span>{app.icon || '💡'}</span>
                      <span className="truncate max-w-[100px]">{app.folder_name}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-zinc-200">
                      <Inbox className="w-3 h-3 text-zinc-400" />
                      <span>Inbox</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* UPGRADED EXPANSIVE WIDESCREEN POPUP CARD (SCREEN TAKEOVER & SAFETY GUARD) */}
      {showNoteModal && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-2 sm:p-4 md:p-6"
          // LOCKED BACKDROP: Clicking outside NEVER automatically closes the window!
        >
          <ResizablePopupWrapper
            scope="ideas"
            popupId="note_modal"
            defaultWidth={1100}
            minWidth={480}
            maxWidth={1380}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.bgElevated,
                borderRadius: isFullscreen ? '0.75rem' : '1.5rem',
                boxShadow: theme.shadows.lg,
                border: `1px solid ${theme.colors.borderLight}`,
                width: isFullscreen ? '98vw' : '100%',
                height: isFullscreen ? '97vh' : '92vh',
              }}
              className="modal-surface w-full flex flex-col overflow-hidden shadow-2xl relative transition-all duration-200"
            >
            {/* Top Toolbar / Status Bar */}
            <div
              style={{
                borderBottom: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.bgSecondary,
              }}
              className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* App Space Selector Dropdown */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-800 bg-white rounded-xl px-3 py-1.5 border border-zinc-200 shadow-2xs shrink-0">
                  <Layers className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-zinc-500 font-medium hidden xs:inline">Space:</span>
                  <select
                    value={noteFolderId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setNoteFolderId(val);
                      if (selectedNote) {
                        handleMoveNote(val);
                      }
                    }}
                    className="bg-transparent text-xs font-semibold text-zinc-900 focus:outline-none cursor-pointer border-none"
                  >
                    <option value="">📥 Inbox / Unfiled</option>
                    {folders.map((f) => (
                      <option key={f.folder_id || f.id} value={f.folder_id || f.id}>
                        {(f.icon || '💡')} {f.folder_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Edit / Preview Tabs */}
                <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('write')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'write' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'preview' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>

                {/* Checklist Progress Pill if exists */}
                {checklistStats.total > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                    <CheckSquare className="w-3 h-3 text-emerald-600" />
                    <span>{checklistStats.completed}/{checklistStats.total} done ({checklistStats.percent}%)</span>
                  </div>
                )}

                {/* Dirty indicator */}
                {isDirty && (
                  <span className="hidden lg:inline text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Edits pending
                  </span>
                )}
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Fullscreen Zen Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-white/80 transition-colors cursor-pointer border border-transparent hover:border-zinc-200"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Fullscreen Zen Mode'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {selectedNote && (
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(selectedNote.note_id)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div className="w-px h-4 bg-zinc-300 mx-0.5" />

                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-full transition-colors cursor-pointer"
                  title="Close (Ctrl+W or Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* LIGHTWEIGHT FORMATTING TOOLBAR WITH BOLD, ITALIC, BULLETS & SMART FORMAT */}
            {activeTab === 'write' && (
              <div className="px-4 sm:px-6 py-2 border-b border-zinc-200 bg-zinc-50/70 overflow-x-auto shrink-0">
                <EditorToolbar
                  onBold={() => insertFormatting('**', '**')}
                  onItalic={() => insertFormatting('*', '*')}
                  onBullet={() => insertFormatting('• ')}
                  onChecklist={() => insertFormatting('[ ] ')}
                  onNumberedList={() => insertFormatting('1. ')}
                  onHeading={() => insertFormatting('# ')}
                  onQuote={() => insertFormatting('> ')}
                  onDateStamp={handleInsertDateStamp}
                  onSmartFormat={handleSmartFormatClick}
                  isSmartFormatEnabled={true}
                  canUndo={historyIndex > 0}
                  onUndo={handleUndo}
                  canRedo={historyIndex < history.length - 1}
                  onRedo={handleRedo}
                />
              </div>
            )}

            {/* Smart Format Detection Banner */}
            {detectedPaste && (
              <SmartFormatNotification
                detection={detectedPaste}
                onApplyTitle={(title) => setNoteTitle(title)}
                onRevertToRaw={handleToggleRawOrFormatted}
                onDismiss={() => setDetectedPaste(null)}
                showRawToggle={Boolean(rawPastedBackup)}
                isUsingRaw={isUsingRawPaste}
              />
            )}

            {/* EXPANSIVE CANVAS: TAKES OVER MOST OF SCREEN */}
            <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 md:p-8 space-y-4">
              <input
                type="text"
                placeholder="Note Title / Project Topic..."
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                style={{
                  color: theme.colors.textPrimary,
                }}
                className="w-full text-xl sm:text-2xl font-extrabold placeholder:text-zinc-400 focus:outline-none bg-transparent border-0 border-b border-zinc-200/80 pb-2 focus:border-blue-500 transition-colors tracking-tight shrink-0"
              />

              {/* Detected Links Quick Access Bar (Always active when note has links) */}
              {detectedNoteLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 shrink-0">
                  <div className="flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-wider pl-1 pr-1 shrink-0">
                    <Link2 className="w-3.5 h-3.5 text-[#2563eb]" />
                    <span>Links ({detectedNoteLinks.length}):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {detectedNoteLinks.map((link) => (
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

              {activeTab === 'write' ? (
                <div className="flex-1 flex flex-col relative overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    placeholder="Start typing your note, or paste copied text from any website, Word doc, or AI chat...&#10;&#10;✨ Formats (Headings, bullet points, numbers, checklists & bold) are detected automatically!&#10;• Type '• ' or '- ' for bullet points (auto-continues on Enter)&#10;• Type '[ ] ' for interactive checklists&#10;• Type '1. ' for numbered lists&#10;• Press Ctrl+Z to Undo, Ctrl+Y to Redo&#10;• Press Tab to indent"
                    value={noteBody}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    onPaste={handlePaste}
                    style={{
                      color: theme.colors.textPrimary,
                    }}
                    className="w-full flex-1 text-sm sm:text-base placeholder:text-zinc-400 focus:outline-none resize-none bg-transparent leading-relaxed font-sans border-0 focus:ring-0 p-0 overflow-y-auto"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  <RichNoteRenderer
                    content={noteBody}
                    onToggleChecklist={handleToggleChecklistLine}
                    fontSize="base"
                  />
                </div>
              )}
            </div>

            {/* EXPANSIVE STATUS FOOTER */}
            <div
              style={{
                borderTop: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.bgSecondary,
              }}
              className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 flex-wrap"
            >
              {/* Document Statistics */}
              <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                <span>•</span>
                <span>{charCount} chars</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">{readTimeMinutes} min read</span>

                {/* Copy Buttons */}
                <div className="hidden md:flex items-center gap-1.5 ml-2 border-l border-zinc-300 pl-3">
                  <button
                    type="button"
                    onClick={() => handleCopy('text')}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2 py-0.5 rounded-md hover:bg-white transition-colors cursor-pointer"
                  >
                    {copiedType === 'text' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedType === 'text' ? 'Copied Text!' : 'Copy Text'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy('markdown')}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2 py-0.5 rounded-md hover:bg-white transition-colors cursor-pointer"
                  >
                    {copiedType === 'markdown' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedType === 'markdown' ? 'Copied MD!' : 'Copy Markdown'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="px-4 py-2 text-xs rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 cursor-pointer font-medium text-zinc-700 transition-all active:scale-95 shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '36px',
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs rounded-xl font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNote ? 'Saving...' : 'Save Note'}</span>
                </button>
              </div>
            </div>
            </div>
          </ResizablePopupWrapper>
        </div>
      )}

      {/* UNSAVED CHANGES SAFETY CONFIRMATION DIALOG (NOTES) */}
      {showUnsavedConfirm && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.borderLight,
              borderRadius: '1.25rem',
            }}
            className="p-6 max-w-md w-full border shadow-2xl space-y-4 text-left"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">
                  Confirm Exit: Unsaved Changes
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  You have unsaved changes in this note. What would you like to do before closing?
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setShowNoteModal(false);
                  setSelectedNote(null);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl text-rose-600 border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowUnsavedConfirm(false);
                  await handleSaveNote();
                }}
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentText,
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
