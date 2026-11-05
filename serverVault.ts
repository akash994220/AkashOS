import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface StoredAccount {
  platform: 'youtube' | 'facebook' | 'instagram';
  channelId?: string;
  channelTitle?: string;
  pageName?: string;
  accountName?: string;
  encryptedToken: string;
  connectedAt: string;
  updatedAt: string;
}

interface VaultData {
  users: Record<string, Record<string, StoredAccount>>;
  quotas: Record<string, Record<string, { used: number; date: string }>>;
}

const VAULT_FILE_PATH = path.join(process.cwd(), '.vault_storage.json');
const MASTER_SECRET = process.env.SERVER_VAULT_SECRET || 'vault_internal_derived_key_2026';
const DERIVED_KEY = crypto.createHash('sha256').update(MASTER_SECRET).digest();

// AES-256-GCM encryption
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// AES-256-GCM decryption
export function decryptSecret(cipherText: string): string {
  if (!cipherText || !cipherText.startsWith('v1:')) return cipherText;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt vault secret:', err);
    return '';
  }
}

// Read and write vault storage file
function readVault(): VaultData {
  try {
    if (!fs.existsSync(VAULT_FILE_PATH)) {
      return { users: {}, quotas: {} };
    }
    const raw = fs.readFileSync(VAULT_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading vault storage:', e);
    return { users: {}, quotas: {} };
  }
}

function writeVault(data: VaultData): void {
  try {
    fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing vault storage:', e);
  }
}

export function saveConnectedAccount(
  userId: string,
  platform: 'youtube' | 'facebook' | 'instagram',
  payload: {
    token: string;
    channelTitle?: string;
    channelId?: string;
    pageName?: string;
    accountName?: string;
  }
): void {
  const vault = readVault();
  if (!vault.users[userId]) {
    vault.users[userId] = {};
  }
  const encryptedToken = encryptSecret(payload.token);
  const now = new Date().toISOString();

  vault.users[userId][platform] = {
    platform,
    channelId: payload.channelId,
    channelTitle: payload.channelTitle,
    pageName: payload.pageName,
    accountName: payload.accountName,
    encryptedToken,
    connectedAt: vault.users[userId][platform]?.connectedAt || now,
    updatedAt: now,
  };

  writeVault(vault);
}

export function getConnectedAccount(
  userId: string,
  platform: 'youtube' | 'facebook' | 'instagram'
): { channelTitle?: string; channelId?: string; token: string; connectedAt: string } | null {
  const vault = readVault();
  const acc = vault.users[userId]?.[platform];
  if (!acc) return null;
  const token = decryptSecret(acc.encryptedToken);
  return {
    channelTitle: acc.channelTitle,
    channelId: acc.channelId,
    connectedAt: acc.connectedAt,
    token,
  };
}

export function removeConnectedAccount(userId: string, platform: 'youtube' | 'facebook' | 'instagram'): void {
  const vault = readVault();
  if (vault.users[userId] && vault.users[userId][platform]) {
    delete vault.users[userId][platform];
    writeVault(vault);
  }
}

export function getAccountsStatus(userId: string) {
  const vault = readVault();
  const userAccs = vault.users[userId] || {};

  const today = new Date().toISOString().split('T')[0];
  const quota = vault.quotas[userId]?.['youtube'] || { used: 0, date: today };
  const usedToday = quota.date === today ? quota.used : 0;

  return {
    youtube: {
      connected: Boolean(userAccs.youtube),
      channelTitle: userAccs.youtube?.channelTitle,
      connectedAt: userAccs.youtube?.connectedAt,
    },
    facebook: {
      connected: Boolean(userAccs.facebook),
      pageName: userAccs.facebook?.pageName,
      connectedAt: userAccs.facebook?.connectedAt,
    },
    instagram: {
      connected: Boolean(userAccs.instagram),
      accountName: userAccs.instagram?.accountName,
      connectedAt: userAccs.instagram?.connectedAt,
    },
    youtubeQuota: {
      used: usedToday,
      limit: 100,
      resetsAt: '00:00 UTC',
    },
  };
}

export function incrementYoutubeUploadQuota(userId: string): number {
  const vault = readVault();
  if (!vault.quotas[userId]) {
    vault.quotas[userId] = {};
  }
  const today = new Date().toISOString().split('T')[0];
  const current = vault.quotas[userId]['youtube'];
  if (!current || current.date !== today) {
    vault.quotas[userId]['youtube'] = { used: 1, date: today };
  } else {
    vault.quotas[userId]['youtube'].used += 1;
  }
  writeVault(vault);
  return vault.quotas[userId]['youtube'].used;
}
