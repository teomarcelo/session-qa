import { useStudentSession } from './hooks/useStudentSession.js';
import JoinScreen from './components/JoinScreen.jsx';
import AppScreen from './components/AppScreen.jsx';

/**
 * Top-level student app component.
 * Switches between JoinScreen and AppScreen based on session state.
 *
 * The 'restoring' state keeps the screen blank while auto-rejoin is in progress
 * (the std-restoring-session class on <html> provides a CSS loading state via
 * src/styles/student.css — body is hidden until the class is removed).
 */
export default function StudentApp() {
  const {
    appState,
    sessionCode,
    currentSession,
    userName,
    userId,
    storedName,
    joinError,
    joining,
    handleJoin,
    handleLeave,
    isDemoMode,
  } = useStudentSession();

  if (appState === 'restoring') {
    // The std-restoring-session CSS class on <html> hides the body while we check
    // localStorage for a saved session code. Return null here — CSS controls the
    // visual transition, React renders nothing until auto-rejoin resolves.
    return null;
  }

  if (appState === 'join') {
    return (
      <JoinScreen
        storedName={storedName}
        joinError={joinError}
        joining={joining}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <AppScreen
      sessionCode={sessionCode}
      currentSession={currentSession}
      userName={userName}
      userId={userId}
      onLeave={handleLeave}
      isDemoMode={isDemoMode}
    />
  );
}
