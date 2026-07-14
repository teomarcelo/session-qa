import { useState, useEffect, useRef } from 'react';
import { useFirebase } from '../../../shared/FirebaseContext.jsx';
import { ensureInstructorAuth } from '../../../lib/auth.js';
import useInstructorStore from '../../store/useInstructorStore.js';

function formatFeedbackWhen(ms) {
  if (ms == null || ms === '' || typeof ms !== 'number') return '';
  try {
    return new Date(ms).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch (e) { return ''; }
}

export default function SessionFeedbackList() {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const demoFeedback = useInstructorStore(s => s.demoFeedback);

  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setRows([]);
    setError(null);

    if (!activeSessionCode || isDemoMode || !db) return;

    // Reading sessionFeedback requires isSalesforce() in the rules. If we subscribe
    // before Firebase Auth has restored the verified user (e.g. right after a page
    // refresh) the request carries no/anon token and is rejected. So await auth,
    // confirm a verified salesforce.com user, then attach the listener. `cancelled`
    // guards against the session changing (or unmount) during the await.
    let cancelled = false;

    (async () => {
      const user = await ensureInstructorAuth();
      if (cancelled) return;
      const latest = useInstructorStore.getState().activeSessionCode;
      if (activeSessionCode !== latest) return;

      if (!user) {
        setError('Could not load dashboard feedback: sign in with your salesforce.com Google account, then reopen this session.');
        return;
      }

      unsubRef.current = db
        .collection('sessions')
        .doc(activeSessionCode)
        .collection('sessionFeedback')
        .onSnapshot(
          (snap) => {
            const latestCode = useInstructorStore.getState().activeSessionCode;
            if (activeSessionCode !== latestCode) return;
            const items = [];
            snap.forEach(d => items.push({ id: d.id, ...d.data() }));
            items.sort((a, b) => (b.submittedAtMs || 0) - (a.submittedAtMs || 0));
            setError(null);
            setRows(items);
          },
          (err) => {
            console.warn('Dashboard feedback listener:', err);
            const latestCode = useInstructorStore.getState().activeSessionCode;
            if (activeSessionCode !== latestCode) return;
            const perm = err && (err.code === 'permission-denied' || err.code === 'firestore/permission-denied');
            if (perm) {
              setError('Could not load dashboard feedback: Firestore blocked reads. Publish the firestore.rules from this repo in the Firebase console.');
            } else {
              setError('Could not load dashboard feedback: ' + ((err && err.message) || String(err)));
            }
          }
        );
    })();

    return () => {
      cancelled = true;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [activeSessionCode, isDemoMode, db]);

  // Demo mode: render the in-memory seeded feedback (nothing hits Firestore).
  // New entries submitted from the demo student view are prepended to this list.
  if (isDemoMode) {
    const demoRows = [...(demoFeedback || [])].sort(
      (a, b) => (b.submittedAtMs || 0) - (a.submittedAtMs || 0),
    );
    if (!demoRows.length) {
      return <p className="instr-feedback-empty">No dashboard feedback for this session yet.</p>;
    }
    return (
      <div className="instr-feedback-list-wrap" aria-live="polite">
        {demoRows.map(r => (
          <article key={r.id} className="instr-feedback-card">
            <div className="instr-feedback-card-head">
              <strong>{r.subject || ''}</strong>
              <span className="instr-feedback-when">{formatFeedbackWhen(r.submittedAtMs)}</span>
            </div>
            <div className="instr-feedback-body">
              {String(r.body || '').split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 ? <br/> : null}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="instr-feedback-empty instr-feedback-empty--warn">{error}</p>;
  }

  if (!rows.length) {
    return <p className="instr-feedback-empty">No dashboard feedback for this session yet.</p>;
  }

  return (
    <div className="instr-feedback-list-wrap" aria-live="polite">
      {rows.map(r => (
        <article key={r.id} className="instr-feedback-card">
          <div className="instr-feedback-card-head">
            <strong>{r.subject || ''}</strong>
            <span className="instr-feedback-when">{formatFeedbackWhen(r.submittedAtMs)}</span>
          </div>
          <div className="instr-feedback-body">
            {String(r.body || '').split('\n').map((line, i) => (
              <span key={i}>{line}{i < String(r.body || '').split('\n').length - 1 ? <br/> : null}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
