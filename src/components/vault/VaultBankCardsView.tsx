import React, { useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { useVault } from '../../context/VaultContext';
import { VaultBankCardItem, VaultFolder, BankCardType } from '../../types/vault';
import { encryptText, decryptText } from '../../lib/crypto';
import { 
  CreditCard, 
  Building2, 
  Copy, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Folder, 
  Layers 
} from 'lucide-react';

interface VaultBankCardsViewProps {
  items: VaultBankCardItem[];
  folders: VaultFolder[];
  currentFolderId: string | null;
  onSave: (item: Partial<VaultBankCardItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const VaultBankCardsView: React.FC<VaultBankCardsViewProps> = ({
  items,
  folders,
  currentFolderId,
  onSave,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { activeKey } = useVault();

  // Decrypted sensitive values cache: itemId -> { cardNumber?, cvv?, accountNumber? }
  const [decryptedFields, setDecryptedFields] = useState<Record<string, Record<string, string>>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<VaultBankCardItem> | null>(null);
  const [plainCardNum, setPlainCardNum] = useState('');
  const [plainCvv, setPlainCvv] = useState('');
  const [plainAccNum, setPlainAccNum] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter by folder
  const displayedItems = items.filter((it) => (it.folder_id || null) === currentFolderId);

  const toggleRevealCardNumber = async (item: VaultBankCardItem) => {
    if (decryptedFields[item.id]?.cardNumber) {
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), cardNumber: '' },
      }));
    } else {
      const dec = (await decryptText(item.encrypted_card_number || '', activeKey)) || item.encrypted_card_number || '';
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), cardNumber: dec },
      }));
      setTimeout(() => {
        setDecryptedFields((prev) => ({
          ...prev,
          [item.id]: { ...(prev[item.id] || {}), cardNumber: '' },
        }));
      }, 15000);
    }
  };

  const toggleRevealCvv = async (item: VaultBankCardItem) => {
    if (decryptedFields[item.id]?.cvv) {
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), cvv: '' },
      }));
    } else {
      const dec = (await decryptText(item.encrypted_cvv || '', activeKey)) || item.encrypted_cvv || '';
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), cvv: dec },
      }));
      setTimeout(() => {
        setDecryptedFields((prev) => ({
          ...prev,
          [item.id]: { ...(prev[item.id] || {}), cvv: '' },
        }));
      }, 15000);
    }
  };

  const toggleRevealAccountNumber = async (item: VaultBankCardItem) => {
    if (decryptedFields[item.id]?.accountNumber) {
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), accountNumber: '' },
      }));
    } else {
      const dec = (await decryptText(item.encrypted_account_number || '', activeKey)) || item.encrypted_account_number || '';
      setDecryptedFields((prev) => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), accountNumber: dec },
      }));
      setTimeout(() => {
        setDecryptedFields((prev) => ({
          ...prev,
          [item.id]: { ...(prev[item.id] || {}), accountNumber: '' },
        }));
      }, 15000);
    }
  };

  const copyVal = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(idStr);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingItem({
      entry_type: 'card',
      label: '',
      folder_id: currentFolderId,
      card_type: 'Visa',
    });
    setPlainCardNum('');
    setPlainCvv('');
    setPlainAccNum('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (item: VaultBankCardItem) => {
    setEditingItem(item);
    setPlainCardNum(item.encrypted_card_number || '');
    setPlainCvv(item.encrypted_cvv || '');
    setPlainAccNum(item.encrypted_account_number || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.label) return;
    setSaving(true);

    try {
      let encCard = editingItem.encrypted_card_number || '';
      let encCvv = editingItem.encrypted_cvv || '';
      let encAcc = editingItem.encrypted_account_number || '';

      if (plainCardNum) encCard = plainCardNum.replace(/\s+/g, '');
      if (plainCvv) encCvv = plainCvv;
      if (plainAccNum) encAcc = plainAccNum;

      await onSave({
        ...editingItem,
        folder_id: editingItem.folder_id || null,
        encrypted_card_number: encCard,
        encrypted_cvv: encCvv,
        encrypted_account_number: encAcc,
      });

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getTypeBadge = (type: BankCardType) => {
    switch (type) {
      case 'bank':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">Bank</span>;
      case 'card':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">Card</span>;
      case 'both':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">Bank + Card</span>;
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">
            Bank & Cards ({displayedItems.length})
          </span>
        </div>
        <button
          id="add-bank-card-btn"
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
          <span>Add Bank / Card</span>
        </button>
      </div>

      {/* Item list */}
      <div className="space-y-3">
        {displayedItems.map((item) => {
          const cardNumVal = decryptedFields[item.id]?.cardNumber;
          const cvvVal = decryptedFields[item.id]?.cvv;
          const accNumVal = decryptedFields[item.id]?.accountNumber;

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
              className="hover:border-zinc-300 transition-colors space-y-3"
            >
              {/* Item Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.entry_type === 'bank' ? (
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                  )}
                  <h4 className="text-xs sm:text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                    {item.label}
                  </h4>
                  {getTypeBadge(item.entry_type)}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${item.label}"?`)) onDelete(item.id);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CARD DETAILS (If card or both) */}
              {(item.entry_type === 'card' || item.entry_type === 'both') && (
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="font-semibold text-zinc-700">{item.card_type || 'Card'} • {item.card_nickname || 'Payment Card'}</span>
                    <span>{item.cardholder_name || ''}</span>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Card Number */}
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-zinc-200">
                      <span className="font-mono text-zinc-800">
                        {cardNumVal || '•••• •••• •••• ••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRevealCardNumber(item)}
                        className="p-1 text-zinc-400 hover:text-zinc-700"
                        title="Reveal card number"
                      >
                        {cardNumVal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const val = cardNumVal || (await decryptText(item.encrypted_card_number || '', activeKey)) || item.encrypted_card_number || '';
                          copyVal(val, `card-${item.id}`);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-700"
                        title="Copy card number"
                      >
                        {copiedKey === `card-${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Expiry and CVV */}
                    <div className="flex items-center gap-2">
                      <div className="bg-white px-2 py-1 rounded border border-zinc-200 text-zinc-700 font-mono">
                        Exp: {item.expiry_date || 'MM/YY'}
                      </div>

                      <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-zinc-200">
                        <span className="text-zinc-500">CVV:</span>
                        <span className="font-mono font-bold text-zinc-800">
                          {cvvVal || '•••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRevealCvv(item)}
                          className="p-0.5 text-zinc-400 hover:text-zinc-700"
                        >
                          {cvvVal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const val = cvvVal || (await decryptText(item.encrypted_cvv || '', activeKey)) || item.encrypted_cvv || '';
                            copyVal(val, `cvv-${item.id}`);
                          }}
                          className="p-0.5 text-zinc-400 hover:text-zinc-700"
                        >
                          {copiedKey === `cvv-${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BANK DETAILS (If bank or both) */}
              {(item.entry_type === 'bank' || item.entry_type === 'both') && (
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span className="font-semibold text-zinc-800">{item.bank_name || 'Bank Account'}</span>
                    <span>Holder: {item.account_holder_name || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-zinc-200 w-fit">
                    <span className="text-zinc-500">Acc #:</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {accNumVal || '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleRevealAccountNumber(item)}
                      className="p-1 text-zinc-400 hover:text-zinc-700"
                    >
                      {accNumVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const val = accNumVal || (await decryptText(item.encrypted_account_number || '', activeKey)) || item.encrypted_account_number || '';
                        copyVal(val, `acc-${item.id}`);
                      }}
                      className="p-1 text-zinc-400 hover:text-zinc-700"
                    >
                      {copiedKey === `acc-${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {item.additional_info && (
                    <p className="text-[11px] text-zinc-400">{item.additional_info}</p>
                  )}
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
            No bank or card entries here yet. Tap "+ Add Bank / Card" to record payment methods.
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
              boxShadow: theme.shadows.lg,
              border: `1px solid ${theme.colors.borderLight}`,
              maxWidth: '520px',
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
                {editingItem.id ? 'Edit Bank/Card Entry' : 'New Bank/Card Entry'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Type selector */}
              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Entry Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['card', 'bank', 'both'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, entry_type: t })}
                      style={{
                        minHeight: '44px',
                        borderRadius: theme.radius.md,
                        border: `1px solid ${editingItem.entry_type === t ? theme.colors.accent : theme.colors.borderLight}`,
                        backgroundColor: editingItem.entry_type === t ? theme.colors.accentLight : 'transparent',
                        fontWeight: editingItem.entry_type === t ? '600' : '400',
                      }}
                      className="capitalize cursor-pointer"
                    >
                      {t === 'both' ? 'Both (Linked)' : t === 'bank' ? 'Bank Account' : 'Payment Card'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
                  Entry Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Bank Visa, Chase Checking..."
                  value={editingItem.label || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
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

              {/* CARD RELEVANT FIELDS */}
              {(editingItem.entry_type === 'card' || editingItem.entry_type === 'both') && (
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3">
                  <span className="font-bold text-zinc-700 block">Payment Card Information</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1 text-zinc-500">Card Nickname</label>
                      <input
                        type="text"
                        placeholder="e.g. Primary Travel Card"
                        value={editingItem.card_nickname || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, card_nickname: e.target.value })}
                        className="w-full p-2 border rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-zinc-500">Card Network</label>
                      <select
                        value={editingItem.card_type || 'Visa'}
                        onChange={(e) => setEditingItem({ ...editingItem, card_type: e.target.value })}
                        className="w-full p-2 border rounded bg-white text-xs"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="American Express">American Express</option>
                        <option value="UnionPay">UnionPay</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500">Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="NAME ON CARD"
                      value={editingItem.cardholder_name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, cardholder_name: e.target.value })}
                      className="w-full p-2 border rounded bg-white text-xs uppercase font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block mb-1 text-zinc-500">Card Number (Encrypted)</label>
                      <input
                        type="text"
                        placeholder="16 digits"
                        value={plainCardNum}
                        onChange={(e) => setPlainCardNum(e.target.value)}
                        className="w-full p-2 border rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-zinc-500">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="3-4 digits"
                        value={plainCvv}
                        onChange={(e) => setPlainCvv(e.target.value)}
                        className="w-full p-2 border rounded bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500">Expiry Date</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={editingItem.expiry_date || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, expiry_date: e.target.value })}
                      className="w-32 p-2 border rounded bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* BANK RELEVANT FIELDS */}
              {(editingItem.entry_type === 'bank' || editingItem.entry_type === 'both') && (
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3">
                  <span className="font-bold text-zinc-700 block">Bank Account Details</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1 text-zinc-500">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Dutch-Bangla Bank, BRAC"
                        value={editingItem.bank_name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, bank_name: e.target.value })}
                        className="w-full p-2 border rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-zinc-500">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="Full account name"
                        value={editingItem.account_holder_name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, account_holder_name: e.target.value })}
                        className="w-full p-2 border rounded bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500">Account Number (Encrypted)</label>
                    <input
                      type="text"
                      placeholder="Account / IBAN / Routing..."
                      value={plainAccNum}
                      onChange={(e) => setPlainAccNum(e.target.value)}
                      className="w-full p-2 border rounded bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500">Branch / Routing / Additional Info</label>
                    <textarea
                      rows={2}
                      placeholder="Routing number, branch code, SWIFT..."
                      value={editingItem.additional_info || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, additional_info: e.target.value })}
                      className="w-full p-2 border rounded bg-white text-xs"
                    />
                  </div>
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
                  {saving ? 'Encrypting & Saving...' : 'Save Bank/Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
