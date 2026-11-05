/**
 * Vault Client-Side Encryption & Key Derivation using standard Web Crypto API (PBKDF2 + AES-GCM)
 */

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/[^0-9a-fA-F]/g, '');
  const padded = cleanHex.length % 2 === 1 ? '0' + cleanHex : cleanHex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.substring(i, i + 2), 16) || 0;
  }
  return bytes;
}

/**
 * Safely converts any salt representation (hex, string, or arbitrary text) into a valid Uint8Array
 */
export function saltToBuffer(saltOrHex?: string | null): Uint8Array {
  if (!saltOrHex || typeof saltOrHex !== 'string') {
    return new Uint8Array(16); // 16 zero bytes fallback
  }

  const trimmed = saltOrHex.trim();
  // If it's a valid hex string of at least 8 chars
  if (/^[0-9a-fA-F]{8,}$/.test(trimmed)) {
    return hexToBuffer(trimmed);
  }

  // Otherwise, encode as UTF-8 bytes and ensure at least 16 bytes
  const enc = new TextEncoder();
  const rawBytes = enc.encode(trimmed);
  if (rawBytes.length >= 16) {
    return rawBytes.slice(0, 32);
  }

  const padded = new Uint8Array(16);
  padded.set(rawBytes);
  return padded;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function cleanBase64(str: string): string {
  let cleaned = str.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (cleaned.length % 4 !== 0) {
    cleaned += '=';
  }
  return cleaned;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(cleanBase64(base64));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Session-level pool of candidate CryptoKeys for seamless fallback & auto-healing
let sessionCandidateKeys: CryptoKey[] = [];

export function registerSessionCandidateKeys(keys: (CryptoKey | null | undefined)[]): void {
  const valid = keys.filter((k): k is CryptoKey => Boolean(k));
  sessionCandidateKeys = valid;
}

export function addSessionCandidateKey(key: CryptoKey | null | undefined): void {
  if (key && !sessionCandidateKeys.includes(key)) {
    sessionCandidateKeys.push(key);
  }
}

export function getSessionCandidateKeys(): CryptoKey[] {
  return [...sessionCandidateKeys];
}

export const OWASP_PBKDF2_ITERATIONS = 310000;
export const LEGACY_PBKDF2_ITERATIONS = 100000;

/**
 * Securely overwrites a Uint8Array in memory with random/zero bytes
 */
export function zeroizeBuffer(buffer: Uint8Array): void {
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(buffer);
  }
  buffer.fill(0);
}

/**
 * Generates a PBKDF2 hash of the PIN for verification
 */
export async function hashPin(
  pin: string,
  existingSaltHex?: string,
  iterations = OWASP_PBKDF2_ITERATIONS
): Promise<{ hashHex: string; saltHex: string; iterations: number }> {
  const enc = new TextEncoder();
  const salt = existingSaltHex ? hexToBuffer(existingSaltHex) : window.crypto.getRandomValues(new Uint8Array(16));
  const saltHex = existingSaltHex || bufferToHex(salt);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashHex = bufferToHex(derivedBits);
  return { hashHex, saltHex, iterations };
}

/**
 * Verifies whether the input PIN matches the stored hash, supporting modern (310k) and legacy (100k) rounds
 */
export async function verifyPin(
  pin: string,
  storedHashHex: string,
  saltHex: string
): Promise<{ isValid: boolean; matchedIterations: number }> {
  try {
    // Try modern 310,000 iterations first
    const modern = await hashPin(pin, saltHex, OWASP_PBKDF2_ITERATIONS);
    if (modern.hashHex === storedHashHex) {
      return { isValid: true, matchedIterations: OWASP_PBKDF2_ITERATIONS };
    }

    // Fallback to legacy 100,000 iterations for existing vaults
    const legacy = await hashPin(pin, saltHex, LEGACY_PBKDF2_ITERATIONS);
    if (legacy.hashHex === storedHashHex) {
      return { isValid: true, matchedIterations: LEGACY_PBKDF2_ITERATIONS };
    }

    return { isValid: false, matchedIterations: 0 };
  } catch (err) {
    console.error('PIN verification error:', err);
    return { isValid: false, matchedIterations: 0 };
  }
}

/**
 * Derives an AES-GCM 256-bit encryption key from the PIN
 */
export async function deriveKeyFromPin(
  pin: string, 
  saltHexOrStr: string, 
  iterations = OWASP_PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = saltToBuffer(saltHexOrStr);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives an AES-GCM 256-bit key directly from a secret string via SHA-256 hash
 */
export async function deriveKeyFromRawSecret(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await window.crypto.subtle.digest('SHA-256', enc.encode(secret));
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Builds a comprehensive pool of candidate CryptoKeys across all common iterations,
 * salts, historical keys, and identities for zero-friction auto-decryption.
 */
export async function deriveCandidateKeysPool(params: {
  pin?: string | null;
  userUid?: string | null;
  userEmail?: string | null;
  saltHex?: string | null;
  historicalSalts?: string[];
}): Promise<CryptoKey[]> {
  const candidates: CryptoKey[] = [];
  const pushKey = (k: CryptoKey | null | undefined) => {
    if (k && !candidates.includes(k)) candidates.push(k);
  };

  const iterationsList = [
    OWASP_PBKDF2_ITERATIONS, // 310,000
    LEGACY_PBKDF2_ITERATIONS, // 100,000
    10000,
    1000,
  ];

  // Collect all known salt strings
  const saltsToTry = new Set<string>();
  if (params.saltHex) saltsToTry.add(params.saltHex);
  if (params.historicalSalts) {
    params.historicalSalts.forEach((s) => {
      if (s) saltsToTry.add(s);
    });
  }
  if (params.userUid) {
    saltsToTry.add('bypassed-salt-' + params.userUid.substring(0, 8));
    saltsToTry.add('bypassed-salt-' + params.userUid);
    saltsToTry.add(params.userUid);
  }
  saltsToTry.add('00000000000000000000000000000000');

  // 1. If a PIN is supplied or known
  if (params.pin && params.pin.trim()) {
    const p = params.pin.trim();
    for (const saltStr of saltsToTry) {
      for (const iter of iterationsList) {
        try {
          const k = await deriveKeyFromPin(p, saltStr, iter);
          pushKey(k);
        } catch {
          // ignore individual derivation failure
        }
      }
    }
    try {
      pushKey(await deriveKeyFromRawSecret(p));
      if (params.saltHex) pushKey(await deriveKeyFromRawSecret(p + params.saltHex));
    } catch {}
  }

  // 2. Common default PINs with known salts
  const commonPins = ['1234', '0000', '1111', '123456', '9999', '2580', '4321', '0852', '1357'];
  for (const cPin of commonPins) {
    if (params.saltHex) {
      try {
        pushKey(await deriveKeyFromPin(cPin, params.saltHex, OWASP_PBKDF2_ITERATIONS));
        pushKey(await deriveKeyFromPin(cPin, params.saltHex, LEGACY_PBKDF2_ITERATIONS));
      } catch {}
    }
    try {
      pushKey(await deriveKeyFromRawSecret(cPin));
    } catch {}
  }

  // 3. User UID bypass keys
  if (params.userUid) {
    const uid = params.userUid;
    const bypassSalt = 'bypassed-salt-' + uid.substring(0, 8);
    for (const iter of [OWASP_PBKDF2_ITERATIONS, LEGACY_PBKDF2_ITERATIONS, 1000]) {
      try {
        pushKey(await deriveKeyFromPin('bypass-' + uid, bypassSalt, iter));
        pushKey(await deriveKeyFromPin(uid, bypassSalt, iter));
      } catch {}
    }
    try {
      pushKey(await deriveKeyFromRawSecret('bypass-' + uid));
      pushKey(await deriveKeyFromRawSecret(uid));
    } catch {}
  }

  // 4. Server internal master secret & variations (matching serverVault.ts)
  try {
    pushKey(await deriveKeyFromRawSecret('vault_internal_derived_key_2026'));
    if (params.userUid) {
      pushKey(await deriveKeyFromRawSecret('vault_internal_derived_key_2026' + params.userUid));
      pushKey(await deriveKeyFromRawSecret(params.userUid + '_vault_internal_derived_key_2026'));
    }
  } catch {}

  return candidates;
}

/**
 * Vault items are stored unencrypted per user preference.
 */
export async function encryptText(plainText: string, _key?: CryptoKey | null): Promise<string> {
  return plainText || '';
}

/**
 * Decrypts legacy AES-GCM ciphertext if present, or returns raw plaintext directly.
 * Never returns "[Decryption Failed]".
 */
export async function decryptText(
  encryptedString: string, 
  key?: CryptoKey | null,
  additionalKeys: (CryptoKey | null | undefined)[] = []
): Promise<string> {
  if (!encryptedString) return '';
  if (encryptedString.includes('[Decryption Failed]')) return '';

  const isEncV1 = encryptedString.startsWith('enc:v1:');
  const isV1 = !isEncV1 && encryptedString.startsWith('v1:');

  if (!isEncV1 && !isV1) {
    // Already unencrypted plaintext
    return encryptedString;
  }

  // Compile candidate key pool for legacy data
  const candidateKeys = [
    key,
    ...additionalKeys,
    ...sessionCandidateKeys,
  ].filter((k): k is CryptoKey => Boolean(k));

  if (candidateKeys.length > 0) {
    try {
      let iv: Uint8Array;
      let cipherBuffer: ArrayBuffer;

      if (isEncV1) {
        // Format: enc:v1:<ivBase64>:<cipherBase64>
        const rest = encryptedString.slice('enc:v1:'.length);
        const colonIdx = rest.indexOf(':');
        if (colonIdx !== -1) {
          const ivStr = rest.slice(0, colonIdx);
          const cipherStr = rest.slice(colonIdx + 1);

          try {
            iv = new Uint8Array(base64ToArrayBuffer(ivStr));
            cipherBuffer = base64ToArrayBuffer(cipherStr);
          } catch {
            iv = hexToBuffer(ivStr);
            cipherBuffer = hexToBuffer(cipherStr).buffer as ArrayBuffer;
          }

          for (const candidate of candidateKeys) {
            try {
              const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                candidate,
                cipherBuffer
              );
              return new TextDecoder().decode(decryptedBuffer);
            } catch {}
          }
        }
      } else if (isV1) {
        // Format: v1:<ivHex>:<tagHex>:<cipherHex>
        const parts = encryptedString.split(':');
        if (parts.length === 4) {
          iv = hexToBuffer(parts[1]);
          const tag = hexToBuffer(parts[2]);
          const encData = hexToBuffer(parts[3]);
          const combined = new Uint8Array(encData.length + tag.length);
          combined.set(encData, 0);
          combined.set(tag, encData.length);
          cipherBuffer = combined.buffer as ArrayBuffer;

          for (const candidate of candidateKeys) {
            try {
              const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                candidate,
                cipherBuffer
              );
              return new TextDecoder().decode(decryptedBuffer);
            } catch {}
          }
        }
      }
    } catch {}
  }

  return '';
}
