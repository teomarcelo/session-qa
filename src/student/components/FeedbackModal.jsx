import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { ensureAnonymousStudent } from '../../lib/auth.js';

/**
 * Dashboard feedback modal — anonymous, no reply path, no student email collected.
 * Submits to sessions/{code}/sessionFeedback.
 * Closes on ESC or backdrop click.
 */
export default function FeedbackModal({ sessionCode, onClose, showToast }) {
  const { db } = useFirebase();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const subjectRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus subject on open
  useEffect(() => {
    if (subjectRef.current) subjectRef.current.focus();
  }, []);

  async function handleSubmit() {
    const sub = subject.trim();
    const msg = body.trim();
    if (!sub) { showToast('Please enter a subject.'); return; }
    if (!msg) { showToast('Please enter a message.'); return; }
    if (!sessionCode) { showToast('Join a session before sending feedback.'); return; }
    if (!db) {
      showToast('Feedback cannot be sent right now. Check your connection and try again.');
      return;
    }

    // Payload shape is intentionally exactly {subject, body, submittedAtMs} to
    // satisfy the strict feedback rule (size()==3). Do NOT add fields here; the
    // anonymous auth below attaches identity via the request token, not the doc.
    const payload = {
      subject: sub.slice(0, 500),
      body: msg.slice(0, 12000),
      submittedAtMs: Math.floor(Date.now()),
    };

    try {
      // Ensure the anonymous identity so the write carries a Firebase token
      // (required once rules enforce request.auth != null).
      await ensureAnonymousStudent();
      await db.collection('sessions').doc(sessionCode).collection('sessionFeedback').add(payload);
      onClose();
      showToast('Thanks — your feedback was sent.');
    } catch (e) {
      const errCode = e && (e.code || e.name);
      if (errCode === 'permission-denied' || errCode === 'firestore/permission-denied') {
        showToast(
          'Could not send feedback: Firestore blocked the write. Deploy firestore.rules (sessions/{id}/sessionFeedback) to your Firebase project, then try again.',
        );
      } else {
        showToast('Could not send feedback: ' + (e && e.message ? e.message : String(e)));
      }
    }
  }

  const modal = (
    <div
      className="modal-overlay open"
      id="student-feedback-modal"
      aria-hidden="false"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="student-feedback-modal-title">
        <div className="modal-title" id="student-feedback-modal-title">Dashboard feedback</div>
        <p className="student-feedback-modal-lead">
          Send a private note to the team. Nothing opens on your device, no email address is collected, and you will not get a reply.
        </p>
        <div className="field" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="feedback-subject">Subject</label>
          <input
            id="feedback-subject"
            ref={subjectRef}
            type="text"
            maxLength={500}
            placeholder="Short summary"
            autoComplete="off"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="feedback-body">Message</label>
          <textarea
            id="feedback-body"
            className="student-feedback-body"
            rows={5}
            maxLength={12000}
            placeholder="Improvements, bugs, or ideas…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-submit" onClick={handleSubmit}>Send feedback</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
