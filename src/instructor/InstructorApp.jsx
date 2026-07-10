/**
 * InstructorApp — top-level component.
 * Switches between LoginScreen and Dashboard based on auth state.
 *
 * Identity now comes from Firebase Auth (Google), NOT from spoofable ?sso_*
 * URL params. On mount we:
 *   1) restore demo mode if it was active in this tab, then
 *   2) restore a locally-saved display name so a refresh does not drop you, then
 *   3) subscribe to onAuthStateChanged — a verified Google (salesforce.com)
 *      user becomes the trusted instructor identity (email-keyed ownerId).
 */
import { useEffect, useRef } from 'react';
import useInstructorStore from './store/useInstructorStore.js';
import {
  readInstructorNameFromStorage,
  readIsDemoFromStorage,
  writeInstructorNameToStorage,
  resolveInstructorIds,
  readDisplayNameOverride,
  nameToId,
} from './hooks/useInstructorAuth.js';
import { getAuth } from '../lib/auth.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function InstructorApp() {
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const setCurrentInstructor = useInstructorStore(s => s.setCurrentInstructor);
  const setInstructorIdentity = useInstructorStore(s => s.setInstructorIdentity);
  const setIsDemoMode = useInstructorStore(s => s.setIsDemoMode);
  const restoredRef = useRef(false);

  // First-mount restore (no network / no auth needed).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    // 1) Demo mode from a prior visit in this tab wins outright.
    if (readIsDemoFromStorage() === 'true') {
      const savedName = readInstructorNameFromStorage();
      if (savedName) {
        setCurrentInstructor(savedName);
        setInstructorIdentity({ ownerId: nameToId(savedName) });
        setIsDemoMode(true);
        return;
      }
    }

    // 2) A name saved earlier in this tab (keeps you signed in across refreshes
    //    before onAuthStateChanged resolves; superseded by the Google identity
    //    below when a verified user is present).
    const savedName = readInstructorNameFromStorage();
    if (savedName) {
      setCurrentInstructor(savedName);
      setInstructorIdentity({ ownerId: nameToId(savedName) });
    }
  }, []);

  // 3) Firebase Auth listener — the trusted identity source.
  useEffect(() => {
    const auth = getAuth();
    if (!auth) return; // demo / no Firebase config: nothing to subscribe to

    const unsub = auth.onAuthStateChanged((user) => {
      // Never override an active demo session with a lingering auth state.
      if (readIsDemoFromStorage() === 'true') return;

      // Ignore anonymous sessions (those belong to the student app on the same
      // origin) and users without a verified email.
      if (!user || user.isAnonymous || !user.email) return;

      const email = String(user.email).toLowerCase();
      const { ownerId, legacyOwnerId } = resolveInstructorIds({ email, name: user.displayName || '' });
      // Editable display-name override (set on the login screen) beats the raw
      // Google name; email is the stable ownership key regardless of name.
      const displayName = readDisplayNameOverride(ownerId) || user.displayName || email;
      setInstructorIdentity({ ownerId, legacyOwnerId, email });
      setCurrentInstructor(displayName);
      writeInstructorNameToStorage(displayName);
    });

    return () => { try { unsub(); } catch (e) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentInstructor) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}
