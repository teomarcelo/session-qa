import { useState, useEffect, useRef } from 'react';
import firebase from '../../lib/firebaseCompat.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import useInstructorStore from '../store/useInstructorStore.js';
import {
  SESSION_JOIN_PREFIX,
  syncJoinSuffixInput,
  buildSessionCodeFromJoinRow,
  setJoinRowFromSessionCode,
  JOIN_CODE_ROW_CLASS,
  JOIN_CODE_ROW_LEGACY_TDX_CLASS,
} from '../../lib/sessionCode.js';
import { nameToId } from '../hooks/useInstructorAuth.js';

export default function JoinSessionModal() {
  const { db } = useFirebase();
  const open = useInstructorStore(s => s.joinSessionModalOpen);
  const setOpen = useInstructorStore(s => s.setJoinSessionModalOpen);
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const allSessions = useInstructorStore(s => s.allSessions);
  const setAllSessions = useInstructorStore(s => s.setAllSessions);
  const setActiveSessionCode = useInstructorStore(s => s.setActiveSessionCode);
  const showToast = useInstructorStore(s => s.showToast);

  const [error, setError] = useState('');
  const suffixRef = useRef(null);

  useEffect(() => {
    if (open && suffixRef.current) {
      setJoinRowFromSessionCode(suffixRef.current, '');
      setError('');
    }
  }, [open]);

  const handleInput = () => {
    if (suffixRef.current) syncJoinSuffixInput(suffixRef.current);
  };

  const handleJoin = async () => {
    setError('');
    const sufEl = suffixRef.current;
    const row = sufEl && sufEl.closest('.' + JOIN_CODE_ROW_CLASS);
    const code = buildSessionCodeFromJoinRow(sufEl);
    if (!code || code === SESSION_JOIN_PREFIX) {
      setError('Enter the four characters after SQA- (or paste a full TDX- code).');
      return;
    }
    if (row && !row.classList.contains(JOIN_CODE_ROW_LEGACY_TDX_CLASS)) {
      const suf = String(sufEl.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (suf.length < 4) {
        setError('Enter all four characters after SQA-.');
        return;
      }
    }
    try {
      const doc = await db.collection('sessions').doc(code).get();
      if (!doc.exists) { setError('Session not found. Check the code.'); return; }
      const ownerId = nameToId(currentInstructor || '');
      const joinPayload = {
        joinedSessions: firebase.firestore.FieldValue.arrayUnion(code),
        sessionsHiddenFromList: firebase.firestore.FieldValue.arrayRemove(code),
      };
      db.collection('instructors').doc(ownerId).update(joinPayload).catch(() => {
        db.collection('instructors').doc(ownerId).get().then(idoc => {
          const d = idoc.exists ? idoc.data() : {};
          const joined = Array.isArray(d.joinedSessions) ? [...new Set([...d.joinedSessions, code])] : [code];
          const hidden = Array.isArray(d.sessionsHiddenFromList) ? d.sessionsHiddenFromList.filter(c => c !== code) : [];
          return db.collection('instructors').doc(ownerId).set(
            { joinedSessions: joined, sessionsHiddenFromList: hidden },
            { merge: true }
          );
        });
      });
      const sessionData = { id: code, ...doc.data() };
      const latestSessions = useInstructorStore.getState().allSessions;
      if (!latestSessions.find(s => s.id === code)) {
        setAllSessions([sessionData, ...latestSessions]);
      }
      setActiveSessionCode(code);
      setOpen(false);
      showToast('Joined session ' + code);
    } catch (e) {
      setError('Error: ' + e.message);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">Join a session</div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.1rem', lineHeight: 1.5 }}>
          <strong>SQA-</strong> is fixed on the left — type the last four characters, or paste a full <strong>SQA-</strong> or legacy <strong>TDX-</strong> code.
        </p>
        <div className="field">
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
            Session code
          </label>
          <div className={`${JOIN_CODE_ROW_CLASS} join-code-row--modal`}>
            <span className="join-code-prefix" aria-hidden="true">SQA-</span>
            <input
              ref={suffixRef}
              id="join-session-code"
              className={`mini-input join-code-suffix`}
              type="text"
              maxLength={8}
              placeholder="AB12"
              autoComplete="off"
              spellCheck={false}
              onInput={handleInput}
              onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
            />
          </div>
        </div>
        {error && <p className="error-msg" style={{ fontSize: '0.82rem', color: 'var(--warn)', minHeight: '1.2rem', marginBottom: '0.5rem' }}>{error}</p>}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="save-btn" style={{ padding: '0.55rem 1.25rem', marginTop: 0 }} onClick={handleJoin}>Join</button>
        </div>
      </div>
    </div>
  );
}
