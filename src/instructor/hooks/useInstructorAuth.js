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

// Stable identity key derived from the verified Google email. Independent of the
// display name, so instructors can rename themselves without losing their sessions.
export function emailToId(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolve the identity keys for an instructor.
 * - ownerId: stable primary key (email-based when available, else name-based).
 * - legacyOwnerId: the pre-OAuth name-based id, returned only when it differs from
 *   ownerId, so sessions created before the email-identity switch stay visible.
 */
export function resolveInstructorIds({ email, name }) {
  const nameId = name ? nameToId(name) : '';
  const ownerId = email ? emailToId(email) : nameId;
  const legacyOwnerId = nameId && nameId !== ownerId ? nameId : null;
  return { ownerId, legacyOwnerId };
}

/** True when this instructor owns the given session (by stable or legacy id). */
export function instructorOwnsSession(session, ownerId, legacyOwnerId) {
  if (!session) return false;
  const owned = [ownerId, legacyOwnerId].filter(Boolean);
  return owned.includes(session.ownerId);
}

/**
 * The name to show/author under for this instructor in a specific session.
 * Sessions they own can carry a per-session name (ownerName); otherwise fall back
 * to their global default display name.
 */
export function myNameForSession(session, currentInstructor, ownerId, legacyOwnerId) {
  if (session && session.ownerName && instructorOwnsSession(session, ownerId, legacyOwnerId)) {
    return session.ownerName;
  }
  return currentInstructor || 'Instructor';
}

// Editable display-name override, persisted in localStorage keyed by ownerId so a
// rename survives reloads and does not leak across different signed-in accounts.
const INSTR_DISPLAY_NAME_OVERRIDES = 'sqa_instructor_display_names';

export function readDisplayNameOverride(ownerId) {
  if (!ownerId) return '';
  try {
    const raw = localStorage.getItem(INSTR_DISPLAY_NAME_OVERRIDES);
    if (!raw) return '';
    const map = JSON.parse(raw);
    return map && typeof map[ownerId] === 'string' ? map[ownerId] : '';
  } catch (e) { return ''; }
}

export function writeDisplayNameOverride(ownerId, name) {
  if (!ownerId) return;
  try {
    let map = {};
    const raw = localStorage.getItem(INSTR_DISPLAY_NAME_OVERRIDES);
    if (raw) { try { map = JSON.parse(raw) || {}; } catch (e) { map = {}; } }
    map[ownerId] = name;
    localStorage.setItem(INSTR_DISPLAY_NAME_OVERRIDES, JSON.stringify(map));
  } catch (e) {}
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Replace any of the instructor's prior names (oldNames) with newName inside a
 * single session doc. Owner label is always brought up to the new name.
 */
function buildSessionRenameUpdates(data, oldNames, newName) {
  const isOld = (nm) => !!nm && oldNames.has(nm);
  const upd = {};
  if (Array.isArray(data.instructors) && data.instructors.some(isOld)) {
    const next = [];
    data.instructors.forEach(nm => {
      const v = isOld(nm) ? newName : nm;
      if (v && !next.includes(v)) next.push(v);
    });
    upd.instructors = next;
    upd.instructorNames = next.join(', ');
  } else if (typeof data.instructorNames === 'string' && data.instructorNames) {
    const parts = data.instructorNames.split(',').map(x => x.trim());
    if (parts.some(isOld)) {
      const next = [];
      parts.forEach(p => {
        const v = isOld(p) ? newName : p;
        if (v && !next.includes(v)) next.push(v);
      });
      upd.instructorNames = next.join(', ');
    }
  }
  if (data.ownerName && data.ownerName !== newName) upd.ownerName = newName;
  if (Array.isArray(data.sessionNotes) && data.sessionNotes.some(n => n && isOld(n.instructor))) {
    upd.sessionNotes = data.sessionNotes.map(n =>
      n && isOld(n.instructor) ? { ...n, instructor: newName } : n
    );
  }
  return upd;
}

/**
 * Rewrite the instructor's name within a SINGLE session (names are per-session):
 *  - session ownerName / instructors / instructorNames
 *  - session notes authored under a prior name
 *  - question answers ("previous replies") authored under a prior name
 * Co-instructors and students keep their names. Returns the changed session update
 * so the caller can patch the local store for an instant UI refresh.
 */
async function propagateSessionRename({ db, sessionCode, oldNamesSet, newName }) {
  const ref = db.collection('sessions').doc(sessionCode);
  const doc = await ref.get();
  if (!doc.exists) return { changedSessions: [], oldNames: [...oldNamesSet] };
  const data = doc.data() || {};

  const writes = [];
  const changedSessions = [];
  const upd = buildSessionRenameUpdates(data, oldNamesSet, newName);
  // Always ensure the owner label reflects the new per-session name.
  if (!upd.ownerName && data.ownerName !== newName) upd.ownerName = newName;
  if (Object.keys(upd).length) {
    writes.push({ ref, data: upd });
    changedSessions.push({ id: sessionCode, updates: upd });
  }

  const qSnap = await ref.collection('questions').get();
  qSnap.forEach(qd => {
    const q = qd.data() || {};
    if (Array.isArray(q.answers) && q.answers.some(a => a && oldNamesSet.has(a.instructor))) {
      const answers = q.answers.map(a =>
        a && oldNamesSet.has(a.instructor) ? { ...a, instructor: newName } : a
      );
      writes.push({ ref: qd.ref, data: { answers } });
    }
  });

  for (const group of chunkArray(writes, 400)) {
    const batch = db.batch();
    group.forEach(w => batch.update(w.ref, w.data));
    await batch.commit();
  }

  return { changedSessions, oldNames: [...oldNamesSet] };
}

/** Patch the in-memory store so a rename shows immediately without a reload. */
function applyRenameToStore(oldNames, newName, changedSessions) {
  const oldSet = new Set((oldNames || []).filter(Boolean));
  const store = useInstructorStore.getState();
  const changedMap = new Map((changedSessions || []).map(c => [c.id, c.updates]));
  const mergedSessions = store.allSessions.map(s =>
    changedMap.has(s.id) ? { ...s, ...changedMap.get(s.id) } : s
  );
  store.setAllSessions(mergedSessions);

  const pages = store.questionPages.map(p => ({
    ...p,
    questions: (p.questions || []).map(q =>
      Array.isArray(q.answers) && q.answers.some(a => a && oldSet.has(a.instructor))
        ? { ...q, answers: q.answers.map(a => (a && oldSet.has(a.instructor) ? { ...a, instructor: newName } : a)) }
        : q
    ),
  }));
  store.setQuestionPages(pages);
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
      useInstructorStore.getState().setCurrentInstructor(stored.displayName);
      useInstructorStore.getState().setInstructorIdentity({ ownerId: id });
      writeInstructorNameToStorage(stored.displayName);
      return null; // success
    } catch (e) {
      return 'Connection error. Please try again.';
    }
  }, [db]);

  const register = useCallback(async (name, pin, pin2) => {
    return 'Instructor self-signup is temporarily disabled. Contact the workshop admin to provision your account.';
  }, [db]);

  // Passwordless sign-in used after Google OAuth. Access is already restricted to
  // @salesforce.com by the Next.js gateway. Identity (which sessions you own) is
  // pinned to the verified email; `name` is only the editable display name.
  const continueAs = useCallback(async (name, email) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Please enter the name you want to go by.';
    const { ownerId, legacyOwnerId } = resolveInstructorIds({ email, name: trimmed });
    useInstructorStore.getState().setInstructorIdentity({ ownerId, legacyOwnerId, email: email || null });
    useInstructorStore.getState().setCurrentInstructor(trimmed);
    writeInstructorNameToStorage(trimmed);
    writeDisplayNameOverride(ownerId, trimmed);
    return null; // success
  }, []);

  // Set the GLOBAL default display name — used for new sessions and as the fallback
  // when a session has no per-session name. Does not touch existing sessions.
  const setGlobalDisplayName = useCallback((name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Please enter a name.';
    const ownerId = useInstructorStore.getState().instructorOwnerId;
    useInstructorStore.getState().setCurrentInstructor(trimmed);
    writeInstructorNameToStorage(trimmed);
    writeDisplayNameOverride(ownerId, trimmed);
    return null; // success
  }, []);

  // Rename yourself within ONE session only (names are per-session). Rewrites your
  // owner label, notes, and answers in that session; other sessions are untouched.
  const renameInSession = useCallback(async (sessionCode, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Please enter a name.';
    const state = useInstructorStore.getState();
    const session = state.allSessions.find(s => s.id === sessionCode);
    if (!session) return 'Select a session first.';
    const oldNamesSet = new Set([session.ownerName, state.currentInstructor].filter(Boolean));
    if (session.ownerName === trimmed) return null; // no change

    try {
      if (state.isDemoMode || !db) {
        const upd = buildSessionRenameUpdates(session, oldNamesSet, trimmed);
        if (!upd.ownerName && session.ownerName !== trimmed) upd.ownerName = trimmed;
        applyRenameToStore([...oldNamesSet], trimmed, [{ id: sessionCode, updates: upd }]);
        return null;
      }
      const { changedSessions, oldNames } = await propagateSessionRename({
        db,
        sessionCode,
        oldNamesSet,
        newName: trimmed,
      });
      applyRenameToStore(oldNames, trimmed, changedSessions);
    } catch (e) {
      console.warn('Session rename failed:', e);
      return 'Renamed, but updating this session\u2019s past posts failed. Try again.';
    }
    return null; // success
  }, [db]);

  const logout = useCallback(() => {
    clearInstructorBrowserSessionKeys();
    persistInstructorActiveSession(null);
    setInstructorOnboardingWelcomeFlag();
    useInstructorStore.getState().resetForLogin();
  }, []);

  const enterDemo = useCallback(() => {
    useInstructorStore.getState().setCurrentInstructor('Alex Rivera (Demo)');
    useInstructorStore.getState().setInstructorIdentity({ ownerId: nameToId('Alex Rivera (Demo)') });
    useInstructorStore.getState().setIsDemoMode(true);
    writeInstructorNameToStorage('Alex Rivera (Demo)');
    writeIsDemoToStorage('true');
  }, []);

  return { login, register, continueAs, setGlobalDisplayName, renameInSession, logout, enterDemo };
}
