import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { useVault } from '../../context/VaultContext';
import { VaultCustomItem, VaultFolder } from '../../types/vault';
import { encryptText, decryptText } from '../../lib/crypto';
import { 
  FileLock2, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Copy, 
  Check, 
  Eye, 
  EyeOff 
} from 'lucide-react';

interface VaultCustomViewProps {
  items: VaultCustomItem[];
  folders: VaultFolder[];
  currentFolderId: string | null;
  onSave: (item: Partial<VaultCustomItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const VaultCustomView: React.FC<VaultCustomViewProps> = ({
  items,
  folders,
  currentFolderId,
  onSave,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { activeKey } = useVault();

  // Decrypted payloads cache: itemId -> decrypted object
  const [decryptedCache, setDecryptedCache] = useState<Record<string, any>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<VaultCustomItem> | null>(null);
  const [dataMode, setDataMode] = useState<'text' | 'kv'>('text');
  const [plainText, setPlainText] = useState('');
  const [kvPairs, setKvPairs] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const displayedItems = items.filter((it) => (it.folder_id || null) === currentFolderId);

  const toggleReveal = async (item: VaultCustomItem) => {
    if (revealedIds[item.id]) {
      setRevealedIds((prev) => ({ ...prev, [item.id]: false }));
    } else {
      let parsed = decryptedCache[item.id];
      if (!parsed) {
        const dec = (await decryptText(item.encrypted_data, activeKey)) || item.encrypted_data || '';
        try {
          parsed = JSON.parse(dec);
        } catch {
          parsed = { mode: 'text', text: dec };
        }
        setDecryptedCache((prev) => ({ ...prev, [item.id]: parsed }));
      }
      setRevealedIds((prev) => ({ ...prev, [item.id]: true }));

      // Auto-mask in 20s
      setTimeout(() => {
        setRevealedIds((prev) => ({ ...prev, [item.id]: false }));
      }, 20000);
    }
  };

  const copyVal = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(idStr);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingItem({
      title: '',
      folder_id: currentFolderId,
    });
    setDataMode('text');
    setPlainText('');
    setKvPairs([{ key: '', value: '' }]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (item: VaultCustomItem) => {
    setEditingItem(item);
    const dec = (await decryptText(item.encrypted_data, activeKey)) || item.encrypted_data || '';
    try {
      const parsed = JSON.parse(dec);
      setDataMode(parsed.mode || 'text');
      setPlainText(parsed.text || '');
      setKvPairs(parsed.kv || [{ key: '', value: '' }]);
    } catch {
      setDataMode('text');
      setPlainText(dec);
      setKvPairs([{ key: '', value: '' }]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.title) return;
    setSaving(true);

    try {
      const payloadObj = {
        mode: dataMode,
        text: dataMode === 'text' ? plainText : '',
        kv: dataMode === 'kv' ? kvPairs.filter((p) => p.key.trim() || p.value.trim()) : [],
      };

      const encData = JSON.stringify(payloadObj);

      await onSave({
        ...editingItem,
        folder_id: editingItem.folder_id || null,
        encrypted_data: encData,
      });

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addKvRow = () => {
    setKvPairs([...kvPairs, { key: '', value: '' }]);
  };

  const removeKvRow = (idx: number) => {
    setKvPairs(kvPairs.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">
            Custom Items ({displayedItems.length})
          </span>
        </div>
        <button
          id="add-custom-vault-btn"
          onClick={handleOpenAdd}
          style={{
            backgroundColor: theme.colors.accent,
            color: theme.colors.accentText,
            borderRadius: theme.radius.full,
            minHeight: '34px',
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Item</span>
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {displayedItems.map((item) => {
          const isRevealed = Boolean(revealedIds[item.id]);
          const cached = decryptedCache[item.id];

          return (
            <div
              key={item.id}
              style={{
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.lg,
                border: `1px solid ${theme.colors.borderLight}`,
                boxShadow: theme.shadows.sm,
                padding: theme.spacing.md,
              }}
              className="space-y-3 hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileLock2 className="w-4 h-4 text-zinc-700 shrink-0" />
                  <h4 className="text-xs sm:text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                    {item.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleReveal(item)}
                    style={{ minHeight: '36px' }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer font-medium"
                  >
                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${item.title}"?`)) onDelete(item.id);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body: Revealed vs Masked */}
              {isRevealed && cached ? (
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-2">
                  {cached.mode === 'kv' && Array.isArray(cached.kv) ? (
                    <div className="space-y-1.5">
                      {cached.kv.map((pair: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-zinc-200"
                        >
                          <span className="font-semibold text-zinc-600">{pair.key}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-900 select-all">{pair.value}</span>
                            <button
                              type="button"
                              onClick={() => copyVal(pair.value, `${item.id}-${idx}`)}
                              className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                            >
                              {copiedKey === `${item.id}-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-zinc-800 bg-white p-3 rounded border border-zinc-200 select-all">
                      {cached.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/60 text-xs text-zinc-400 font-mono">
                  •••••••••••••••• (Encrypted with AES-256)
                </div>
              )}
            </div>
          );
        })}

        {displayedItems.length === 0 && (
          <div
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.xl,
            }}
            className="text-center text-xs text-zinc-400"
          >
            No custom vault items in this folder. Tap "+ Add Custom Item" to secure notes or keys.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
            }}
            className="flex flex-col overflow-hidden"
          >
            <div
              style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, padding: theme.spacing.md }}
              className="flex items-center justify-between"
            >
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
                {editingItem.id ? 'Edit Custom Item' : 'New Custom Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Recovery Seed, Passport Info..."
                  value={editingItem.title || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  style={{
                    backgroundColor: theme.colors.bgSecondary,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.borderLight,
                    minHeight: '44px',
                  }}
                  className="w-full px-3 py-2 border font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
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
                  className="w-full px-3 py-2 border focus:outline-none"
                >
                  <option value="">(Root - No Folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.folder_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Mode Switch */}
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Format
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDataMode('text')}
                    style={{
                      borderRadius: theme.radius.sm,
                      minHeight: '38px',
                      border: `1px solid ${dataMode === 'text' ? theme.colors.accent : theme.colors.borderLight}`,
                      backgroundColor: dataMode === 'text' ? theme.colors.accentLight : 'transparent',
                      fontWeight: dataMode === 'text' ? '600' : '400',
                    }}
                    className="flex-1 py-1.5 cursor-pointer"
                  >
                    Freeform Secure Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataMode('kv')}
                    style={{
                      borderRadius: theme.radius.sm,
                      minHeight: '38px',
                      border: `1px solid ${dataMode === 'kv' ? theme.colors.accent : theme.colors.borderLight}`,
                      backgroundColor: dataMode === 'kv' ? theme.colors.accentLight : 'transparent',
                      fontWeight: dataMode === 'kv' ? '600' : '400',
                    }}
                    className="flex-1 py-1.5 cursor-pointer"
                  >
                    Key-Value Pairs
                  </button>
                </div>
              </div>

              {dataMode === 'text' ? (
                <div>
                  <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                    Encrypted Text Content
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Enter confidential notes, API keys, JSON payload..."
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    style={{
                      backgroundColor: theme.colors.bgSecondary,
                      borderRadius: theme.radius.md,
                      borderColor: theme.colors.borderLight,
                    }}
                    className="w-full px-3 py-2 border font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold" style={{ color: theme.colors.textSecondary }}>
                      Key-Value Attributes
                    </label>
                    <button
                      type="button"
                      onClick={addKvRow}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      + Add Row
                    </button>
                  </div>
                  {kvPairs.map((pair, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Label / Key"
                        value={pair.key}
                        onChange={(e) => {
                          const updated = [...kvPairs];
                          updated[idx].key = e.target.value;
                          setKvPairs(updated);
                        }}
                        className="w-1/3 p-2 border rounded bg-zinc-50"
                      />
                      <input
                        type="text"
                        placeholder="Encrypted Value"
                        value={pair.value}
                        onChange={(e) => {
                          const updated = [...kvPairs];
                          updated[idx].value = e.target.value;
                          setKvPairs(updated);
                        }}
                        className="w-2/3 p-2 border rounded bg-zinc-50 font-mono"
                      />
                      {kvPairs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKvRow(idx)}
                          className="p-1 text-zinc-400 hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-zinc-50 cursor-pointer"
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
                  className="px-5 py-2 font-semibold hover:opacity-90 cursor-pointer"
                >
                  {saving ? 'Encrypting & Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
