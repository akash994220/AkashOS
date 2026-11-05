import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as fbSignInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserSettings {
  theme: string;
  bypass_security_locks: boolean;
  display_currencies: string[];
  bottom_capsule_tabs?: string[]; // 4 selected workspace tab ids
  vault_pin_hash?: string;
  vault_pin_salt?: string;
  vault_historical_salts?: string[];
  posting_gap_thresholds?: {
    youtube?: number;
    tiktok?: number;
    facebook?: number;
    instagram?: number;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userSettings: UserSettings;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  theme: 'minimalism',
  bypass_security_locks: false,
  display_currencies: ['USD', 'EUR'],
  posting_gap_thresholds: {
    youtube: 7,
    tiktok: 3,
    facebook: 7,
    instagram: 7,
  },
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userSettings: defaultSettings,
  updateUserSettings: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signInAnonymously: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    // Safety guard: ensure loading never hangs indefinitely if auth state check is delayed
    const timeoutGuard = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(timeoutGuard);
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Listen to or fetch user settings
        const settingsRef = doc(db, 'user_settings', currentUser.uid);
        const unsubDoc = onSnapshot(
          settingsRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as Partial<UserSettings>;
              setUserSettings({
                ...defaultSettings,
                ...data,
              });
            } else {
              // Create default settings document
              try {
                await setDoc(settingsRef, {
                  owner_uid: currentUser.uid,
                  ...defaultSettings,
                  created_at: new Date().toISOString(),
                });
              } catch (e) {
                console.error('Error creating default settings:', e);
              }
            }
          },
          (error) => {
            console.error('Settings snapshot error:', error);
          }
        );
        return () => unsubDoc();
      } else {
        setUserSettings(defaultSettings);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const settingsRef = doc(db, 'user_settings', user.uid);
    await setDoc(settingsRef, {
      ...userSettings,
      ...newSettings,
      owner_uid: user.uid,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    setUserSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUp = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signInAnonymously = async () => {
    await fbSignInAnonymously(auth);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        userSettings,
        updateUserSettings,
        signIn,
        signUp,
        signInAnonymously,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
