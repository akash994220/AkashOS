import React, { useState, useEffect } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { useVault } from '../../context/VaultContext';
import { VaultCredentialItem, VaultFolder } from '../../types/vault';
import { encryptText, decryptText } from '../../lib/crypto';
import { ResponsiveListItem } from '../common/ResponsiveListItem';
import { 
  KeyRound, 
  Copy, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check,
  Folder,
  Search,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface VaultCredentialsViewProps {
  items: VaultCredentialItem[];
  folders: VaultFolder[];
  currentFolderId: string | null;
  onSave: (item: Partial<VaultCredentialItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const VaultCredentialsView: React.FC<VaultCredentialsViewProps> = ({
  items,
  folders,
  currentFolderId,
  onSave,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { activeKey } = useVault();

  // Reveal state: map of itemId -> decrypted password string
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<VaultCredentialItem> | null>(null);
  const [plainPasswordInput, setPlainPasswordInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Password generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const generateSecurePassword = () => {
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (genUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genNumbers) chars += '0123456789';
    if (genSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const array = new Uint32Array(genLength);
    crypto.getRandomValues(array);
    let pwd = '';
    for (let i = 0; i < genLength; i++) {
      pwd += chars[array[i] % chars.length];
    }
    setGeneratedPassword(pwd);
  };

  // Filter items by folder and search query
  const displayedItems = items.filter((it) => (it.folder_id || null) === currentFolderId);
  const filteredItems = displayedItems.filter((it) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (it.entry_name || '').toLowerCase().includes(q) ||
      (it.username_email || '').toLowerCase().includes(q) ||
      (it.website_url || '').toLowerCase().includes(q) ||
      (it.notes || '').toLowerCase().includes(q)
    );
  });

  // Auto-mask password after 15 seconds
  const toggleReveal = async (item: VaultCredentialItem) => {
    if (revealedPasswords[item.id]) {
      // Hide
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      // Reveal
      const decrypted = (await decryptText(item.encrypted_password, activeKey)) || item.encrypted_password;
      setRevealedPasswords((prev) => ({ ...prev, [item.id]: decrypted }));

      // Set timeout to auto-mask
      setTimeout(() => {
        setRevealedPasswords((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 15000);
    }
  };

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(identifier);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyDecryptedPassword = async (item: VaultCredentialItem) => {
    const pass = revealedPasswords[item.id] || (await decryptText(item.encrypted_password, activeKey)) || item.encrypted_password;
    copyToClipboard(pass, `pass-${item.id}`);
  };

  const handleOpenAdd = () => {
    setEditingItem({
      folder_id: currentFolderId,
      entry_name: '',
      username_email: '',
      website_url: '',
      notes: '',
    });
    setPlainPasswordInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (item: VaultCredentialItem) => {
    setEditingItem(item);
    if (item.encrypted_password) {
      const dec = (await decryptText(item.encrypted_password, activeKey)) || item.encrypted_password;
      setPlainPasswordInput(dec);
    } else {
      setPlainPasswordInput('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.entry_name) return;
    setSaving(true);

    try {
      let storedPassword = editingItem.encrypted_password || '';
      if (plainPasswordInput) {
        storedPassword = plainPasswordInput;
      }

      await onSave({
        ...editingItem,
        folder_id: editingItem.folder_id || null,
        encrypted_password: storedPassword,
      });

      setIsModalOpen(false);
      setEditingItem(null);
      setPlainPasswordInput('');
    } catch (err: any) {
      alert(err?.message || 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Search and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search credentials by title, user, service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.full,
              borderColor: theme.colors.borderLight,
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border focus:outline-none placeholder:text-zinc-400 text-zinc-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          id="add-credential-btn"
          onClick={handleOpenAdd}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.full,
            minHeight: '34px',
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Credential</span>
        </button>
      </div>

      {/* List of items */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            {searchQuery ? `No credentials matching "${searchQuery}"` : 'No credentials in this folder yet.'}
          </div>
        ) : (
          filteredItems.map((item) => {
          const isRevealed = Boolean(revealedPasswords[item.id]);
          const currentFolder = folders.find((f) => f.id === item.folder_id);

          return (
            <ResponsiveListItem
              key={item.id}
              desktopContent={
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-zinc-700 shrink-0" />
                      <h4 className="text-xs sm:text-sm font-bold truncate" style={{ color: theme.colors.textPrimary }}>
                        {item.entry_name}
                      </h4>
                      {currentFolder && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 flex items-center gap-1">
                          <Folder className="w-2.5 h-2.5" />
                          {currentFolder.folder_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-800 select-all">{item.username_email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.username_email, `user-${item.id}`)}
                          className="p-1 hover:text-zinc-900 text-zinc-400 cursor-pointer"
                          title="Copy username"
                        >
                          {copiedField === `user-${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {item.website_url && (
                        <a
                          href={item.website_url.startsWith('http') ? item.website_url : `https://${item.website_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-zinc-500 hover:text-indigo-600 truncate max-w-[200px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{item.website_url.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{item.notes}</p>
                    )}
                  </div>

                  {/* Password controls & actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-zinc-100 px-2 py-1 rounded border border-zinc-200">
                      <span className="font-mono text-xs text-zinc-800 min-w-[80px]">
                        {isRevealed ? revealedPasswords[item.id] : '••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleReveal(item)}
                        className="p-1 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                        title={isRevealed ? 'Mask password' : 'Tap to reveal password'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyDecryptedPassword(item)}
                        className="p-1 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                        title="Copy password"
                      >
                        {copiedField === `pass-${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 cursor-pointer"
                      title="Edit credential"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete credential "${item.entry_name}"?`)) {
                          onDelete(item.id);
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                      title="Delete credential"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              }
              mobileContent={
                <div className="space-y-3">
                  {/* Top: Name & Folder */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <KeyRound className="w-4 h-4 text-zinc-700 shrink-0" />
                      <h4 className="text-sm font-bold truncate" style={{ color: theme.colors.textPrimary }}>
                        {item.entry_name}
                      </h4>
                    </div>
                    {currentFolder && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 flex items-center gap-1 shrink-0">
                        <Folder className="w-2.5 h-2.5" />
                        {currentFolder.folder_name}
                      </span>
                    )}
                  </div>

                  {/* Middle details: Username + Website link */}
                  <div className="space-y-1.5 text-xs text-zinc-600">
                    <div className="flex items-center justify-between bg-zinc-50 px-2.5 py-1.5 rounded border border-zinc-200/80">
                      <span className="font-mono text-zinc-800 select-all truncate">{item.username_email}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.username_email, `user-${item.id}`)}
                        className="p-1.5 hover:text-zinc-900 text-zinc-500 cursor-pointer shrink-0"
                        title="Copy username"
                      >
                        {copiedField === `user-${item.id}` ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {item.website_url && (
                      <a
                        href={item.website_url.startsWith('http') ? item.website_url : `https://${item.website_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-zinc-500 hover:text-indigo-600 truncate py-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.website_url.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}

                    {item.notes && (
                      <p className="text-[11px] text-zinc-500 line-clamp-2 pt-0.5">{item.notes}</p>
                    )}
                  </div>

                  {/* Bottom: Password box and Action Buttons */}
                  <div
                    style={{
                      borderTop: `1px solid ${theme.colors.borderLight}`,
                      paddingTop: theme.spacing.xs,
                    }}
                    className="flex items-center justify-between gap-2 pt-2"
                  >
                    <div className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1.5 rounded border border-zinc-200 flex-1 min-w-0">
                      <span className="font-mono text-xs text-zinc-800 truncate flex-1">
                        {isRevealed ? revealedPasswords[item.id] : '••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleReveal(item)}
                        style={{ minHeight: '36px', minWidth: '36px' }}
                        className="flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        title={isRevealed ? 'Mask password' : 'Tap to reveal password'}
                      >
                        {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyDecryptedPassword(item)}
                        style={{ minHeight: '36px', minWidth: '36px' }}
                        className="flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        title="Copy password"
                      >
                        {copiedField === `pass-${item.id}` ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        style={{ minHeight: '44px', minWidth: '44px' }}
                        className="flex items-center justify-center text-zinc-500 hover:text-zinc-800 rounded hover:bg-zinc-100 cursor-pointer"
                        title="Edit credential"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete credential "${item.entry_name}"?`)) {
                            onDelete(item.id);
                          }
                        }}
                        style={{ minHeight: '44px', minWidth: '44px' }}
                        className="flex items-center justify-center text-zinc-500 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                        title="Delete credential"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              }
            />
          );
        }))}

        {displayedItems.length === 0 && (
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xl,
            }}
            className="text-center text-xs text-zinc-400"
          >
            No credentials in this folder. Tap "+ Add Credential" to save your first account.
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.lg,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '460px',
              width: '100%',
              padding: theme.spacing.lg,
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                {editingItem.id ? 'Edit Credential' : 'Add Credential'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-zinc-100"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Entry Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. GitHub, Google, Stripe..."
                  value={editingItem.entry_name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, entry_name: e.target.value })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Folder Assignment
                </label>
                <select
                  value={editingItem.folder_id || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, folder_id: e.target.value || null })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none"
                >
                  <option value="">(Root - No Folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.folder_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Username / Email
                </label>
                <input
                  type="text"
                  placeholder="user@example.com"
                  value={editingItem.username_email || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, username_email: e.target.value })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Password (Encrypted client-side with AES-256)
                </label>
                <input
                  type="text"
                  placeholder="Enter password..."
                  value={plainPasswordInput}
                  onChange={(e) => setPlainPasswordInput(e.target.value)}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none font-poppins tabular-nums"
                />

                {/* Password Generator Accordion */}
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!showGenerator && !generatedPassword) {
                        generateSecurePassword();
                      }
                      setShowGenerator(!showGenerator);
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{showGenerator ? 'Hide Password Generator' : 'Generate Strong Password'}</span>
                  </button>

                  {showGenerator && (
                    <div className="mt-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-poppins tabular-nums font-bold text-xs text-blue-950 bg-white p-2 rounded-lg border border-blue-200 flex-1 truncate select-all">
                          {generatedPassword || 'Click Generate'}
                        </div>
                        <button
                          type="button"
                          onClick={generateSecurePassword}
                          className="p-2 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 cursor-pointer"
                          title="Generate new password"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (generatedPassword) {
                              setPlainPasswordInput(generatedPassword);
                              setShowGenerator(false);
                            }
                          }}
                          className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Use Password
                        </button>
                      </div>

                      {/* Length slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-600">
                          <span>Length: {genLength} characters</span>
                        </div>
                        <input
                          type="range"
                          min={8}
                          max={32}
                          value={genLength}
                          onChange={(e) => {
                            setGenLength(Number(e.target.value));
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Character Toggles */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-700 flex-wrap">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={genUppercase}
                            onChange={(e) => setGenUppercase(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>A-Z</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={genNumbers}
                            onChange={(e) => setGenNumbers(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>0-9</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={genSymbols}
                            onChange={(e) => setGenSymbols(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>!@#$</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editingItem.website_url || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, website_url: e.target.value })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Security questions, PINs, recovery codes..."
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                  }}
                  className="w-full px-3 py-2 text-xs border focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs rounded border hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                    minHeight: '40px',
                  }}
                  className="px-5 py-2 text-xs font-semibold hover:opacity-90 cursor-pointer"
                >
                  {saving ? 'Encrypting & Saving...' : 'Save Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
