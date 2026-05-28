import { useCallback } from 'react';
import firebase from '../../lib/firebaseCompat.js';
import { INSTRUCTOR_PIN_PEPPER } from '../../constants/auth.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import useInstructorStore, { DEMO_SESSION_CODE, DEMO_SESSION, DEMO_QUESTIONS_TEMPLATE } from '../store/useInstructorStore.js';

// Storage key constants
const INSTR_ACTIVE_SESSION_KEY = 'sqa_instructor_active_session';
const INSTR_ACTIVE_SESSION_LEGACY = 'tdx_instructor_active_session';
const INSTR_ONBOARDING_WELCOME_KEY = 'sqa_instructor_onboarding_welcome';
const INSTR_ONBOARDING_LEGACY = 'tdx_instructor_onboarding_welcome';
const INSTR_NAME_KEY = 'sqa_instructor_name';
const INSTR_NAME_LEGACY = 'tdx_instructor_name';
const INSTR_DEMO_FLAG = 'sqa_is_demo';
const INSTR_DEMO_LEGACY = 'tdx_is_demo';
export const DEMO_SESSIONS_HIDDEN_KEY = 'sqa_sessions_hidden_demo';
const DEMO_SESSIONS_HIDDEN_LEGACY = 'tdx_sessions_hidden_demo';

export function nameToId(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(INSTRUCTOR_PIN_PEPPER + pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function readInstructorActiveSessionFromStorage() {
  try {
    let v = sessionStorage.getItem(INSTR_ACTIVE_SESSION_KEY);
    if (v) return v;
    v = sessionStorage.getItem(INSTR_ACTIVE_SESSION_LEGACY);
    if (v) {
      sessionStorage.setItem(INSTR_ACTIVE_SESSION_KEY, v);
      sessionStorage.removeItem(INSTR_ACTIVE_SESSION_LEGACY);
    }
    return v;
  } catch (e) { return null; }
}

export function readInstructorNameFromStorage() {
  try {
    let v = sessionStorage.getItem(INSTR_NAME_KEY);
    if (v) return v;
    v = sessionStorage.getItem(INSTR_NAME_LEGACY);
    if (v) {
      sessionStorage.setItem(INSTR_NAME_KEY, v);
      sessionStorage.removeItem(INSTR_NAME_LEGACY);
    }
    return v;
  } catch (e) { return null; }
}

export function writeInstructorNameToStorage(name) {
  try {
    sessionStorage.setItem(INSTR_NAME_KEY, name);
    sessionStorage.removeItem(INSTR_NAME_LEGACY);
  } catch (e) {}
}

export function readIsDemoFromStorage() {
  try {
    let v = sessionStorage.getItem(INSTR_DEMO_FLAG);
    if (v != null) return v;
    v = sessionStorage.getItem(INSTR_DEMO_LEGACY);
    if (v != null) {
      sessionStorage.setItem(INSTR_DEMO_FLAG, v);
      sessionStorage.removeItem(INSTR_DEMO_LEGACY);
    }
    return v;
  } catch (e) { return null; }
}

export function writeIsDemoToStorage(val) {
  try {
    sessionStorage.setItem(INSTR_DEMO_FLAG, val);
    sessionStorage.removeItem(INSTR_DEMO_LEGACY);
  } catch (e) {}
}

export function clearInstructorBrowserSessionKeys() {
  try {
    sessionStorage.removeItem(INSTR_NAME_KEY);
    sessionStorage.removeItem(INSTR_NAME_LEGACY);
    sessionStorage.removeItem(INSTR_DEMO_FLAG);
    sessionStorage.removeItem(INSTR_DEMO_LEGACY);
    sessionStorage.removeItem(INSTR_ACTIVE_SESSION_KEY);
    sessionStorage.removeItem(INSTR_ACTIVE_SESSION_LEGACY);
  } catch (e) {}
}

export function persistInstructorActiveSession(code) {
  try {
    if (code) {
      sessionStorage.setItem(INSTR_ACTIVE_SESSION_KEY, code);
      sessionStorage.removeItem(INSTR_ACTIVE_SESSION_LEGACY);
    } else {
      sessionStorage.removeItem(INSTR_ACTIVE_SESSION_KEY);
      sessionStorage.removeItem(INSTR_ACTIVE_SESSION_LEGACY);
    }
  } catch (e) {}
}

export function instructorOnboardingWelcomePending() {
  try {
    if (sessionStorage.getItem(INSTR_ONBOARDING_WELCOME_KEY) === '1') return true;
    if (sessionStorage.getItem(INSTR_ONBOARDING_LEGACY) === '1') {
      sessionStorage.setItem(INSTR_ONBOARDING_WELCOME_KEY, '1');
      sessionStorage.removeItem(INSTR_ONBOARDING_LEGACY);
      return true;
    }
    return false;
  } catch (e) { return false; }
}

export function clearInstructorOnboardingWelcomeFlag() {
  try {
    sessionStorage.removeItem(INSTR_ONBOARDING_WELCOME_KEY);
    sessionStorage.removeItem(INSTR_ONBOARDING_LEGACY);
  } catch (e) {}
}

export function setInstructorOnboardingWelcomeFlag() {
  try {
    sessionStorage.setItem(INSTR_ONBOARDING_WELCOME_KEY, '1');
    sessionStorage.removeItem(INSTR_ONBOARDING_LEGACY);
  } catch (e) {}
}

export function getDemoHiddenSessionIds() {
  try {
    const fromNew = sessionStorage.getItem(DEMO_SESSIONS_HIDDEN_KEY);
    const fromLeg = sessionStorage.getItem(DEMO_SESSIONS_HIDDEN_LEGACY);
    const raw = fromNew || fromLeg;
    if (!raw) return [];
    if (fromLeg && !fromNew) {
      sessionStorage.setItem(DEMO_SESSIONS_HIDDEN_KEY, raw);
      sessionStorage.removeItem(DEMO_SESSIONS_HIDDEN_LEGACY);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

export function useInstructorAuth() {
  const { db } = useFirebase();
  const store = useInstructorStore();

  const login = useCallback(async (name, pin) => {
    if (!name) return 'Please enter your name.';
    if (!pin) return 'Please enter your PIN.';
    if (!db) return 'Firebase not configured. Use demo mode.';
    const id = nameToId(name);
    try {
      const doc = await db.collection('instructors').doc(id).get();
      if (!doc.exists) return 'No account found. Create one below.';
      const stored = doc.data();
      const hash = await hashPin(pin);
      if (hash !== stored.pinHash) return 'Incorrect PIN. Try again.';
      store.setCurrentInstructor(stored.displayName);
      writeInstructorNameToStorage(stored.displayName);
      return null; // success
    } catch (e) {
      return 'Connection error. Please try again.';
    }
  }, [db, store]);

  const register = useCallback(async (name, pin, pin2) => {
    if (!name) return 'Please enter your name.';
    if (pin.length < 4) return 'PIN must be at least 4 characters.';
    if (pin !== pin2) return 'PINs do not match.';
    if (!db) return 'Firebase not configured. Use demo mode.';
    const id = nameToId(name);
    try {
      const existing = await db.collection('instructors').doc(id).get();
      if (existing.exists) return 'An account with that name already exists. Sign in instead.';
      const hash = await hashPin(pin);
      await db.collection('instructors').doc(id).set({
        displayName: name,
        pinHash: hash,
        sessionsHiddenFromList: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      store.setCurrentInstructor(name);
      writeInstructorNameToStorage(name);
      setInstructorOnboardingWelcomeFlag();
      return null; // success
    } catch (e) {
      return 'Error creating account. Please try again.';
    }
  }, [db, store]);

  const logout = useCallback(() => {
    clearInstructorBrowserSessionKeys();
    persistInstructorActiveSession(null);
    setInstructorOnboardingWelcomeFlag();
    store.resetForLogin();
  }, [store]);

  const enterDemo = useCallback(() => {
    store.setCurrentInstructor('Alex Rivera (Demo)');
    store.setIsDemoMode(true);
    writeInstructorNameToStorage('Alex Rivera (Demo)');
    writeIsDemoToStorage('true');
  }, [store]);

  return { login, register, logout, enterDemo };
}
