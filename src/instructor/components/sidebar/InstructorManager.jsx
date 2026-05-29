import { useState } from 'react';
import firebase from '../../../lib/firebaseCompat.js';
import { useFirebase } from '../../../shared/FirebaseContext.jsx';
import useInstructorStore from '../../store/useInstructorStore.js';

export default function InstructorManager() {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const setAllSessions = useInstructorStore(s => s.setAllSessions);
  const showToast = useInstructorStore(s => s.showToast);

  const [newInstructor, setNewInstructor] = useState('');

  const activeSession = allSessions.find(s => s.id === activeSessionCode);
  const instructors = activeSession
    ? (activeSession.instructors || (activeSession.instructorNames
        ? activeSession.instructorNames.split(',').map(n => n.trim()).filter(Boolean)
        : []))
    : [];

  const updateSession = async (newInstructors) => {
    if (isDemoMode) {
      const updated = allSessions.map(s =>
        s.id === activeSessionCode
          ? { ...s, instructors: newInstructors, instructorNames: newInstructors.join(', ') }
          : s
      );
      setAllSessions(updated);
      return;
    }
    if (!db) { throw new Error('Firebase not available.'); }
    await db.collection('sessions').doc(activeSessionCode).update({
      instructors: newInstructors,
      instructorNames: newInstructors.join(', '),
    });
    const updated = allSessions.map(s =>
      s.id === activeSessionCode
        ? { ...s, instructors: newInstructors, instructorNames: newInstructors.join(', ') }
        : s
    );
    setAllSessions(updated);
  };

  const handleAdd = async () => {
    const name = newInstructor.trim();
    if (!name) return;
    if (!activeSessionCode) { showToast('Select a session first.'); return; }
    if (instructors.includes(name)) { showToast('Already added.'); return; }
    try {
      await updateSession([...instructors, name]);
      showToast(name + ' added!');
      setNewInstructor('');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };

  const handleRemove = async (name) => {
    if (!activeSessionCode) return;
    try {
      await updateSession(instructors.filter(n => n !== name));
      showToast(name + ' removed.');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };

  return (
    <div>
      <div id="instructor-list" style={{ marginBottom: '0.5rem' }}>
        {!instructors.length ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', textAlign: 'center', padding: '0.5rem 0' }}>
            No instructors added yet
          </div>
        ) : (
          instructors.map(name => (
            <div key={name} className="instructor-chip">
              <span className="instructor-chip-name">{name}</span>
              <button className="instructor-chip-remove" onClick={() => handleRemove(name)}>×</button>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input
          id="new-instructor-input"
          className="mini-input"
          type="text"
          placeholder="Add co-instructor name"
          value={newInstructor}
          onChange={e => setNewInstructor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          style={{ flex: 1 }}
        />
        <button className="save-btn" style={{ flexShrink: 0 }} onClick={handleAdd}>Add</button>
      </div>
    </div>
  );
}
