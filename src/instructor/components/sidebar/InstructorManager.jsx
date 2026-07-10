import { useFirebase } from '../../../shared/FirebaseContext.jsx';
import useInstructorStore from '../../store/useInstructorStore.js';
import { instructorOwnsSession } from '../../hooks/useInstructorAuth.js';
import { getSessionInstructorRoster } from '../../../lib/sessionInstructors.js';

/**
 * Read-only instructor roster for the active session.
 *
 * Co-instructors are now added automatically when someone joins the session with
 * its code (they're already Google-authenticated via the gateway). There is no
 * manual "add name" box. The session owner can still remove a co-instructor who
 * joined by mistake.
 */
export default function InstructorManager() {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const setAllSessions = useInstructorStore(s => s.setAllSessions);
  const instructorOwnerId = useInstructorStore(s => s.instructorOwnerId);
  const instructorLegacyOwnerId = useInstructorStore(s => s.instructorLegacyOwnerId);
  const showToast = useInstructorStore(s => s.showToast);

  const activeSession = allSessions.find(s => s.id === activeSessionCode);
  const { lead, coInstructors } = getSessionInstructorRoster(activeSession);
  const isOwner = instructorOwnsSession(activeSession, instructorOwnerId, instructorLegacyOwnerId);

  const removeCoInstructor = async (name) => {
    if (!activeSessionCode || !name) return;
    const currentList = Array.isArray(activeSession?.instructors)
      ? activeSession.instructors
      : String(activeSession?.instructorNames || '').split(',').map(n => n.trim()).filter(Boolean);
    const nextList = currentList.filter(n => String(n || '').trim() !== name);

    if (isDemoMode) {
      setAllSessions(allSessions.map(s =>
        s.id === activeSessionCode
          ? { ...s, instructors: nextList, instructorNames: nextList.join(', ') }
          : s
      ));
      showToast(name + ' removed.');
      return;
    }
    if (!db) return;
    try {
      await db.collection('sessions').doc(activeSessionCode).update({
        instructors: nextList,
        instructorNames: nextList.join(', '),
      });
      setAllSessions(allSessions.map(s =>
        s.id === activeSessionCode
          ? { ...s, instructors: nextList, instructorNames: nextList.join(', ') }
          : s
      ));
      showToast(name + ' removed.');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };

  return (
    <div>
      <div id="instructor-list" style={{ marginBottom: '0.5rem' }}>
        {lead && (
          <div className="instructor-chip instructor-chip--lead">
            <span className="instructor-chip-name">{lead}</span>
            <span className="instructor-lead-tag">Lead</span>
          </div>
        )}
        {coInstructors.map(name => (
          <div key={name} className="instructor-chip">
            <span className="instructor-chip-name">{name}</span>
            {isOwner && (
              <button
                className="instructor-chip-remove"
                title="Remove co-instructor"
                onClick={() => removeCoInstructor(name)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.76rem', color: 'var(--text-light)', lineHeight: 1.45, margin: 0 }}>
        Co-instructors are added automatically when they join with this session&rsquo;s code.
      </p>
    </div>
  );
}
