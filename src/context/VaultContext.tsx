import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  hashPin, 
  verifyPin, 
  deriveKeyFromPin, 
  registerSessionCandidateKeys,
  addSessionCandidateKey,
  getSessionCandidateKeys,
  deriveCandidateKeysPool,
  OWASP_PBKDF2_ITERATIONS, 
  LEGACY_PBKDF2_ITERATIONS 
} from '../lib/crypto';

interface VaultContextType {
  isUnlocked: boolean;
  isPinSet: boolean;
  activeKey: CryptoKey | null;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  unlockDirectly: () => Promise<void>;
  disableLockCompletely: () => Promise<void>;
  enablePinLock: () => Promise<void>;
  testAndRegisterPin: (pin: string) => Promise<boolean>;
  setNewPin: (pin: string) => Promise<void>;
  resetPin: () => Promise<void>;
  lockVault: () => void;
  panicLock: () => void;
  bypassed: boolean;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  lockOnTabBlur: boolean;
  setLockOnTabBlur: (enabled: boolean) => void;
}

const VaultContext = createContext<VaultContextType>({
  isUnlocked: false,
  isPinSet: false,
  activeKey: null,
  unlockWithPin: async () => ({ success: false }),
  unlockDirectly: async () => {},
  disableLockCompletely: async () => {},
  enablePinLock: async () => {},
  testAndRegisterPin: async () => false,
  setNewPin: async () => {},
  resetPin: async () => {},
  lockVault: () => {},
  panicLock: () => {},
  bypassed: false,
  autoLockMinutes: 5,
  setAutoLockMinutes: () => {},
  lockOnTabBlur: true,
  setLockOnTabBlur: () => {},
});

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userSettings, updateUserSettings } = useAuth();
  // Lock is completely removed per user request: always unlocked
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [activeKey, setActiveKey] = useState<CryptoKey | null>(null);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(5);
  const [lockOnTabBlur, setLockOnTabBlurState] = useState<boolean>(false);

  const setAutoLockMinutes = (minutes: number) => {
    setAutoLockMinutesState(minutes);
  };

  const setLockOnTabBlur = (enabled: boolean) => {
    setLockOnTabBlurState(enabled);
  };

  const isPinSet = Boolean(userSettings?.vault_pin_hash && userSettings?.vault_pin_salt);
  const bypassed = Boolean(userSettings?.bypass_security_locks);

  // Initialize candidate key pool for any legacy data
  useEffect(() => {
    if (!user) {
      setActiveKey(null);
      registerSessionCandidateKeys([]);
      return;
    }

    const initKeys = async () => {
      try {
        const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
        const localSalts = localStorage.getItem('vault_historical_salts');
        if (localSalts) {
          try {
            const parsed = JSON.parse(localSalts);
            if (Array.isArray(parsed)) parsed.forEach((s) => historicalSalts.push(s));
          } catch {}
        }

        let sessionPin: string | null = null;
        try {
          const knownPins = JSON.parse(sessionStorage.getItem('vault_known_pins') || '[]');
          if (Array.isArray(knownPins) && knownPins.length > 0) {
            sessionPin = knownPins[knownPins.length - 1];
          }
        } catch {}

        const candidateKeys = await deriveCandidateKeysPool({
          pin: sessionPin,
          userUid: user.uid,
          userEmail: user.email,
          saltHex: userSettings?.vault_pin_salt,
          historicalSalts,
        });

        const fallbackSalt = 'bypassed-salt-' + user.uid.substring(0, 8);
        const bypassKey = await deriveKeyFromPin('bypass-' + user.uid, fallbackSalt);
        setActiveKey(bypassKey);
        registerSessionCandidateKeys([bypassKey, ...candidateKeys]);
      } catch (e) {
        // keep open
      }
    };

    initKeys();
  }, [user, userSettings?.vault_pin_salt, userSettings?.vault_historical_salts]);

  // Lock vault functionality
  const lockVault = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  const panicLock = useCallback(() => {
    setActiveKey(null);
    registerSessionCandidateKeys([]);
    setIsUnlocked(false);
  }, []);

  const unlockWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4) {
      return { success: false, error: 'PIN must be exactly 4 digits.' };
    }

    // First time entry or uninitialized PIN: initialize with this 4-digit PIN seamlessly
    if (!userSettings?.vault_pin_hash || !userSettings?.vault_pin_salt) {
      await setNewPin(cleanPin);
      setIsUnlocked(true);
      return { success: true };
    }

    const { isValid, matchedIterations } = await verifyPin(
      cleanPin, 
      userSettings.vault_pin_hash, 
      userSettings.vault_pin_salt
    );

    if (!isValid) {
      return { success: false, error: 'Incorrect 4-digit PIN.' };
    }

    try {
      const key = await deriveKeyFromPin(cleanPin, userSettings.vault_pin_salt, matchedIterations);
      setActiveKey(key);

      const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
      const candidateKeys = await deriveCandidateKeysPool({
        pin: cleanPin,
        userUid: user?.uid,
        userEmail: user?.email,
        saltHex: userSettings.vault_pin_salt,
        historicalSalts,
      });

      registerSessionCandidateKeys([key, ...candidateKeys]);
    } catch {}

    // Cache this pin in session storage for tab persistence
    try {
      const knownPins: string[] = JSON.parse(sessionStorage.getItem('vault_known_pins') || '[]');
      if (!knownPins.includes(cleanPin)) {
        knownPins.push(cleanPin);
        sessionStorage.setItem('vault_known_pins', JSON.stringify(knownPins));
      }
    } catch {}

    setIsUnlocked(true);

    // Auto-upgrade legacy 100k hashes to modern 310k rounds seamlessly
    if (matchedIterations === LEGACY_PBKDF2_ITERATIONS) {
      hashPin(cleanPin, userSettings.vault_pin_salt, OWASP_PBKDF2_ITERATIONS).then(({ hashHex }) => {
        updateUserSettings({ vault_pin_hash: hashHex });
      }).catch(() => {});
    }

    return { success: true };
  };

  /**
   * Dynamically tests a candidate PIN, derives all possible keys, and registers them into the active session pool
   */
  const testAndRegisterPin = async (candidatePin: string): Promise<boolean> => {
    if (!candidatePin || candidatePin.trim().length !== 4) return false;
    const clean = candidatePin.trim();

    try {
      const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
      const localSalts = localStorage.getItem('vault_historical_salts');
      if (localSalts) {
        try {
          const parsed = JSON.parse(localSalts);
          if (Array.isArray(parsed)) parsed.forEach((s) => historicalSalts.push(s));
        } catch {}
      }

      const newKeys = await deriveCandidateKeysPool({
        pin: clean,
        userUid: user?.uid,
        userEmail: user?.email,
        saltHex: userSettings?.vault_pin_salt,
        historicalSalts,
      });

      if (newKeys.length > 0) {
        const existing = getSessionCandidateKeys();
        registerSessionCandidateKeys([...existing, ...newKeys]);

        // Cache pin in session
        try {
          const known: string[] = JSON.parse(sessionStorage.getItem('vault_known_pins') || '[]');
          if (!known.includes(clean)) {
            known.push(clean);
            sessionStorage.setItem('vault_known_pins', JSON.stringify(known));
          }
        } catch {}

        return true;
      }
      return false;
    } catch (err) {
      console.error('testAndRegisterPin error:', err);
      return false;
    }
  };

  const setNewPin = async (newPin: string) => {
    const cleanPin = newPin.trim();
    if (cleanPin.length !== 4) {
      throw new Error('PIN must be exactly 4 digits');
    }

    // Preserve previous activeKey in candidate pool before switching
    if (activeKey) {
      addSessionCandidateKey(activeKey);
    }

    // Save previous salt into historical salts so old data is never orphaned
    const prevSalt = userSettings?.vault_pin_salt;
    const historicalSalts = [...(userSettings?.vault_historical_salts || [])];
    if (prevSalt && !historicalSalts.includes(prevSalt)) {
      historicalSalts.push(prevSalt);
      try {
        localStorage.setItem('vault_historical_salts', JSON.stringify(historicalSalts));
      } catch {}
    }

    const { hashHex, saltHex } = await hashPin(cleanPin, undefined, OWASP_PBKDF2_ITERATIONS);
    let key: CryptoKey | null = null;
    try {
      key = await deriveKeyFromPin(cleanPin, saltHex, OWASP_PBKDF2_ITERATIONS);
      setActiveKey(key);
    } catch {}

    await updateUserSettings({
      vault_pin_hash: hashHex,
      vault_pin_salt: saltHex,
      vault_historical_salts: historicalSalts,
    });

    const newCandidates = await deriveCandidateKeysPool({
      pin: cleanPin,
      userUid: user?.uid,
      userEmail: user?.email,
      saltHex,
      historicalSalts,
    });

    registerSessionCandidateKeys([key, ...getSessionCandidateKeys(), ...newCandidates]);
    setIsUnlocked(true);
  };

  const resetPin = async () => {
    await updateUserSettings({
      vault_pin_hash: undefined,
      vault_pin_salt: undefined,
    });
    setIsUnlocked(true);
    setActiveKey(null);
  };

  const unlockDirectly = async () => {
    setIsUnlocked(true);
  };

  const disableLockCompletely = async () => {
    await updateUserSettings({ bypass_security_locks: true });
    setIsUnlocked(true);
  };

  const enablePinLock = async () => {
    await updateUserSettings({ bypass_security_locks: false });
  };

  return (
    <VaultContext.Provider
      value={{
        isUnlocked,
        isPinSet,
        activeKey,
        unlockWithPin,
        unlockDirectly,
        disableLockCompletely,
        enablePinLock,
        testAndRegisterPin,
        setNewPin,
        resetPin,
        lockVault,
        panicLock,
        bypassed,
        autoLockMinutes,
        setAutoLockMinutes,
        lockOnTabBlur,
        setLockOnTabBlur,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault() {
  return useContext(VaultContext);
}
