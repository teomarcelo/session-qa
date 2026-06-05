import { createContext, useContext, useMemo } from 'react';
import firebase from '../lib/firebaseCompat.js';
import { FIREBASE_CONFIG } from '../config/firebase.js';

const FirebaseContext = createContext(null);

export function FirebaseProvider({ children }) {
  const value = useMemo(() => {
    const configReady = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
    if (!configReady) return { db: null, storage: null };
    try {
      const db = firebase.firestore();
      const storage = firebase.storage ? firebase.storage() : null;
      return { db, storage };
    } catch (e) {
      console.warn('Firebase init failed:', e);
      return { db: null, storage: null };
    }
  }, []);
  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export const useFirebase = () => useContext(FirebaseContext);
