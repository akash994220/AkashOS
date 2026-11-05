import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

let appletConfig: Record<string, string> = {};
try {
  const configs = import.meta.glob('/firebase-applet-config.json', { eager: true });
  if (configs['/firebase-applet-config.json']) {
    appletConfig = (configs['/firebase-applet-config.json'] as any).default || configs['/firebase-applet-config.json'];
  }
} catch {
  // No custom applet config found
}

export const firebaseConfig = {
  apiKey: appletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB2RPjutKrDbxg7jHVBoFYrNs-P5qUXJ0M",
  authDomain: appletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "akash-app1999.firebaseapp.com",
  projectId: appletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "akash-app1999",
  storageBucket: appletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "akash-app1999.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1095711375254",
  appId: appletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "1:1095711375254:web:18a7915d77208af7ae67b7"
};

// Initialize Firebase App safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore safely with fallback
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err) {
    console.error('Firestore initialization error:', err);
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
