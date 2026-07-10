/**
 * InstructorApp — top-level component.
 * Switches between LoginScreen and Dashboard based on auth state.
 * On mount, restores session from sessionStorage if present.
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
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

/** Google identity handed to the iframe by the Next.js gateway (?sso_name / ?sso_email). */
function readSsoIdentity() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      name: (p.get('sso_name') || '').trim(),
      email: (p.get('sso_email') || '').trim(),
    };
  } catch (e) {
    return { name: '', email: '' };
  }
}

export default function InstructorApp() {
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const setCurrentInstructor = useInstructorStore(s => s.setCurrentInstructor);
  const setInstructorIdentity = useInstructorStore(s => s.setInstructorIdentity);
  const setIsDemoMode = useInstructorStore(s => s.setIsDemoMode);
  const restoredRef = useRef(false);

  // Restore session on first mount. Priority:
  //  1) demo mode from a prior visit in this tab,
  //  2) the Google identity passed by the OAuth gateway (auto sign-in — no interstitial),
  //  3) a name saved earlier in this tab (direct/non-SSO access).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (readIsDemoFromStorage() === 'true') {
      const savedName = readInstructorNameFromStorage();
      if (savedName) {
        setCurrentInstructor(savedName);
        setInstructorIdentity({ ownerId: nameToId(savedName) });
        setIsDemoMode(true);
        return;
      }
    }

    const sso = readSsoIdentity();
    if (sso.name || sso.email) {
      const { ownerId, legacyOwnerId } = resolveInstructorIds({ email: sso.email, name: sso.name });
      const displayName = readDisplayNameOverride(ownerId) || sso.name || sso.email;
      setInstructorIdentity({ ownerId, legacyOwnerId, email: sso.email || null });
      setCurrentInstructor(displayName);
      writeInstructorNameToStorage(displayName);
      return;
    }

    const savedName = readInstructorNameFromStorage();
    if (savedName) {
      setCurrentInstructor(savedName);
      setInstructorIdentity({ ownerId: nameToId(savedName) });
    }
  }, []);

  if (!currentInstructor) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}
