export type VaultSection = 'credentials' | 'bank_cards' | 'custom' | 'settings';

export interface VaultFolder {
  id: string;
  owner_uid: string;
  section: 'credentials' | 'bank_cards' | 'custom';
  folder_name: string;
  parent_folder_id: string | null;
  created_at: string;
}

export interface VaultCredentialItem {
  id: string;
  owner_uid: string;
  folder_id: string | null;
  entry_name: string;
  username_email: string;
  encrypted_password: string;
  website_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type BankCardType = 'bank' | 'card' | 'both';

export interface VaultBankCardItem {
  id: string;
  owner_uid: string;
  folder_id: string | null;
  entry_type: BankCardType;
  label: string;
  // Card specific
  card_nickname?: string;
  card_type?: string; // Visa, Mastercard, Amex, etc.
  cardholder_name?: string;
  encrypted_card_number?: string;
  encrypted_cvv?: string;
  expiry_date?: string;
  // Bank specific
  bank_name?: string;
  account_holder_name?: string;
  encrypted_account_number?: string;
  additional_info?: string;
  created_at: string;
  updated_at: string;
}

export interface VaultCustomItem {
  id: string;
  owner_uid: string;
  folder_id: string | null;
  title: string;
  encrypted_data: string; // encrypted JSON string of { mode: 'kv'|'text', kv?: Record<string, string>, text?: string }
  created_at: string;
  updated_at: string;
}
