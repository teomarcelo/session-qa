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
} from './hooks/useInstructorAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function InstructorApp() {
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const setCurrentInstructor = useInstructorStore(s => s.setCurrentInstructor);
  const setIsDemoMode = useInstructorStore(s => s.setIsDemoMode);
  const restoredRef = useRef(false);

  // Restore session from sessionStorage on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const savedName = readInstructorNameFromStorage();
    if (savedName) {
      setCurrentInstructor(savedName);
      if (readIsDemoFromStorage() === 'true') {
        setIsDemoMode(true);
      }
    }
  }, []);

  if (!currentInstructor) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}
