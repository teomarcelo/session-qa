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
import { useEffect, useRef, useState } from 'react';
import useInstructorStore from './store/useInstructorStore.js';
import {
  readInstructorNameFromStorage,
  readIsDemoFromStorage,
  writeInstructorNameToStorage,
  resolveInstructorIds,
  readDisplayNameOverride,
  nameToId,
} from './hooks/useInstructorAuth.js';
import { getAuth, isVerifiedSalesforceUser } from '../lib/auth.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function InstructorApp() {
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const setCurrentInstructor = useInstructorStore(s => s.setCurrentInstructor);
  const setInstructorIdentity = useInstructorStore(s => s.setInstructorIdentity);
  const setIsDemoMode = useInstructorStore(s => s.setIsDemoMode);
  const restoredRef = useRef(false);

  // Whether Firebase Auth has reported its initial state yet, and whether the
  // live user is a verified salesforce.com instructor. Privileged Firestore
  // reads/writes (pin/answer/status/delete, session CRUD, notes, feedback) only
  // pass the rules with such a user, so the Dashboard is gated on it below.
  const [authChecked, setAuthChecked] = useState(false);
  const [isVerifiedInstructor, setIsVerifiedInstructor] = useState(false);

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
    if (!auth) {
      // Demo / no Firebase config: there is no live auth to verify, so let the
      // stored-name path drive rendering (demo mode has no privileged writes).
      setAuthChecked(true);
      return;
    }

    const unsub = auth.onAuthStateChanged(
      (user) => {
        // First callback means Firebase has restored (or cleared) persisted auth.
        setAuthChecked(true);

        // Never override an active demo session with a lingering auth state.
        if (readIsDemoFromStorage() === 'true') { setIsVerifiedInstructor(false); return; }

        // Only a verified salesforce.com user is a trusted instructor. Anonymous
        // sessions (the student app on the same origin) and unverified accounts
        // are NOT — issuing privileged Firestore ops with them yields "Missing or
        // insufficient permissions".
        if (isVerifiedSalesforceUser(user)) {
          const email = String(user.email).toLowerCase();
          const { ownerId, legacyOwnerId } = resolveInstructorIds({ email, name: user.displayName || '' });
          // Editable display-name override (set on the login screen) beats the raw
          // Google name; email is the stable ownership key regardless of name.
          const displayName = readDisplayNameOverride(ownerId) || user.displayName || email;
          setInstructorIdentity({ ownerId, legacyOwnerId, email });
          setCurrentInstructor(displayName);
          writeInstructorNameToStorage(displayName);
          setIsVerifiedInstructor(true);
        } else {
          setIsVerifiedInstructor(false);
        }
      },
      () => { setAuthChecked(true); setIsVerifiedInstructor(false); },
    );

    return () => { try { unsub(); } catch (e) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo mode has no Firebase identity and no privileged writes — the stored
  // name is sufficient to show the Dashboard.
  if (isDemoMode) {
    return currentInstructor ? <Dashboard /> : <LoginScreen />;
  }

  // No Firebase configured (local dev without env / offline): fall back to the
  // legacy stored-name gate so the app still runs.
  if (!getAuth()) {
    return currentInstructor ? <Dashboard /> : <LoginScreen />;
  }

  // Firebase configured: require a LIVE verified salesforce.com user before
  // rendering the Dashboard, so every privileged Firestore op it performs carries
  // a token the rules accept. While auth is still restoring, show a neutral
  // placeholder instead of flashing the login screen for an already-signed-in host.
  if (!authChecked) {
    return <AuthRestoring />;
  }
  if (!isVerifiedInstructor) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

/** Brief neutral state shown while Firebase Auth restores a persisted session. */
function AuthRestoring() {
  return (
    <div id="login-screen" style={{ display: 'flex' }}>
      <div className="login-card" style={{ textAlign: 'center' }}>
        <p className="login-sub" style={{ margin: 0 }}>Restoring your session…</p>
      </div>
    </div>
  );
}
