/**
 * QuestionCard — renders a single question with answers, actions, and answer box.
 * dangerouslySetInnerHTML usage: safe: user content is HTML-escaped by esc() inside formatRichMessage
 */
import { useRef } from 'react';
import { formatRichMessage, isHttpsUrl, copyRichCodeBlock, esc } from '../../lib/richText.js';
import { htmlAnsweredStatusBadges } from '../../lib/answeredBadge.js';
import { formatQuestionWhen } from '../../lib/formatQuestionWhen.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { ensureInstructorAuth } from '../../lib/auth.js';
import useInstructorStore from '../store/useInstructorStore.js';
import { myNameForSession } from '../hooks/useInstructorAuth.js';
import AnswerBox from './AnswerBox.jsx';
import SaveButton from './SaveButton.jsx';

const EMPTY_ARR = [];

function normalizeQuestionImageUrls(q) {
  const raw = q.imageUrls;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(u => String(u).trim()).filter(isHttpsUrl);
  if (typeof raw === 'string') return isHttpsUrl(raw) ? [raw.trim()] : [];
  if (typeof raw === 'object') return Object.keys(raw).sort().map(k => raw[k]).map(u => String(u).trim()).filter(isHttpsUrl);
  return [];
}

function isImageOnlyPlaceholderText(text) {
  const t = (text || '').trim().toLowerCase();
  return t === '(image)' || t === '(photo)';
}

function getQuestionAnswersArray(q) {
  if (q.answers && q.answers.length) return [...q.answers];
  if (q.answer) return [{ instructor: 'Instructor', text: q.answer, ts: null }];
  return [];
}

export default function QuestionCard({ q, showToast }) {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const allSessions = useInstructorStore(s => s.allSessions);
  const instructorOwnerId = useInstructorStore(s => s.instructorOwnerId);
  const instructorLegacyOwnerId = useInstructorStore(s => s.instructorLegacyOwnerId);
  const answerEditState = useInstructorStore(s => s.answerEditState);
  const setAnswerEditState = useInstructorStore(s => s.setAnswerEditState);
  const setAnswerDraft = useInstructorStore(s => s.setAnswerDraft);
  const clearAnswerDraft = useInstructorStore(s => s.clearAnswerDraft);
  const clearPendingAnswerImages = useInstructorStore(s => s.clearPendingAnswerImages);
  const setPendingAnswerImages = useInstructorStore(s => s.setPendingAnswerImages);
  const openDeleteModal = useInstructorStore(s => s.openDeleteModal);
  const updateQuestionInPages = useInstructorStore(s => s.updateQuestionInPages);
  const _showToast = useInstructorStore(s => s.showToast);
  const toast = showToast || _showToast;

  // Privileged question edits (answer / pin / status / delete) require a verified
  // salesforce.com Firebase user as currentUser or the rules reject them with
  // "Missing or insufficient permissions". Await auth and confirm before writing,
  // so a pre-auth render or an anonymous session on this origin can't slip through.
  const requireInstructorAuth = async () => {
    const user = await ensureInstructorAuth();
    if (!user) {
      toast('Sign in with your salesforce.com Google account to make changes.');
      return false;
    }
    return true;
  };

  const answerDraft = useInstructorStore(s => s.answerDrafts[q.id] ?? '');
  const pendingImages = useInstructorStore(s => s.pendingAnswerImages[q.id] ?? EMPTY_ARR);

  const isEditing = !!(answerEditState && answerEditState.qId === q.id);

  const answers = getQuestionAnswersArray(q);
  const imageUrls = normalizeQuestionImageUrls(q);
  const rawText = q.text || '';
  const showBody = String(rawText).trim() &&
    !isImageOnlyPlaceholderText(rawText);

  const beginEditAnswer = (index) => {
    const a = answers[index];
    if (!a) return;
    setAnswerEditState({ qId: q.id, index });
    setAnswerDraft(q.id, a.text || '');
    setPendingAnswerImages(q.id, Array.isArray(a.imageUrls) ? [...a.imageUrls] : []);
    // Focus the textarea after render
    setTimeout(() => {
      const ta = document.getElementById(`ans-${q.id}`);
      if (ta) ta.focus();
    }, 50);
  };

  const cancelEditAnswer = () => {
    setAnswerEditState(null);
    clearAnswerDraft(q.id);
    clearPendingAnswerImages(q.id);
  };

  const saveAnswer = async () => {
    const text = answerDraft;
    const imgs = pendingImages.length ? [...pendingImages] : [];
    if (!text.trim() && !imgs.length) {
      toast('Type an answer or attach an image first.');
      return false;
    }

    const currentIsEdit = !!(answerEditState && answerEditState.qId === q.id && answerEditState.index != null);
    const wasEdit = currentIsEdit;
    let updatedAnswers = [...answers];

    // Name to author under is per-session (the session's ownerName when owned).
    const activeSession = allSessions.find(s => s.id === activeSessionCode);
    const myName = myNameForSession(activeSession, currentInstructor, instructorOwnerId, instructorLegacyOwnerId);

    if (currentIsEdit) {
      const idx = answerEditState.index;
      if (idx < 0 || idx >= updatedAnswers.length) return false;
      const prev = updatedAnswers[idx];
      const next = {
        instructor: prev.instructor || myName,
        text: text.trim() || (imgs.length ? '(Image)' : ''),
        ts: new Date().toISOString(),
      };
      if (imgs.length) next.imageUrls = imgs;
      updatedAnswers = [...updatedAnswers];
      updatedAnswers[idx] = next;
      setAnswerEditState(null);
    } else {
      const newAnswer = {
        instructor: myName,
        text: text.trim() || (imgs.length ? '(Image)' : ''),
        ts: new Date().toISOString(),
      };
      if (imgs.length) newAnswer.imageUrls = imgs;
      updatedAnswers.push(newAnswer);
    }

    clearPendingAnswerImages(q.id);

    if (isDemoMode) {
      updateQuestionInPages(q.id, (qItem) => ({
        ...qItem,
        answers: updatedAnswers,
        answer: '',
        status: 'answered',
      }));
      clearAnswerDraft(q.id);
      toast(wasEdit ? 'Answer updated.' : 'Answer saved!');
      return true;
    }

    if (!db) { toast('Firebase not available.'); return false; }
    if (!(await requireInstructorAuth())) return false;
    try {
      await db.collection('sessions').doc(activeSessionCode).collection('questions').doc(q.id).update({
        answers: updatedAnswers,
        answer: '',
        status: 'answered',
      });
      clearAnswerDraft(q.id);
      toast(wasEdit ? 'Answer updated.' : 'Answer saved!');
      return true;
    } catch (e) {
      toast('Error saving answer: ' + e.message);
      return false;
    }
  };

  const deleteAnswer = async (index) => {
    let updatedAnswers = [...answers];
    // Adjust edit state if deleting an answer being edited or before it
    const curEdit = useInstructorStore.getState().answerEditState;
    if (curEdit && curEdit.qId === q.id) {
      if (curEdit.index === index) {
        setAnswerEditState(null);
        clearAnswerDraft(q.id);
        clearPendingAnswerImages(q.id);
      } else if (curEdit.index > index) {
        setAnswerEditState({ qId: q.id, index: curEdit.index - 1 });
      }
    }
    updatedAnswers.splice(index, 1);
    const status = updatedAnswers.length ? 'answered' : 'pending';

    if (isDemoMode) {
      updateQuestionInPages(q.id, (qItem) => {
        const updated = { ...qItem, answers: updatedAnswers, answer: '', status };
        if (status === 'pending') delete updated.answeredVerbally;
        return updated;
      });
      toast('Answer removed.');
      return;
    }

    const patch = { answers: updatedAnswers, answer: '', status };
    if (status === 'pending') patch.answeredVerbally = false;
    if (!db) { toast('Firebase not available.'); return; }
    if (!(await requireInstructorAuth())) return;
    try {
      await db.collection('sessions').doc(activeSessionCode).collection('questions').doc(q.id).update(patch);
      toast('Answer removed.');
    } catch (e) {
      toast('Error removing answer: ' + e.message);
    }
  };

  const togglePin = async () => {
    if (isDemoMode) {
      const newPinned = !q.pinned;
      updateQuestionInPages(q.id, qItem => ({ ...qItem, pinned: newPinned }));
      toast(newPinned ? 'Question pinned!' : 'Unpinned.');
      return true;
    }
    if (!db) { toast('Firebase not available.'); return false; }
    if (!(await requireInstructorAuth())) return false;
    try {
      await db.collection('sessions').doc(activeSessionCode).collection('questions').doc(q.id).update({ pinned: !q.pinned });
      toast(q.pinned ? 'Unpinned.' : 'Question pinned!');
      return true;
    } catch (e) {
      toast('Error: ' + e.message);
      return false;
    }
  };

  const setStatus = async (status) => {
    if (isDemoMode) {
      updateQuestionInPages(q.id, qItem => {
        const updated = { ...qItem, status };
        if (status === 'answered') updated.answeredVerbally = true;
        else delete updated.answeredVerbally;
        return updated;
      });
      toast(status === 'answered' ? 'Marked as answered verbally.' : 'Marked as pending.');
      return true;
    }
    const patch = status === 'answered'
      ? { status, answeredVerbally: true }
      : { status, answeredVerbally: false };
    if (!db) { toast('Firebase not available.'); return false; }
    if (!(await requireInstructorAuth())) return false;
    try {
      await db.collection('sessions').doc(activeSessionCode).collection('questions').doc(q.id).update(patch);
      toast(status === 'answered' ? 'Marked as answered verbally.' : 'Marked as pending.');
      return true;
    } catch (e) {
      toast('Error: ' + e.message);
      return false;
    }
  };

  const handleRichClick = (e) => {
    const btn = e.target.closest('.rich-copy-btn');
    if (!btn) return;
    e.preventDefault();
    copyRichCodeBlock(btn, toast);
  };

  return (
    <div
      className={`q-card${q.pinned ? ' pinned' : ''}${q.status === 'answered' ? ' answered' : ''}`}
      id={`qcard-${q.id}`}
      onClick={handleRichClick}
    >
      <div className="q-top">
        <div>
          <div className="q-author-row">
            <span className="q-author">{q.authorName || 'Anonymous'}</span>
            <span className="q-time" title="Posted time">{formatQuestionWhen(q.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            {q.pinned && <span className="q-badge badge-pinned">Pinned</span>}
            {q.status === 'answered'
              /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
              ? <span dangerouslySetInnerHTML={{ __html: htmlAnsweredStatusBadges(q) }} />
              : <span className="q-badge badge-pending">Pending</span>
            }
          </div>
        </div>
        <div className="q-votes">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          {q.votes || 0}
        </div>
      </div>

      {/* Question body */}
      {showBody && (
        /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
        <div
          className="q-text rich-message"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: formatRichMessage(rawText) }}
        />
      )}
      {!showBody && isImageOnlyPlaceholderText(rawText) && imageUrls.length === 0 && (
        <div className="q-text q-text-muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          No image was saved on this question.
        </div>
      )}

      {/* Question images */}
      {imageUrls.length > 0 && (
        <div className="q-attached-images">
          {imageUrls.map(u => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </a>
          ))}
        </div>
      )}

      {/* Existing answers */}
      {answers.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          {answers.map((a, i) => (
            <div
              key={i}
              style={{
                background: 'var(--accent-light)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0 8px 8px 0',
                padding: '0.6rem 0.9rem',
                marginBottom: '0.4rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {a.instructor || 'Instructor'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => beginEditAnswer(i)}
                    title="Edit this reply"
                    style={{ background: 'none', border: 'none', fontSize: '0.78rem', color: 'var(--accent)', cursor: 'pointer', padding: '0 4px', lineHeight: 1, fontFamily: 'inherit', fontWeight: 500 }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAnswer(i)}
                    title="Remove this reply"
                    style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: 'var(--text-light)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, transition: 'color 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-light)'}
                  >
                    ×
                  </button>
                </span>
              </div>
              {/* safe: user content is HTML-escaped by esc() inside formatRichMessage */}
              <div
                className="rich-message"
                style={{ fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: formatRichMessage(a.text || '') }}
              />
              {Array.isArray(a.imageUrls) && a.imageUrls.length > 0 && (
                <div className="answer-attached-images">
                  {a.imageUrls.filter(isHttpsUrl).map(u => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                      <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Answer box */}
      <AnswerBox
        qId={q.id}
        isEditing={isEditing}
        onCancelEdit={cancelEditAnswer}
      />

      {/* Action buttons */}
      <div className="q-actions">
        <SaveButton className="action-btn btn-answer" onClick={saveAnswer}>
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
          <span>{isEditing ? 'Update answer' : 'Save answer'}</span>
        </SaveButton>
        <SaveButton className="action-btn btn-done" onClick={() => setStatus('answered')}>
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Answered verbally</span>
        </SaveButton>
        <SaveButton className="action-btn btn-pin" onClick={togglePin}>
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3.76Z"/></svg>
          <span>{q.pinned ? 'Unpin' : 'Pin'}</span>
        </SaveButton>
        <SaveButton className="action-btn btn-pending" onClick={() => setStatus('pending')}>
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Mark pending</span>
        </SaveButton>
        <button type="button" className="action-btn btn-delete" onClick={() => openDeleteModal(q.id)}>
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
