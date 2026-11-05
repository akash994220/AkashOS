import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { useTheme } from '../../theme/ThemeContext';
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
import {
  VaultSection,
  VaultFolder,
  VaultCredentialItem,
  VaultBankCardItem,
  VaultCustomItem,
} from '../../types/vault';
import { 
  encryptText, 
  decryptText,
  deriveCandidateKeysPool,
  registerSessionCandidateKeys,
  getSessionCandidateKeys
} from '../../lib/crypto';
import { 
  KeyRound, 
  CreditCard, 
  FileLock2, 
  Settings as SettingsIcon, 
  Lock, 
  Unlock, 
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Globe,
  User as UserIcon,
  Shield,
  Layers,
  X
} from 'lucide-react';

type SelectedItemType = 
  | { type: 'credential'; data: VaultCredentialItem }
  | { type: 'bank_card'; data: VaultBankCardItem }
  | { type: 'custom'; data: VaultCustomItem }
  | null;

// Helper to parse custom secret payloads (handles raw strings, { mode: 'text', text: '...' }, { mode: 'kv', kv: [...] }, and JSON objects)
export function parseCustomPayload(decryptedStr: string): {
  mode: 'text' | 'kv';
  text: string;
  kv: Array<{ key: string; value: string }>;
} {
  if (!decryptedStr) return { mode: 'text', text: '', kv: [] };

  let current: any = decryptedStr;

  // Unpack potential multi-level JSON stringification
  for (let i = 0; i < 3; i++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          current = JSON.parse(trimmed);
        } catch {
          break;
        }
      } else {
        break;
      }
    }
  }

  if (current && typeof current === 'object') {
    if (current.mode === 'kv' && Array.isArray(current.kv)) {
      return { mode: 'kv', text: '', kv: current.kv };
    }
    if (typeof current.text === 'string') {
      return { mode: 'text', text: current.text, kv: [] };
    }
    if (Array.isArray(current)) {
      const isKvArray = current.every((x) => x && typeof x === 'object' && 'key' in x && 'value' in x);
      if (isKvArray) {
        return { mode: 'kv', text: '', kv: current };
      }
      return { mode: 'text', text: current.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n'), kv: [] };
    }
    // Generic key-value object
    const entries = Object.entries(current).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
    if (entries.length > 0) {
      return { mode: 'kv', text: '', kv: entries };
    }
  }

  if (typeof current === 'string') {
    return { mode: 'text', text: current, kv: [] };
  }

  return { mode: 'text', text: String(current || ''), kv: [] };
}

export const VaultView: React.FC = () => {
  const { theme } = useTheme();
  const { user, userSettings } = useAuth();
  const { 
    isUnlocked, 
    isPinSet,
    unlockWithPin,
    unlockDirectly,
    disableLockCompletely,
    enablePinLock,
    testAndRegisterPin,
    lockVault, 
    panicLock, 
    bypassed, 
    activeKey, 
    setNewPin,
    autoLockMinutes,
    setAutoLockMinutes,
    lockOnTabBlur,
    setLockOnTabBlur,
  } = useVault();

  // Navigation State
  const [activeSection, setActiveSection] = useState<'all' | 'credentials' | 'bank_cards' | 'custom' | 'settings'>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItemType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Vault Collections
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [credentials, setCredentials] = useState<VaultCredentialItem[]>([]);
  const [bankCards, setBankCards] = useState<VaultBankCardItem[]>([]);
  const [customItems, setCustomItems] = useState<VaultCustomItem[]>([]);

  // Unlocked & Direct Reveal states (Completely unlocked by default)
  const [hideSecretMap, setHideSecretMap] = useState<Record<string, boolean>>({});
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals for Create / Edit
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [pinChangeModalOpen, setPinChangeModalOpen] = useState(false);

  // Modal forms
  const [editingCred, setEditingCred] = useState<Partial<VaultCredentialItem> | null>(null);
  const [credPlainPassword, setCredPlainPassword] = useState('');
  const [editingCard, setEditingCard] = useState<Partial<VaultBankCardItem> | null>(null);
  const [cardPlainNumber, setCardPlainNumber] = useState('');
  const [cardPlainCvv, setCardPlainCvv] = useState('');
  const [editingCustom, setEditingCustom] = useState<Partial<VaultCustomItem> | null>(null);
  const [customPlainData, setCustomPlainData] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [confirmNewPinValue, setConfirmNewPinValue] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Password Generator in Modal
  const [genLength, setGenLength] = useState(16);

  // 1. Subscriptions to Vault Firestore Collections
  useEffect(() => {
    if (!user) return;

    const qFolders = query(collection(db, 'vault_folders'), where('owner_uid', '==', user.uid));
    const unsubFolders = onSnapshot(
      qFolders,
      (snap) => {
        setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultFolder)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_folders')
    );

    const qCreds = query(collection(db, 'vault_credentials'), where('owner_uid', '==', user.uid));
    const unsubCreds = onSnapshot(
      qCreds,
      (snap) => {
        setCredentials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultCredentialItem)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_credentials')
    );

    const qCards = query(collection(db, 'vault_bank_cards'), where('owner_uid', '==', user.uid));
    const unsubCards = onSnapshot(
      qCards,
      (snap) => {
        setBankCards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultBankCardItem)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_bank_cards')
    );

    const qCustom = query(collection(db, 'vault_custom'), where('owner_uid', '==', user.uid));
    const unsubCustom = onSnapshot(
      qCustom,
      (snap) => {
        setCustomItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VaultCustomItem)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vault_custom')
    );

    return () => {
      unsubFolders();
      unsubCreds();
      unsubCards();
      unsubCustom();
    };
  }, [user]);

  // Keep selected item data fresh when firestore updates
  useEffect(() => {
    if (!selectedItem) return;
    if (selectedItem.type === 'credential') {
      const fresh = credentials.find((c) => c.id === selectedItem.data.id);
      if (fresh) setSelectedItem({ type: 'credential', data: fresh });
    } else if (selectedItem.type === 'bank_card') {
      const fresh = bankCards.find((c) => c.id === selectedItem.data.id);
      if (fresh) setSelectedItem({ type: 'bank_card', data: fresh });
    } else if (selectedItem.type === 'custom') {
      const fresh = customItems.find((c) => c.id === selectedItem.data.id);
      if (fresh) setSelectedItem({ type: 'custom', data: fresh });
    }
  }, [credentials, bankCards, customItems]);

  const getItemSecret = useCallback((raw?: string | null, fieldKey?: string): string => {
    if (!raw) return '';
    if (raw.includes('Decryption Failed')) return '';
    if (fieldKey && decryptedValues[fieldKey] !== undefined) {
      return decryptedValues[fieldKey];
    }
    if (raw.startsWith('enc:v1:') || raw.startsWith('v1:')) {
      return '';
    }
    return raw;
  }, [decryptedValues]);

  // Seamlessly decode legacy ciphertexts in background if needed
  useEffect(() => {
    if (!selectedItem) return;
    const decodeLegacy = async () => {
      if (selectedItem.type === 'credential') {
        const raw = selectedItem.data.encrypted_password;
        if (raw && (raw.startsWith('enc:v1:') || raw.startsWith('v1:'))) {
          try {
            const dec = await decryptText(raw, activeKey);
            if (dec && !dec.includes('Decryption Failed')) {
              setDecryptedValues(prev => ({ ...prev, [`cred_${selectedItem.data.id}`]: dec }));
            }
          } catch {}
        }
      } else if (selectedItem.type === 'bank_card') {
        const cardNum = selectedItem.data.encrypted_card_number;
        if (cardNum && (cardNum.startsWith('enc:v1:') || cardNum.startsWith('v1:'))) {
          try {
            const dec = await decryptText(cardNum, activeKey);
            if (dec && !dec.includes('Decryption Failed')) {
              setDecryptedValues(prev => ({ ...prev, [`card_num_${selectedItem.data.id}`]: dec }));
            }
          } catch {}
        }
        const cvv = selectedItem.data.encrypted_cvv;
        if (cvv && (cvv.startsWith('enc:v1:') || cvv.startsWith('v1:'))) {
          try {
            const dec = await decryptText(cvv, activeKey);
            if (dec && !dec.includes('Decryption Failed')) {
              setDecryptedValues(prev => ({ ...prev, [`card_cvv_${selectedItem.data.id}`]: dec }));
            }
          } catch {}
        }
        const acc = selectedItem.data.encrypted_account_number;
        if (acc && (acc.startsWith('enc:v1:') || acc.startsWith('v1:'))) {
          try {
            const dec = await decryptText(acc, activeKey);
            if (dec && !dec.includes('Decryption Failed')) {
              setDecryptedValues(prev => ({ ...prev, [`bank_acc_${selectedItem.data.id}`]: dec }));
            }
          } catch {}
        }
      } else if (selectedItem.type === 'custom') {
        const raw = selectedItem.data.encrypted_data;
        if (raw && (raw.startsWith('enc:v1:') || raw.startsWith('v1:'))) {
          try {
            const dec = await decryptText(raw, activeKey);
            if (dec && !dec.includes('Decryption Failed')) {
              setDecryptedValues(prev => ({ ...prev, [`custom_${selectedItem.data.id}`]: dec }));
            }
          } catch {}
        }
      }
    };
    decodeLegacy();
  }, [selectedItem, activeKey]);

  // Retrieval & Decryption State for encrypted strings (e.g., enc:v1:...)
  const [recoveryPinInput, setRecoveryPinInput] = useState('');
  const [showPinInInput, setShowPinInInput] = useState(false);
  const [dismissedRecoveryBanner, setDismissedRecoveryBanner] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievalStatus, setRetrievalStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Direct cipher decoder tester state (for testing specific enc:v1 strings like user provided)
  const [showDirectDecoder, setShowDirectDecoder] = useState(false);
  const [directCipherInput, setDirectCipherInput] = useState('');
  const [directPinInput, setDirectPinInput] = useState('');
  const [directDecodeResult, setDirectDecodeResult] = useState<string | null>(null);
  const [isDirectDecoding, setIsDirectDecoding] = useState(false);

  // Inline PIN for detail panels
  const [inlineDetailPin, setInlineDetailPin] = useState('');

  // Lock screen PIN states
  const [lockScreenPin, setLockScreenPin] = useState('');
  const [lockScreenError, setLockScreenError] = useState<string | null>(null);
  const [isLockScreenSubmitting, setIsLockScreenSubmitting] = useState(false);

  // Calculate detailed stats of encrypted items awaiting PIN decryption
  const encryptedStats = useMemo(() => {
    let credCount = 0;
    let cardCount = 0;
    let customCount = 0;

    credentials.forEach((c) => {
      const isEnc = 
        ((c.encrypted_password?.startsWith('enc:v1:') || c.encrypted_password?.startsWith('v1:')) && !decryptedValues[`cred_${c.id}`]) ||
        ((c.username_email?.startsWith('enc:v1:') || c.username_email?.startsWith('v1:')) && !decryptedValues[`cred_user_${c.id}`]) ||
        ((c.notes?.startsWith('enc:v1:') || c.notes?.startsWith('v1:')) && !decryptedValues[`cred_note_${c.id}`]);
      if (isEnc) credCount++;
    });

    bankCards.forEach((b) => {
      const isEnc = 
        ((b.encrypted_card_number?.startsWith('enc:v1:') || b.encrypted_card_number?.startsWith('v1:')) && !decryptedValues[`card_num_${b.id}`]) ||
        ((b.encrypted_cvv?.startsWith('enc:v1:') || b.encrypted_cvv?.startsWith('v1:')) && !decryptedValues[`card_cvv_${b.id}`]) ||
        ((b.encrypted_account_number?.startsWith('enc:v1:') || b.encrypted_account_number?.startsWith('v1:')) && !decryptedValues[`bank_acc_${b.id}`]);
      if (isEnc) cardCount++;
    });

    customItems.forEach((c) => {
      const isEnc = 
        ((c.encrypted_data?.startsWith('enc:v1:') || c.encrypted_data?.startsWith('v1:')) && !decryptedValues[`custom_${c.id}`]) ||
        ((c.title?.startsWith('enc:v1:') || c.title?.startsWith('v1:')) && !decryptedValues[`custom_title_${c.id}`]);
      if (isEnc) customCount++;
    });

    return {
      credCount,
      cardCount,
      customCount,
      total: credCount + cardCount + customCount,
    };
  }, [credentials, bankCards, customItems, decryptedValues]);

  const hasEncryptedItems = encryptedStats.total > 0;

  const handleRetrieveWithPin = async (overridePin?: string) => {
    const pinToUse = (overridePin !== undefined ? overridePin : recoveryPinInput).trim();
    if (!pinToUse) return;
    setIsRetrieving(true);
    setRetrievalStatus(null);

    try {
      const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
      const localSalts = localStorage.getItem('vault_historical_salts');
      if (localSalts) {
        try {
          const parsed = JSON.parse(localSalts);
          if (Array.isArray(parsed)) parsed.forEach((s) => historicalSalts.push(s));
        } catch {}
      }

      // 1. Derive candidate keys from entered PIN across all iterations and salts
      const keys = await deriveCandidateKeysPool({
        pin: pinToUse,
        userUid: user?.uid,
        userEmail: user?.email,
        saltHex: userSettings?.vault_pin_salt,
        historicalSalts,
      });

      // 2. Test decrypting the items
      let decryptedCount = 0;
      const newDecryptedMap: Record<string, string> = { ...decryptedValues };

      // Test & Decrypt credentials
      for (const cred of credentials) {
        let credUpdated = false;
        const updates: any = {};

        if (cred.encrypted_password && (cred.encrypted_password.startsWith('enc:v1:') || cred.encrypted_password.startsWith('v1:'))) {
          const dec = await decryptText(cred.encrypted_password, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`cred_${cred.id}`] = dec;
            updates.encrypted_password = dec;
            credUpdated = true;
          }
        }

        if (cred.username_email && (cred.username_email.startsWith('enc:v1:') || cred.username_email.startsWith('v1:'))) {
          const dec = await decryptText(cred.username_email, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`cred_user_${cred.id}`] = dec;
            updates.username_email = dec;
            credUpdated = true;
          }
        }

        if (cred.notes && (cred.notes.startsWith('enc:v1:') || cred.notes.startsWith('v1:'))) {
          const dec = await decryptText(cred.notes, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`cred_note_${cred.id}`] = dec;
            updates.notes = dec;
            credUpdated = true;
          }
        }

        if (credUpdated) {
          try {
            await updateDoc(doc(db, 'vault_credentials', cred.id), {
              ...updates,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
      }

      // Test & Decrypt bank cards
      for (const card of bankCards) {
        let cardUpdated = false;
        const updates: any = {};
        if (card.encrypted_card_number && (card.encrypted_card_number.startsWith('enc:v1:') || card.encrypted_card_number.startsWith('v1:'))) {
          const dec = await decryptText(card.encrypted_card_number, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`card_num_${card.id}`] = dec;
            updates.encrypted_card_number = dec;
            cardUpdated = true;
          }
        }
        if (card.encrypted_cvv && (card.encrypted_cvv.startsWith('enc:v1:') || card.encrypted_cvv.startsWith('v1:'))) {
          const dec = await decryptText(card.encrypted_cvv, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`card_cvv_${card.id}`] = dec;
            updates.encrypted_cvv = dec;
            cardUpdated = true;
          }
        }
        if (card.encrypted_account_number && (card.encrypted_account_number.startsWith('enc:v1:') || card.encrypted_account_number.startsWith('v1:'))) {
          const dec = await decryptText(card.encrypted_account_number, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`bank_acc_${card.id}`] = dec;
            updates.encrypted_account_number = dec;
            cardUpdated = true;
          }
        }
        if (card.cardholder_name && (card.cardholder_name.startsWith('enc:v1:') || card.cardholder_name.startsWith('v1:'))) {
          const dec = await decryptText(card.cardholder_name, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            updates.cardholder_name = dec;
            cardUpdated = true;
          }
        }
        if (cardUpdated) {
          try {
            await updateDoc(doc(db, 'vault_bank_cards', card.id), {
              ...updates,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
      }

      // Test & Decrypt custom secrets
      for (const cust of customItems) {
        let custUpdated = false;
        const updates: any = {};
        if (cust.encrypted_data && (cust.encrypted_data.startsWith('enc:v1:') || cust.encrypted_data.startsWith('v1:'))) {
          const dec = await decryptText(cust.encrypted_data, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`custom_${cust.id}`] = dec;
            updates.encrypted_data = dec;
            custUpdated = true;
          }
        }
        if (cust.title && (cust.title.startsWith('enc:v1:') || cust.title.startsWith('v1:'))) {
          const dec = await decryptText(cust.title, null, keys);
          if (dec && !dec.includes('Decryption Failed')) {
            decryptedCount++;
            newDecryptedMap[`custom_title_${cust.id}`] = dec;
            updates.title = dec;
            custUpdated = true;
          }
        }
        if (custUpdated) {
          try {
            await updateDoc(doc(db, 'vault_custom', cust.id), {
              ...updates,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
      }

      if (decryptedCount > 0) {
        setDecryptedValues(newDecryptedMap);
        registerSessionCandidateKeys([...getSessionCandidateKeys(), ...keys]);
        setRetrievalStatus({
          success: true,
          message: `✓ Successfully decrypted ${decryptedCount} private field(s)! Data is now permanently saved in plain text.`,
        });
        setRecoveryPinInput('');
        setInlineDetailPin('');
      } else {
        setRetrievalStatus({
          success: false,
          message: 'Could not decrypt with this PIN. Please check the PIN or passcode you originally set for your vault.',
        });
      }
    } catch (err) {
      setRetrievalStatus({
        success: false,
        message: 'Decryption error. Please try again.',
      });
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleLockScreenSubmit = async (pinToUse: string) => {
    if (!pinToUse || pinToUse.trim().length !== 4) return;
    setIsLockScreenSubmitting(true);
    setLockScreenError(null);
    try {
      const res = await unlockWithPin(pinToUse.trim());
      if (res.success) {
        setLockScreenPin('');
        // Also auto-decrypt any encrypted items seamlessly with this PIN
        await handleRetrieveWithPin(pinToUse.trim());
      } else {
        setLockScreenError(res.error || 'Incorrect 4-digit PIN. Please try again.');
        setLockScreenPin('');
      }
    } catch (err: any) {
      setLockScreenError(err?.message || 'Failed to unlock.');
      setLockScreenPin('');
    } finally {
      setIsLockScreenSubmitting(false);
    }
  };

  // Test decoding a single ciphertext directly (e.g., user pastes their enc:v1:... string)
  const handleTestDirectDecode = async () => {
    if (!directCipherInput.trim() || !directPinInput.trim()) return;
    setIsDirectDecoding(true);
    setDirectDecodeResult(null);

    try {
      const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
      const localSalts = localStorage.getItem('vault_historical_salts');
      if (localSalts) {
        try {
          const parsed = JSON.parse(localSalts);
          if (Array.isArray(parsed)) parsed.forEach((s) => historicalSalts.push(s));
        } catch {}
      }

      const keys = await deriveCandidateKeysPool({
        pin: directPinInput.trim(),
        userUid: user?.uid,
        userEmail: user?.email,
        saltHex: userSettings?.vault_pin_salt,
        historicalSalts,
      });

      const dec = await decryptText(directCipherInput.trim(), null, keys);
      if (dec && !dec.includes('Decryption Failed')) {
        setDirectDecodeResult(dec);
        registerSessionCandidateKeys([...getSessionCandidateKeys(), ...keys]);
      } else {
        setDirectDecodeResult('Decryption failed: PIN did not match encryption key.');
      }
    } catch (e: any) {
      setDirectDecodeResult(`Error: ${e?.message || 'Decryption failed'}`);
    } finally {
      setIsDirectDecoding(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Password Generator Helper
  const generatePassword = () => {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()_+-=';
    let res = '';
    const array = new Uint32Array(genLength);
    crypto.getRandomValues(array);
    for (let i = 0; i < genLength; i++) {
      res += chars[array[i] % chars.length];
    }
    setCredPlainPassword(res);
  };

  // Calculate Password Strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'None', width: '0%', color: 'bg-zinc-200' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (pass.length >= 16) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { label: 'Weak', width: '25%', color: 'bg-rose-500' };
    if (score <= 4) return { label: 'Fair', width: '50%', color: 'bg-amber-500' };
    if (score <= 5) return { label: 'Strong', width: '75%', color: 'bg-emerald-500' };
    return { label: 'Excellent', width: '100%', color: 'bg-indigo-600' };
  };

  // Folder Operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFolderName.trim()) return;
    const docId = `folder_${Date.now()}`;
    const payload = {
      id: docId,
      owner_uid: user.uid,
      section: activeSection === 'settings' || activeSection === 'all' ? 'credentials' : (activeSection as 'credentials' | 'bank_cards' | 'custom'),
      folder_name: newFolderName.trim(),
      parent_folder_id: null,
      created_at: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'vault_folders', docId), payload);
      setNewFolderName('');
      setFolderModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `vault_folders/${docId}`);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Items inside will remain in root.')) return;
    try {
      await deleteDoc(doc(db, 'vault_folders', folderId));
      if (currentFolderId === folderId) setCurrentFolderId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vault_folders/${folderId}`);
    }
  };

  // Credential Save
  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCred?.entry_name?.trim()) return;
    setModalSaving(true);
    setModalError('');
    try {
      const docId = editingCred.id || `cred_${Date.now()}`;
      let storedPassword = editingCred.encrypted_password || '';
      if (credPlainPassword) {
        storedPassword = credPlainPassword;
      }

      const payload: VaultCredentialItem = {
        id: docId,
        owner_uid: user.uid,
        folder_id: editingCred.folder_id || null,
        entry_name: editingCred.entry_name.trim(),
        username_email: editingCred.username_email || '',
        encrypted_password: storedPassword,
        website_url: editingCred.website_url || '',
        notes: editingCred.notes || '',
        updated_at: new Date().toISOString(),
        created_at: editingCred.created_at || new Date().toISOString(),
      };

      await setDoc(doc(db, 'vault_credentials', docId), payload, { merge: true });
      setSelectedItem({ type: 'credential', data: payload });
      setCredModalOpen(false);
      setEditingCred(null);
      setCredPlainPassword('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save credential');
    } finally {
      setModalSaving(false);
    }
  };

  // Bank Card Save
  const handleSaveBankCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCard?.label?.trim()) return;
    setModalSaving(true);
    setModalError('');
    try {
      const docId = editingCard.id || `bankcard_${Date.now()}`;
      let encNum = editingCard.encrypted_card_number || '';
      let encCvv = editingCard.encrypted_cvv || '';

      if (cardPlainNumber) encNum = cardPlainNumber.replace(/\s+/g, '');
      if (cardPlainCvv) encCvv = cardPlainCvv;

      const payload: VaultBankCardItem = {
        id: docId,
        owner_uid: user.uid,
        folder_id: editingCard.folder_id || null,
        entry_type: editingCard.entry_type || 'card',
        label: editingCard.label.trim(),
        card_type: editingCard.card_type || 'Visa',
        bank_name: editingCard.bank_name || '',
        cardholder_name: editingCard.cardholder_name || '',
        encrypted_card_number: encNum,
        encrypted_cvv: encCvv,
        expiry_date: editingCard.expiry_date || '12/28',
        additional_info: editingCard.additional_info || '',
        updated_at: new Date().toISOString(),
        created_at: editingCard.created_at || new Date().toISOString(),
      };

      await setDoc(doc(db, 'vault_bank_cards', docId), payload, { merge: true });
      setSelectedItem({ type: 'bank_card', data: payload });
      setCardModalOpen(false);
      setEditingCard(null);
      setCardPlainNumber('');
      setCardPlainCvv('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save bank card');
    } finally {
      setModalSaving(false);
    }
  };

  // Custom Item Save
  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCustom?.title?.trim()) return;
    setModalSaving(true);
    setModalError('');
    try {
      const docId = editingCustom.id || `custom_${Date.now()}`;
      let encPayload = editingCustom.encrypted_data || '';
      if (customPlainData) {
        const payloadObj = { mode: 'text', text: customPlainData };
        encPayload = JSON.stringify(payloadObj);
      }

      const payload: VaultCustomItem = {
        id: docId,
        owner_uid: user.uid,
        folder_id: editingCustom.folder_id || null,
        title: editingCustom.title.trim(),
        encrypted_data: encPayload,
        updated_at: new Date().toISOString(),
        created_at: editingCustom.created_at || new Date().toISOString(),
      };

      await setDoc(doc(db, 'vault_custom', docId), payload, { merge: true });
      setSelectedItem({ type: 'custom', data: payload });
      setCustomModalOpen(false);
      setEditingCustom(null);
      setCustomPlainData('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save secret note');
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Handlers
  const handleDeleteItem = async (item: SelectedItemType) => {
    if (!item) return;
    const name = 
      item.type === 'credential' ? item.data.entry_name :
      item.type === 'bank_card' ? item.data.label : item.data.title;
    
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    try {
      if (item.type === 'credential') {
        await deleteDoc(doc(db, 'vault_credentials', item.data.id));
      } else if (item.type === 'bank_card') {
        await deleteDoc(doc(db, 'vault_bank_cards', item.data.id));
      } else if (item.type === 'custom') {
        await deleteDoc(doc(db, 'vault_custom', item.data.id));
      }
      setSelectedItem(null);
      setShowMobileDetail(false);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Change Master PIN
  // Change Master PIN (4 digits only)
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinValue.length !== 4) {
      setModalError('PIN must be exactly 4 digits');
      return;
    }
    if (newPinValue !== confirmNewPinValue) {
      setModalError('Confirmation PIN does not match');
      return;
    }

    setModalSaving(true);
    setModalError('');
    try {
      await setNewPin(newPinValue);
      setPinChangeModalOpen(false);
      setNewPinValue('');
      setConfirmNewPinValue('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update PIN');
    } finally {
      setModalSaving(false);
    }
  };

  // Unified Filtered Items for Master List
  const unifiedItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'credential' | 'bank_card' | 'custom';
      title: string;
      subtitle: string;
      folderId: string | null;
      icon: any;
      raw: VaultCredentialItem | VaultBankCardItem | VaultCustomItem;
    }> = [];

    if (activeSection === 'all' || activeSection === 'credentials') {
      credentials.forEach((c) => {
        list.push({
          id: `cred_${c.id}`,
          type: 'credential',
          title: c.entry_name,
          subtitle: c.username_email || 'Web Login',
          folderId: c.folder_id,
          icon: KeyRound,
          raw: c,
        });
      });
    }

    if (activeSection === 'all' || activeSection === 'bank_cards') {
      bankCards.forEach((b) => {
        list.push({
          id: `card_${b.id}`,
          type: 'bank_card',
          title: b.label,
          subtitle: `${b.bank_name || 'Bank Card'} • ${b.expiry_date || 'MM/YY'}`,
          folderId: b.folder_id,
          icon: CreditCard,
          raw: b,
        });
      });
    }

    if (activeSection === 'all' || activeSection === 'custom') {
      customItems.forEach((x) => {
        list.push({
          id: `custom_${x.id}`,
          type: 'custom',
          title: x.title,
          subtitle: 'Secure Secret Data',
          folderId: x.folder_id,
          icon: FileLock2,
          raw: x,
        });
      });
    }

    // Filter by Folder & Search
    return list.filter((item) => {
      const matchFolder = currentFolderId ? item.folderId === currentFolderId : true;
      if (!matchFolder) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    });
  }, [activeSection, currentFolderId, credentials, bankCards, customItems, searchQuery]);

  // Current folder details
  const currentFolder = folders.find((f) => f.id === currentFolderId);

  // Vault Lock Screen when locked
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Secret Vault Locked
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Enter your 4-digit PIN to unlock your vault and reveal all passwords, bank cards, and secret notes.
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="flex justify-center items-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const hasDigit = lockScreenPin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  hasDigit
                    ? 'bg-indigo-400 scale-125 shadow-sm shadow-indigo-400/50'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Keyboard Input */}
        <div className="flex justify-center">
          <input
            type="password"
            maxLength={4}
            value={lockScreenPin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setLockScreenPin(val);
              if (val.length === 4) {
                handleLockScreenSubmit(val);
              }
            }}
            placeholder="Type 4-digit PIN"
            autoFocus
            className="w-40 text-center text-lg font-mono tracking-widest px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {lockScreenError && (
          <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs text-center flex items-center justify-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{lockScreenError}</span>
          </div>
        )}

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => {
                if (lockScreenPin.length < 4) {
                  const next = lockScreenPin + digit;
                  setLockScreenPin(next);
                  if (next.length === 4) {
                    handleLockScreenSubmit(next);
                  }
                }
              }}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLockScreenPin('')}
            className="py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              if (lockScreenPin.length < 4) {
                const next = lockScreenPin + '0';
                setLockScreenPin(next);
                if (next.length === 4) {
                  handleLockScreenSubmit(next);
                }
              }
            }}
            className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            disabled={lockScreenPin.length < 4 || isLockScreenSubmitting}
            onClick={() => handleLockScreenSubmit(lockScreenPin)}
            className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center"
          >
            {isLockScreenSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Unlock'}
          </button>
        </div>

        {/* Bypass / Direct Access Button */}
        <div className="pt-2 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => unlockDirectly()}
            className="text-xs text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer underline underline-offset-4"
          >
            Or open without PIN (Direct Access)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 text-indigo-400 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">
                Secret Vault Studio
              </h1>
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Unlock className="w-3 h-3 text-emerald-600" />
                <span>Unlocked • Direct Access</span>
              </span>
              {hasEncryptedItems && (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>{encryptedStats.total} Encrypted {encryptedStats.total === 1 ? 'Secret' : 'Secrets'}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Personal password manager, payment cards & secure notes
            </p>
          </div>
        </div>

        {/* Quick action buttons in header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDismissedRecoveryBanner(false);
              setActiveSection('settings');
              setShowMobileDetail(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors cursor-pointer"
            title="Retrieve and Decrypt all encrypted secrets"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Retrieve Secrets</span>
            {hasEncryptedItems && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-950 text-amber-300 rounded-full text-[10px]">
                {encryptedStats.total}
              </span>
            )}
          </button>

          <button
            onClick={() => lockVault()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 shadow-xs transition-colors cursor-pointer"
            title="Lock Vault with PIN"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Lock Vault</span>
          </button>
        </div>
      </div>

      {/* RETRIEVE & DECRYPT SECRETS BANNER */}
      {(!dismissedRecoveryBanner || hasEncryptedItems) && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 p-4 sm:p-5 shadow-xs space-y-3.5 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs shrink-0 mt-0.5">
                <KeyRound className="w-5 h-5 text-slate-950" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Retrieve & Decrypt Your Private Secrets
                  </h3>
                  {hasEncryptedItems ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-800" />
                      <span>{encryptedStats.total} Encrypted {encryptedStats.total === 1 ? 'Item' : 'Items'} Found</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-700" />
                      <span>All Items Decrypted</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  Strings starting with <code className="font-mono font-bold bg-amber-200/60 px-1 py-0.5 rounded text-amber-950">enc:v1:...</code> are your AES-GCM 256-bit encrypted data. They are 100% intact and safe! Enter your Vault PIN below to retrieve and reveal your original secret data. Decrypted items are permanently saved in clean plain text so they never lock again.
                </p>
                {hasEncryptedItems && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-white/70 border border-amber-200">
                      🔑 {encryptedStats.credCount} Passwords
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/70 border border-amber-200">
                      💳 {encryptedStats.cardCount} Bank Cards
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/70 border border-amber-200">
                      📝 {encryptedStats.customCount} Secret Notes
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setDismissedRecoveryBanner(true)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-amber-200/50 transition-colors"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* PIN Input & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <div className="relative flex-1 max-w-md">
              <input
                type={showPinInInput ? 'text' : 'password'}
                value={recoveryPinInput}
                onChange={(e) => setRecoveryPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRetrieveWithPin();
                }}
                placeholder="Enter your Vault PIN (e.g. 1234 or your PIN)..."
                className="w-full pl-3.5 pr-10 py-2 text-xs font-mono bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder:font-sans placeholder:text-slate-400 text-slate-900 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPinInInput(!showPinInInput)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title={showPinInInput ? 'Hide PIN' : 'Show PIN'}
              >
                {showPinInInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              disabled={isRetrieving || !recoveryPinInput.trim()}
              onClick={() => handleRetrieveWithPin()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {isRetrieving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Decrypting Secrets...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Retrieve & Decrypt All Secrets</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowDirectDecoder(!showDirectDecoder)}
              className="px-3 py-2 rounded-xl bg-amber-200/70 hover:bg-amber-300/80 text-amber-950 font-semibold text-xs border border-amber-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{showDirectDecoder ? 'Hide String Tester' : 'Test Single String'}</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {retrievalStatus && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                retrievalStatus.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              {retrievalStatus.success ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{retrievalStatus.message}</span>
            </div>
          )}

          {/* Optional Direct String Decoder */}
          {showDirectDecoder && (
            <div className="pt-3 border-t border-amber-200/80 space-y-2 bg-white/70 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                Direct Ciphertext Decoder Tester
              </span>
              <p className="text-[11px] text-slate-600">
                Paste any encrypted string (like <code className="font-mono text-slate-800">enc:v1:...</code>) and test decrypting it directly:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={directCipherInput}
                  onChange={(e) => setDirectCipherInput(e.target.value)}
                  placeholder="Paste enc:v1:..."
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={directPinInput}
                    onChange={(e) => setDirectPinInput(e.target.value)}
                    placeholder="Enter PIN"
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    disabled={isDirectDecoding || !directCipherInput.trim() || !directPinInput.trim()}
                    onClick={handleTestDirectDecode}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    {isDirectDecoding ? 'Decoding...' : 'Decode'}
                  </button>
                </div>
              </div>
              {directDecodeResult && (
                <div className="p-2.5 rounded-lg bg-slate-900 text-white font-mono text-xs break-all">
                  <span className="text-slate-400 text-[10px] block font-sans">Decoded Result:</span>
                  <span className="text-emerald-400 select-all">{directDecodeResult}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MASTER-DETAIL STUDIO CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[680px] items-stretch">
        
        {/* 1. LEFT NAVIGATION RAIL (3 cols on lg) */}
        <div className="lg:col-span-3 flex flex-col space-y-4 bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-2xs">
          {/* Quick Categories Navigation */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">
              Vault Categories
            </span>

            {[
              { id: 'all' as const, label: 'All Vault Items', icon: Layers, count: credentials.length + bankCards.length + customItems.length },
              { id: 'credentials' as const, label: 'Logins & Passwords', icon: KeyRound, count: credentials.length },
              { id: 'bank_cards' as const, label: 'Bank & Cards', icon: CreditCard, count: bankCards.length },
              { id: 'custom' as const, label: 'Secure Notes & Keys', icon: FileLock2, count: customItems.length },
              { id: 'settings' as const, label: 'Security & Settings', icon: SettingsIcon },
            ].map((cat) => {
              const isActive = activeSection === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveSection(cat.id);
                    setCurrentFolderId(null);
                    if (cat.id === 'settings') {
                      setShowMobileDetail(true);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                    <span>{cat.label}</span>
                  </div>
                  {cat.id === 'settings' && hasEncryptedItems ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950 animate-pulse">
                      Action
                    </span>
                  ) : cat.count !== undefined ? (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-slate-800 text-indigo-300' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {cat.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Folders Section */}
          <div className="pt-3 border-t border-zinc-100 space-y-2 flex-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Folders & Tags
              </span>
              <button
                onClick={() => setFolderModalOpen(true)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  currentFolderId === null
                    ? 'bg-indigo-50 text-indigo-900 font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-zinc-400" />
                <span>All Folders</span>
              </button>

              {folders.map((f) => (
                <div
                  key={f.id}
                  className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    currentFolderId === f.id
                      ? 'bg-indigo-50 text-indigo-900 font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                  onClick={() => setCurrentFolderId(f.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">{f.folder_name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(f.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 transition-opacity p-0.5"
                    title="Delete folder"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. MASTER ITEMS LIST (4 cols on lg) */}
        <div className={`lg:col-span-4 flex flex-col space-y-3 bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-2xs ${
          showMobileDetail ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Search & Actions Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  {currentFolder ? currentFolder.folder_name : activeSection === 'all' ? 'All Secrets' : activeSection.replace('_', ' ')}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {unifiedItems.length} {unifiedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Add Item Action */}
              <div className="flex items-center gap-1">
                {activeSection === 'credentials' || activeSection === 'all' ? (
                  <button
                    onClick={() => {
                      setEditingCred({});
                      setCredPlainPassword('');
                      setCredModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                    title="Add Password"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Login</span>
                  </button>
                ) : null}

                {activeSection === 'bank_cards' || activeSection === 'all' ? (
                  <button
                    onClick={() => {
                      setEditingCard({});
                      setCardPlainNumber('');
                      setCardPlainCvv('');
                      setCardModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                    title="Add Bank Card"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>
                ) : null}

                {activeSection === 'custom' ? (
                  <button
                    onClick={() => {
                      setEditingCustom({});
                      setCustomPlainData('');
                      setCustomModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                    title="Add Secret Note"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Secret</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Quick Filter Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search secrets, cards, logins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scannable Items List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[580px]">
            {unifiedItems.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 space-y-2">
                <Shield className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="text-xs font-medium">No vault records found.</p>
                <p className="text-[11px] text-zinc-400">
                  Tap "+ Login" or "+ Card" above to encrypt your first secret.
                </p>
              </div>
            ) : (
              unifiedItems.map((item) => {
                const isSelected = selectedItem?.data.id === item.raw.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItem({ type: item.type, data: item.raw } as any);
                      setShowMobileDetail(true);
                    }}
                    className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-white hover:bg-zinc-50 border-zinc-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        item.type === 'credential'
                          ? 'bg-indigo-100 text-indigo-700'
                          : item.type === 'bank_card'
                          ? 'bg-slate-900 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.title.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <h4 className="text-xs font-bold text-zinc-900 truncate">
                            {item.title}
                          </h4>
                          {(() => {
                            let isEnc = false;
                            if (item.type === 'credential') {
                              const r = item.raw as VaultCredentialItem;
                              isEnc = Boolean((r.encrypted_password?.startsWith('enc:v1:') || r.encrypted_password?.startsWith('v1:')) && !decryptedValues[`cred_${r.id}`]);
                            } else if (item.type === 'bank_card') {
                              const r = item.raw as VaultBankCardItem;
                              isEnc = Boolean(((r.encrypted_card_number?.startsWith('enc:v1:') || r.encrypted_card_number?.startsWith('v1:')) && !decryptedValues[`card_num_${r.id}`]) ||
                                      ((r.encrypted_cvv?.startsWith('enc:v1:') || r.encrypted_cvv?.startsWith('v1:')) && !decryptedValues[`card_cvv_${r.id}`]));
                            } else if (item.type === 'custom') {
                              const r = item.raw as VaultCustomItem;
                              isEnc = Boolean((r.encrypted_data?.startsWith('enc:v1:') || r.encrypted_data?.startsWith('v1:')) && !decryptedValues[`custom_${r.id}`]);
                            }
                            if (isEnc) {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded shrink-0">
                                  <Lock className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Encrypted</span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate font-mono">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick 1-click copy for primary identifier */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const copyVal = 
                            item.type === 'credential'
                              ? (item.raw as VaultCredentialItem).username_email
                              : item.title;
                          handleCopy(copyVal, `list_${item.id}`);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-zinc-200/60 rounded-lg text-zinc-500 transition-opacity cursor-pointer"
                        title="Copy username"
                      >
                        {copiedId === `list_${item.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-zinc-300'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. DETAIL INSPECTOR (5 cols on lg) */}
        <div className={`lg:col-span-5 flex flex-col space-y-4 bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 shadow-2xs ${
          showMobileDetail ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Mobile Back Button */}
          <div className="lg:hidden pb-2 border-b border-zinc-100">
            <button
              onClick={() => setShowMobileDetail(false)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Secret List</span>
            </button>
          </div>

          {/* Active Section: Settings Panel */}
          {activeSection === 'settings' ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Vault Preferences & Status</h3>
                <p className="text-xs text-zinc-500">Vault status, configuration, and security options</p>
              </div>

              {/* REAL-TIME SECURITY POSTURE AUDIT */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold tracking-tight">Active Security Posture</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    Zero-Knowledge
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Lock Protection</span>
                    <span className="font-mono text-emerald-300 font-bold">Completely Removed</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vault Mode</span>
                    <span className="font-mono text-emerald-300 font-bold">Always Open & Unlocked</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Data Storage</span>
                    <span className="font-mono text-emerald-300 font-bold">Plain Text (No Encryption)</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Access Barrier</span>
                    <span className="font-mono text-emerald-300 font-bold">{isUnlocked ? 'Unlocked • Direct Access' : 'PIN Required'}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Zero-Knowledge architecture. Your private data is never exposed. You can retrieve legacy encrypted data into plain text or lock your vault with your 4-digit PIN.
                </p>
              </div>

              {/* 1. RETRIEVE & DECRYPT ALL SECRETS TOOL */}
              <div className="p-4 sm:p-5 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/70 shadow-sm space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs shrink-0 mt-0.5">
                    <KeyRound className="w-5 h-5 text-slate-950" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                        Retrieve & Decrypt All Secrets
                      </h4>
                      {hasEncryptedItems ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-800" />
                          <span>{encryptedStats.total} Encrypted {encryptedStats.total === 1 ? 'Secret' : 'Secrets'}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>All Secrets Decrypted</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Strings starting with <code className="font-mono font-bold bg-amber-200/60 px-1 py-0.5 rounded text-amber-950">enc:v1:...</code> are your AES-GCM 256-bit encrypted data. Enter your Vault PIN below to decode all items and permanently convert them into clean plain text.
                    </p>

                    {hasEncryptedItems && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-amber-200">
                          🔑 {encryptedStats.credCount} Passwords
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-amber-200">
                          💳 {encryptedStats.cardCount} Bank Cards
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-amber-200">
                          📝 {encryptedStats.customCount} Secret Notes
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input & Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type={showPinInInput ? 'text' : 'password'}
                      value={recoveryPinInput}
                      onChange={(e) => setRecoveryPinInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRetrieveWithPin();
                      }}
                      placeholder="Enter your Vault PIN (e.g. 1234 or your PIN)..."
                      className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinInInput(!showPinInInput)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title={showPinInInput ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showPinInInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isRetrieving || !recoveryPinInput.trim()}
                    onClick={() => handleRetrieveWithPin()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {isRetrieving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Decrypting...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Retrieve & Decrypt All Secrets</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Feedback message banner */}
                {retrievalStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                      retrievalStatus.success
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-rose-50 border-rose-300 text-rose-800'
                    }`}
                  >
                    {retrievalStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="flex-1">{retrievalStatus.message}</span>
                  </div>
                )}
              </div>

              {/* 2. VAULT LOCK & SECURITY CONTROLS */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-bold text-zinc-900">Vault Lock & Security Controls</h4>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isUnlocked 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {isUnlocked ? 'Vault Unlocked' : 'Vault Locked'}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  You can lock your vault anytime with your 4-digit PIN, or configure PIN lock protection.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => lockVault()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Lock Vault Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPinChangeModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Change / Set 4-Digit PIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (bypassed) {
                        enablePinLock();
                      } else {
                        disableLockCompletely();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      bypassed
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{bypassed ? 'Enable PIN Lock Protection' : 'Lock Active (Click to Disable)'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : selectedItem ? (
            /* Selected Item Inspector */
            <div className="space-y-5 flex-1 flex flex-col">
              {/* Item Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm ${
                    selectedItem.type === 'credential'
                      ? 'bg-indigo-600 text-white'
                      : selectedItem.type === 'bank_card'
                      ? 'bg-slate-900 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {selectedItem.type === 'credential' ? (
                      <KeyRound className="w-5 h-5" />
                    ) : selectedItem.type === 'bank_card' ? (
                      <CreditCard className="w-5 h-5" />
                    ) : (
                      <FileLock2 className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                      {selectedItem.type === 'credential'
                        ? selectedItem.data.entry_name
                        : selectedItem.type === 'bank_card'
                        ? selectedItem.data.label
                        : selectedItem.data.title}
                    </h2>
                    <span className="text-[11px] font-semibold text-indigo-600 capitalize">
                      {selectedItem.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (selectedItem.type === 'credential') {
                        setEditingCred(selectedItem.data);
                        setCredPlainPassword(selectedItem.data.encrypted_password || '');
                        setCredModalOpen(true);
                      } else if (selectedItem.type === 'bank_card') {
                        setEditingCard(selectedItem.data);
                        setCardPlainNumber(selectedItem.data.encrypted_card_number || '');
                        setCardPlainCvv(selectedItem.data.encrypted_cvv || '');
                        setCardModalOpen(true);
                      } else if (selectedItem.type === 'custom') {
                        setEditingCustom(selectedItem.data);
                        const raw = selectedItem.data.encrypted_data || '';
                        if (raw.startsWith('enc:v1:') || raw.startsWith('v1:')) {
                          decryptText(raw, activeKey).then((dec) => {
                            const parsed = parseCustomPayload(dec);
                            if (parsed.mode === 'kv' && Array.isArray(parsed.kv)) {
                              setCustomPlainData(parsed.kv.map((p) => `${p.key}: ${p.value}`).join('\n'));
                            } else {
                              setCustomPlainData(parsed.text || '');
                            }
                          }).catch(() => setCustomPlainData(''));
                        } else {
                          const parsed = parseCustomPayload(raw);
                          if (parsed.mode === 'kv' && Array.isArray(parsed.kv)) {
                            setCustomPlainData(parsed.kv.map((p) => `${p.key}: ${p.value}`).join('\n'));
                          } else {
                            setCustomPlainData(parsed.text || '');
                          }
                        }
                        setCustomModalOpen(true);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(selectedItem)}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CREDENTIAL DETAILS INSPECTOR */}
              {selectedItem.type === 'credential' && (
                <div className="space-y-4">
                  {/* Username / Email */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Username / Email
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-zinc-900 select-all truncate">
                        {selectedItem.data.username_email || 'No username specified'}
                      </span>
                      {selectedItem.data.username_email && (
                        <button
                          onClick={() => handleCopy(selectedItem.data.username_email, 'inspect_user')}
                          className="p-1 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                          title="Copy username"
                        >
                          {copiedId === 'inspect_user' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Website URL */}
                  {selectedItem.data.website_url && (
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Website & Direct Launch
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-700 truncate">
                          {selectedItem.data.website_url}
                        </span>
                        <a
                          href={selectedItem.data.website_url.startsWith('http') ? selectedItem.data.website_url : `https://${selectedItem.data.website_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>Launch</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Password Display */}
                  {(() => {
                    const rawPass = selectedItem.data.encrypted_password || '';
                    const isEnc = (rawPass.startsWith('enc:v1:') || rawPass.startsWith('v1:')) && !decryptedValues[`cred_${selectedItem.data.id}`];
                    const plainPass = isEnc ? '' : (getItemSecret(rawPass, `cred_${selectedItem.data.id}`) || rawPass);
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5 shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Password
                          </span>
                          {isEnc ? (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Encrypted with PIN</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Plain Text</span>
                            </span>
                          )}
                        </div>

                        {isEnc ? (
                          <div className="space-y-2 bg-slate-800/90 p-3 rounded-xl border border-amber-500/30">
                            <p className="text-xs text-amber-300 font-sans">
                              This password is encrypted. Enter your Vault PIN to reveal it:
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={inlineDetailPin}
                                onChange={(e) => setInlineDetailPin(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRetrieveWithPin(inlineDetailPin);
                                }}
                                placeholder="Enter PIN..."
                                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                              />
                              <button
                                type="button"
                                disabled={isRetrieving || !inlineDetailPin.trim()}
                                onClick={() => handleRetrieveWithPin(inlineDetailPin)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                              >
                                {isRetrieving ? 'Decrypting...' : 'Reveal'}
                              </button>
                            </div>
                            <details className="text-[10px] text-slate-400 cursor-pointer pt-1">
                              <summary className="hover:text-slate-200">Inspect raw ciphertext ({rawPass.slice(0, 20)}...)</summary>
                              <p className="mt-1 font-mono text-[10px] bg-slate-950 p-2 rounded border border-slate-800 break-all select-all text-slate-300">
                                {rawPass}
                              </p>
                            </details>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700/80">
                              <span className="font-mono text-sm tracking-wider select-all truncate text-white">
                                {plainPass || '(No password set)'}
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(plainPass, 'inspect_pass')}
                                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg cursor-pointer transition-colors"
                                  title="Copy password"
                                >
                                  {copiedId === 'inspect_pass' ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Password Strength Meter */}
                            {plainPass && (
                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400">Password Strength:</span>
                                  <span className="font-bold text-slate-200">
                                    {getPasswordStrength(plainPass).label}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${getPasswordStrength(plainPass).color}`}
                                    style={{ width: getPasswordStrength(plainPass).width }}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Notes */}
                  {selectedItem.data.notes && (
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Notes & Recovery Prompts
                      </span>
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {selectedItem.data.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* BANK CARD VIRTUAL CARD INSPECTOR */}
              {selectedItem.type === 'bank_card' && (
                <div className="space-y-4">
                  {/* Obsidian / Royal Gradient Virtual Card Mockup */}
                  <div className="w-full rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xl border border-indigo-500/20 relative overflow-hidden space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                        {selectedItem.data.bank_name || 'Bank Card'}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 font-bold uppercase tracking-wider text-slate-200">
                        {selectedItem.data.card_type || 'Visa'}
                      </span>
                    </div>

                    {/* EMV Chip Graphic */}
                    <div className="w-10 h-7 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                      <div className="w-7 h-4 border border-amber-600/50 rounded-xs" />
                    </div>

                    {/* Plain Card Number */}
                    {(() => {
                      const rawCardNum = getItemSecret(selectedItem.data.encrypted_card_number, `card_num_${selectedItem.data.id}`) || selectedItem.data.encrypted_card_number || '';
                      const isNumEnc = (rawCardNum.startsWith('enc:v1:') || rawCardNum.startsWith('v1:')) && !decryptedValues[`card_num_${selectedItem.data.id}`];
                      const displayNum = isNumEnc 
                        ? '•••• •••• •••• ••••' 
                        : (rawCardNum ? rawCardNum.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••');

                      const rawCvv = getItemSecret(selectedItem.data.encrypted_cvv, `card_cvv_${selectedItem.data.id}`) || selectedItem.data.encrypted_cvv || '';
                      const isCvvEnc = (rawCvv.startsWith('enc:v1:') || rawCvv.startsWith('v1:')) && !decryptedValues[`card_cvv_${selectedItem.data.id}`];
                      const displayCvv = isCvvEnc ? '•••' : (rawCvv || '•••');

                      return (
                        <>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between font-mono text-base sm:text-lg tracking-widest text-white select-all">
                              <span>{displayNum}</span>
                              {!isNumEnc && rawCardNum && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(rawCardNum, `card_num_${selectedItem.data.id}`)}
                                  className="p-1 text-slate-300 hover:text-white cursor-pointer"
                                  title="Copy card number"
                                >
                                  {copiedId === `card_num_${selectedItem.data.id}` ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Cardholder & Expiry & CVV */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Cardholder</span>
                              <span className="font-semibold tracking-wider">{selectedItem.data.cardholder_name || 'VALUED MEMBER'}</span>
                            </div>

                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Expires</span>
                                <span className="font-mono">{selectedItem.data.expiry_date || '12/28'}</span>
                              </div>

                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">CVV</span>
                                <div className="flex items-center gap-1 font-mono">
                                  <span className="text-amber-300 font-bold select-all">{displayCvv}</span>
                                  {!isCvvEnc && rawCvv && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(rawCvv, `card_cvv_${selectedItem.data.id}`)}
                                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                                      title="Copy CVV"
                                    >
                                      {copiedId === `card_cvv_${selectedItem.data.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Inline PIN unlock if card details are encrypted */}
                  {(() => {
                    const rawNum = selectedItem.data.encrypted_card_number || '';
                    const rawC = selectedItem.data.encrypted_cvv || '';
                    const isEnc = 
                      ((rawNum.startsWith('enc:v1:') || rawNum.startsWith('v1:')) && !decryptedValues[`card_num_${selectedItem.data.id}`]) ||
                      ((rawC.startsWith('enc:v1:') || rawC.startsWith('v1:')) && !decryptedValues[`card_cvv_${selectedItem.data.id}`]);

                    if (!isEnc) return null;

                    return (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Lock className="w-4 h-4 text-amber-700" />
                          <span>Card details are encrypted with your PIN</span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Enter your Vault PIN to decrypt and permanently reveal your card number and CVV:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={inlineDetailPin}
                            onChange={(e) => setInlineDetailPin(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRetrieveWithPin(inlineDetailPin);
                            }}
                            placeholder="Enter Vault PIN..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            disabled={isRetrieving || !inlineDetailPin.trim()}
                            onClick={() => handleRetrieveWithPin(inlineDetailPin)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-colors"
                          >
                            {isRetrieving ? 'Decrypting...' : 'Reveal Card'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card Details Summary */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Card Details</span>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Label / Name:</span>
                      <span className="font-semibold text-zinc-900">{selectedItem.data.label}</span>
                    </div>
                    {selectedItem.data.account_holder_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Account Holder:</span>
                        <span className="font-semibold text-zinc-900">{selectedItem.data.account_holder_name}</span>
                      </div>
                    )}
                    {selectedItem.data.encrypted_account_number && (() => {
                      const plainAcc = getItemSecret(selectedItem.data.encrypted_account_number, `bank_acc_${selectedItem.data.id}`) || selectedItem.data.encrypted_account_number;
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Account Number:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-zinc-900 select-all">
                              {plainAcc}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(plainAcc, `bank_acc_${selectedItem.data.id}`)}
                              className="p-1 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                              title="Copy Account Number"
                            >
                              {copiedId === `bank_acc_${selectedItem.data.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    {selectedItem.data.additional_info && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Additional Info:</span>
                        <span className="font-mono text-zinc-900 truncate">{selectedItem.data.additional_info}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CUSTOM SECRET NOTE INSPECTOR */}
              {selectedItem.type === 'custom' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Secret Title
                    </span>
                    <p className="text-xs font-bold text-amber-950">
                      {selectedItem.data.title}
                    </p>
                  </div>

                  {(() => {
                    const rawSecret = getItemSecret(selectedItem.data.encrypted_data, `custom_${selectedItem.data.id}`) || selectedItem.data.encrypted_data || '';
                    const isEnc = (rawSecret.startsWith('enc:v1:') || rawSecret.startsWith('v1:')) && !decryptedValues[`custom_${selectedItem.data.id}`];

                    return (
                      <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Secret Content
                          </span>
                          {isEnc ? (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Encrypted with PIN</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Plain Text</span>
                            </span>
                          )}
                        </div>

                        {isEnc ? (
                          <div className="p-3.5 bg-slate-800/90 rounded-xl border border-amber-500/30 space-y-3">
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                                <Lock className="w-4 h-4 text-amber-400" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-amber-200">
                                  Encrypted Secret Information
                                </h4>
                                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                                  This secret was encrypted using your Vault PIN (<code className="text-amber-300">enc:v1:...</code>). Enter your PIN below to decrypt and retrieve it:
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="password"
                                value={inlineDetailPin}
                                onChange={(e) => setInlineDetailPin(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRetrieveWithPin(inlineDetailPin);
                                }}
                                placeholder="Enter Vault PIN..."
                                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                              />
                              <button
                                type="button"
                                disabled={isRetrieving || !inlineDetailPin.trim()}
                                onClick={() => handleRetrieveWithPin(inlineDetailPin)}
                                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-colors"
                              >
                                {isRetrieving ? 'Decrypting...' : 'Reveal & Decrypt'}
                              </button>
                            </div>

                            <details className="text-[10px] text-slate-400 cursor-pointer pt-1">
                              <summary className="hover:text-slate-200 font-sans">Inspect raw ciphertext ({rawSecret.slice(0, 24)}...)</summary>
                              <p className="mt-1 font-mono text-[10px] bg-slate-950 p-2.5 rounded border border-slate-800 break-all select-all text-slate-300">
                                {rawSecret}
                              </p>
                            </details>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 min-h-[90px]">
                            {(() => {
                              const parsedData = parseCustomPayload(rawSecret);
                              if (parsedData.mode === 'kv' && parsedData.kv.length > 0) {
                                return (
                                  <div className="space-y-2">
                                    {parsedData.kv.map((pair, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-700/80">
                                        <span className="font-semibold text-slate-300 text-xs">{pair.key}:</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-xs text-emerald-300 select-all">{pair.value}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopy(pair.value, `kv_${idx}`)}
                                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                            title="Copy value"
                                          >
                                            {copiedId === `kv_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {parsedData.text.split('\n').length} {parsedData.text.split('\n').length === 1 ? 'line' : 'lines'} • {parsedData.text.length} chars
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(parsedData.text, 'custom_secret_copy')}
                                      className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      {copiedId === 'custom_secret_copy' ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="text-emerald-400">Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                                          <span>Copy Text</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="font-mono text-xs text-emerald-300 whitespace-pre-wrap select-all leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                                    {parsedData.text || '(Empty Note)'}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Metadata Footer */}
              <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Stored locally via Zero-Knowledge</span>
                <span>Updated: {new Date(selectedItem.data.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            /* Empty Inspector State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Secret Detail Inspector</h3>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Select any login credential, virtual bank card, or custom secret from the list to inspect encrypted details.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ADD / EDIT CREDENTIAL (WITH PASSWORD GENERATOR) */}
      {/* ============================================================== */}
      {credModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-900">
                  {editingCred?.id ? 'Edit Login Credential' : 'New Login Credential'}
                </h3>
              </div>
              <button onClick={() => setCredModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCredential} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Service / Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Google, GitHub, Netflix, Stripe..."
                  value={editingCred?.entry_name || ''}
                  onChange={(e) => setEditingCred({ ...editingCred, entry_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Folder</label>
                  <select
                    value={editingCred?.folder_id || ''}
                    onChange={(e) => setEditingCred({ ...editingCred, folder_id: e.target.value || null })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
                  >
                    <option value="">(No Folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.folder_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Website URL</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editingCred?.website_url || ''}
                    onChange={(e) => setEditingCred({ ...editingCred, website_url: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Username / Email</label>
                <input
                  type="text"
                  placeholder="user@example.com"
                  value={editingCred?.username_email || ''}
                  onChange={(e) => setEditingCred({ ...editingCred, username_email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              {/* Password with Generator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700">
                    Password (AES-256 Encrypted)
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong</span>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder={editingCred?.id ? '(Leave blank to keep existing password)' : 'Enter or generate password...'}
                  value={credPlainPassword}
                  onChange={(e) => setCredPlainPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Notes / 2FA Hints</label>
                <textarea
                  rows={2}
                  placeholder="Backup codes, security question hints, etc..."
                  value={editingCred?.notes || ''}
                  onChange={(e) => setEditingCred({ ...editingCred, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
                />
              </div>

              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCredModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-zinc-200 hover:bg-zinc-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !editingCred?.entry_name?.trim()}
                  className="px-5 py-1.5 text-xs rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {modalSaving ? 'Encrypting...' : 'Save Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD / EDIT BANK CARD */}
      {/* ============================================================== */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-900">
                  {editingCard?.id ? 'Edit Bank Card' : 'New Bank Card'}
                </h3>
              </div>
              <button onClick={() => setCardModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankCard} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Card Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chase Sapphire, Apple Card..."
                    value={editingCard?.label || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, label: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. JPMorgan, Barclays, Citi..."
                    value={editingCard?.bank_name || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, bank_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="NAME AS SHOWN ON CARD"
                    value={editingCard?.cardholder_name || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, cardholder_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Card Network / Type</label>
                  <select
                    value={editingCard?.card_type || 'Visa'}
                    onChange={(e) => setEditingCard({ ...editingCard, card_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">American Express</option>
                    <option value="Discover">Discover</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Card Number (16 Digits)</label>
                <input
                  type="text"
                  placeholder="4111 2222 3333 4444"
                  value={cardPlainNumber}
                  onChange={(e) => setCardPlainNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Expiry Date (MM/YY)</label>
                  <input
                    type="text"
                    placeholder="12/28"
                    value={editingCard?.expiry_date || '12/28'}
                    onChange={(e) => setEditingCard({ ...editingCard, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">CVV / Security Code</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="•••"
                    value={cardPlainCvv}
                    onChange={(e) => setCardPlainCvv(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none text-center font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Additional Info / Billing</label>
                <input
                  type="text"
                  placeholder="Billing zip, PIN hint, or special instructions..."
                  value={editingCard?.additional_info || ''}
                  onChange={(e) => setEditingCard({ ...editingCard, additional_info: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
                />
              </div>

              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-zinc-200 hover:bg-zinc-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !editingCard?.label?.trim()}
                  className="px-5 py-1.5 text-xs rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {modalSaving ? 'Encrypting Card...' : 'Save Bank Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD / EDIT CUSTOM SECRET */}
      {/* ============================================================== */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <FileLock2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-900">
                  {editingCustom?.id ? 'Edit Secret Note' : 'New Secret Note'}
                </h3>
              </div>
              <button onClick={() => setCustomModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustom} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Secret Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server SSH Key, 2FA Recovery, Crypto Seed..."
                  value={editingCustom?.title || ''}
                  onChange={(e) => setEditingCustom({ ...editingCustom, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Encrypted Secret Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste confidential API keys, crypto seed phrases, or private notes here..."
                  value={customPlainData}
                  onChange={(e) => setCustomPlainData(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-zinc-200 hover:bg-zinc-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !editingCustom?.title?.trim()}
                  className="px-5 py-1.5 text-xs rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {modalSaving ? 'Encrypting...' : 'Save Secret Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: NEW FOLDER */}
      {/* ============================================================== */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900">Create Vault Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Folder name (e.g. Work, Personal, Crypto)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFolderModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-1.5 text-xs rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: CHANGE VAULT MASTER PIN (4 DIGITS ONLY) */}
      {/* ============================================================== */}
      {pinChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900">Change 4-Digit PIN</h3>
            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono text-center tracking-widest text-base"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Confirm 4-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPinValue}
                  onChange={(e) => setConfirmNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none font-mono text-center tracking-widest text-base"
                />
              </div>

              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setPinChangeModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-zinc-200 hover:bg-zinc-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || newPinValue.length !== 4}
                  className="px-5 py-1.5 text-xs rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {modalSaving ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
