/**
 * StudentChat — live chat panel in the student sidebar.
 *
 * Same Firestore collection as instructor chat (sessions/{code}/chat).
 * Students can: send, edit own messages, delete own messages, react with emoji.
 * Profanity is blocked before send (leo-profanity word list, client-side).
 * Question detection: if message looks like a Q, prompt to post to Q&A board.
 *
 * safe: all user content rendered via formatRichMessage (esc() inside)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import firebase from '../../lib/firebaseCompat.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { formatRichMessage } from '../../lib/richText.js';
import { insertSlackFormat, insertEmoji } from '../utils/formatHelpers.js';
import FormatToolbar from './FormatToolbar.jsx';
import { containsProfanity, looksLikeQuestion } from '../../lib/chatModeration.js';

const CHAT_PAGE_SIZE = 60;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '💡', '🙌', '✅'];

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Centered confirmation modal — replaces browser window.confirm */
function ConfirmModal({ message, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="chat-confirm-overlay" onPointerDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="chat-confirm-dialog" role="alertdialog" aria-modal="true">
        <p className="chat-confirm-msg">{message}</p>
        <div className="chat-confirm-actions">
          <button className="chat-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="chat-confirm-ok" onClick={onConfirm} autoFocus>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Fixed-position emoji reaction picker, portaled to body to escape overflow clipping */
function ReactionPicker({ anchorRef, onPick, onClose }) {
  const [style, setStyle] = useState({ opacity: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const pickerW = 192; // ~8 emojis * 24px
    const pickerH = 44;
    const gap = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = r.top - pickerH - gap;
    if (top < 8) top = r.bottom + gap;
    let left = r.left;
    if (left + pickerW > vw - 8) left = vw - pickerW - 8;
    if (left < 8) left = 8;

    setStyle({ position: 'fixed', top, left, zIndex: 9999, opacity: 1 });
  }, [anchorRef]);

  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('.chat-reaction-picker-portal')) onClose();
    }
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [onClose]);

  return createPortal(
    <div className="chat-reaction-picker chat-reaction-picker-portal" style={style}>
      {REACTION_EMOJIS.map(em => (
        <button key={em} className="chat-reaction-option" onPointerDown={e => { e.preventDefault(); onPick(em); }}>{em}</button>
      ))}
    </div>,
    document.body
  );
}

export default function StudentChat({ sessionCode, userId, userName }) {
  const { db } = useFirebase();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [reactionAnchorRef, setReactionAnchorRef] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // msgId to delete

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const editTextareaRef = useRef(null);

  // Inline feedback (profanity / question prompt / success)
  const [sendError, setSendError] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState(null);

  const bottomRef = useRef(null);
  const searchTimerRef = useRef(null);
  const unsubRef = useRef(null);
  const userScrolledRef = useRef(false);
  const textareaId = 'student-chat-ta';
  const textareaRef = useRef(null);

  // Auto-scroll to bottom unless student scrolled up
  useEffect(() => {
    if (!userScrolledRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Firestore real-time listener
  useEffect(() => {
    if (!db || !sessionCode) { setLoading(false); return; }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setLoading(true);
    const unsub = db
      .collection('sessions').doc(sessionCode)
      .collection('chat')
      .orderBy('createdAt', 'desc')
      .limit(CHAT_PAGE_SIZE)
      .onSnapshot(
        snap => { setMessages(snap.docs.reverse().map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.warn('[StudentChat]', err); setLoading(false); }
      );
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [db, sessionCode]);

  // Focus edit textarea when entering edit mode
  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      editTextareaRef.current.focus();
      const len = editTextareaRef.current.value.length;
      editTextareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const doSend = useCallback(async (msgText) => {
    if (!msgText || sending || !db || !sessionCode) return;
    setSending(true);
    try {
      await db.collection('sessions').doc(sessionCode).collection('chat').add({
        authorName: userName && userName !== 'Anonymous' ? userName : 'Student',
        authorId: userId,
        text: msgText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        reactions: {},
        isInstructor: false,
      });
      setText('');
      userScrolledRef.current = false;
    } catch (e) {
      console.warn('[StudentChat] send error', e);
      setSendError('Could not send. Try again.');
    } finally {
      setSending(false);
    }
  }, [sending, db, sessionCode, userId, userName]);

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    setSendError('');
    setQuestionPrompt(null);
    if (containsProfanity(t)) {
      setSendError('Your message contains language that isn\'t allowed in this session. Please revise it.');
      return;
    }
    if (looksLikeQuestion(t)) { setQuestionPrompt(t); return; }
    doSend(t);
  }, [text, doSend]);

  const handleSendAnyway = useCallback(() => {
    const t = questionPrompt;
    setQuestionPrompt(null);
    doSend(t);
  }, [questionPrompt, doSend]);

  const handlePostToQA = useCallback(async () => {
    if (!questionPrompt || !db || !sessionCode) return;
    const t = questionPrompt;
    setQuestionPrompt(null);
    try {
      await db.collection('sessions').doc(sessionCode).collection('questions').add({
        text: t,
        authorName: userName && userName !== 'Anonymous' ? userName : 'Student',
        authorEmail: '',
        authorId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        pinned: false,
        votes: 0,
        voters: [],
        answer: '',
        fromChat: true,
      });
      setText('');
      setSendError('✓ Posted to Q&A board!');
      setTimeout(() => setSendError(''), 3000);
    } catch (e) {
      setSendError('Could not post to Q&A. Try again.');
    }
  }, [questionPrompt, db, sessionCode, userId, userName]);

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const startEdit = useCallback((msg) => { setEditingId(msg.id); setEditText(msg.text || ''); }, []);
  const cancelEdit = useCallback(() => { setEditingId(null); setEditText(''); }, []);

  const saveEdit = useCallback(async () => {
    const t = editText.trim();
    if (!t || !editingId || !db || !sessionCode || containsProfanity(t)) return;
    try {
      await db.collection('sessions').doc(sessionCode).collection('chat').doc(editingId)
        .update({ text: t, editedAt: firebase.firestore.FieldValue.serverTimestamp() });
      setEditingId(null);
      setEditText('');
    } catch (e) { console.warn('[StudentChat] edit error', e); }
  }, [editText, editingId, db, sessionCode]);

  const editHasProfanity = editingId ? containsProfanity(editText) : false;

  // ── Delete (with custom modal) ────────────────────────────────────────────────
  const confirmAndDelete = useCallback((msgId) => setConfirmDelete(msgId), []);

  const doDelete = useCallback(async () => {
    const msgId = confirmDelete;
    setConfirmDelete(null);
    if (!db || !sessionCode) return;
    try {
      await db.collection('sessions').doc(sessionCode).collection('chat').doc(msgId).delete();
    } catch (e) { console.warn('[StudentChat] delete error', e); }
  }, [confirmDelete, db, sessionCode]);

  // ── React ─────────────────────────────────────────────────────────────────────
  const openReactionPicker = useCallback((msgId, btnRef) => {
    if (reactionPickerId === msgId) { setReactionPickerId(null); setReactionAnchorRef(null); return; }
    setReactionPickerId(msgId);
    setReactionAnchorRef({ current: btnRef });
  }, [reactionPickerId]);

  const handleReact = useCallback(async (msgId, emoji) => {
    setReactionPickerId(null);
    setReactionAnchorRef(null);
    if (!db || !sessionCode) return;
    const msgRef = db.collection('sessions').doc(sessionCode).collection('chat').doc(msgId);
    try {
      const snap = await msgRef.get();
      if (!snap.exists) return;
      const voters = (snap.data().reactions?.[emoji]) || [];
      const already = voters.includes(userId);
      await msgRef.update({ [`reactions.${emoji}`]: already ? voters.filter(v => v !== userId) : [...voters, userId] });
    } catch (e) { console.warn('[StudentChat] react error', e); }
  }, [db, sessionCode, userId]);

  // ── Compose helpers ───────────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation(); // prevent bubbling to question list handlers
      handleSend();
    }
  }

  function handleEditKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  function handleInsertFormat(mode) {
    if (!textareaRef.current) return;
    insertSlackFormat(textareaRef.current, mode);
    setText(textareaRef.current.value);
    textareaRef.current.focus();
  }

  function handleInsertEmoji(ch) {
    if (!textareaRef.current) return;
    insertEmoji(textareaRef.current, ch);
    setText(textareaRef.current.value);
    textareaRef.current.focus();
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(val.trim().toLowerCase()), 200);
  }

  const displayed = searchQuery
    ? messages.filter(m =>
        (m.text || '').toLowerCase().includes(searchQuery) ||
        (m.authorName || '').toLowerCase().includes(searchQuery))
    : messages;

  const isSuccess = sendError.startsWith('✓');

  return (
    <div className="session-chat">
      {/* Delete confirmation modal */}
      {confirmDelete && (
        <ConfirmModal
          message="Delete this message? This cannot be undone."
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Reaction picker (portaled to body to escape overflow clipping) */}
      {reactionPickerId && reactionAnchorRef && (
        <ReactionPicker
          anchorRef={reactionAnchorRef}
          onPick={em => handleReact(reactionPickerId, em)}
          onClose={() => { setReactionPickerId(null); setReactionAnchorRef(null); }}
        />
      )}

      {/* Search */}
      <div className="chat-search-row">
        <input
          type="search"
          placeholder="Search messages…"
          value={searchInput}
          onChange={handleSearchChange}
          className="chat-search-input"
        />
        {searchInput && (
          <button className="chat-search-clear" onClick={() => { setSearchInput(''); setSearchQuery(''); }}>✕</button>
        )}
      </div>

      {/* Feed */}
      <div
        className="chat-feed"
        onScroll={e => {
          const el = e.target;
          userScrolledRef.current = el.scrollTop < el.scrollHeight - el.clientHeight - 60;
        }}
      >
        {loading && <div className="chat-loading">Loading…</div>}
        {!loading && displayed.length === 0 && (
          <div className="chat-empty">{searchQuery ? 'No messages match.' : 'No messages yet. Say hi!'}</div>
        )}
        {displayed.map((msg, idx) => {
          const isMe = msg.authorId === userId;
          const isInstr = msg.isInstructor;
          const prevMsg = idx > 0 ? displayed[idx - 1] : null;
          const sameSender = prevMsg && prevMsg.authorId === msg.authorId;
          const reactionSummary = Object.entries(msg.reactions || {})
            .filter(([, v]) => Array.isArray(v) && v.length > 0)
            .map(([emoji, v]) => ({ emoji, count: v.length }));
          const isEditing = editingId === msg.id;

          return (
            <div key={msg.id} className={`chat-msg${isInstr ? ' chat-msg--instr' : ''}${sameSender ? ' chat-msg--grouped' : ''}`}>
              {!sameSender && (
                <div className="chat-msg-header">
                  <span className={`chat-author${isInstr ? ' chat-author--instr' : ''}${isMe ? ' chat-author--me' : ''}`}>
                    {isMe ? 'You' : (msg.authorName || 'Student')}
                  </span>
                  {isInstr && <span className="chat-instr-badge">Instructor</span>}
                  <span className="chat-time">{formatTime(msg.createdAt)}</span>
                  {isMe && !isEditing && (
                    <span className="chat-msg-actions">
                      <button className="chat-action-btn" title="Edit" onClick={() => startEdit(msg)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="chat-action-btn chat-action-btn--delete" title="Delete" onClick={() => confirmAndDelete(msg.id)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </span>
                  )}
                </div>
              )}
              {sameSender && (
                <div className="chat-msg-header chat-msg-header--grouped">
                  <span className="chat-time chat-time--grouped">{formatTime(msg.createdAt)}</span>
                  {isMe && !isEditing && (
                    <span className="chat-msg-actions">
                      <button className="chat-action-btn" title="Edit" onClick={() => startEdit(msg)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="chat-action-btn chat-action-btn--delete" title="Delete" onClick={() => confirmAndDelete(msg.id)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </span>
                  )}
                </div>
              )}

              {isEditing ? (
                <div className="chat-edit-box">
                  <textarea
                    ref={editTextareaRef}
                    className={`chat-edit-textarea${editHasProfanity ? ' chat-edit-textarea--error' : ''}`}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    rows={2}
                  />
                  {editHasProfanity && <div className="chat-edit-error">Message contains disallowed language.</div>}
                  <div className="chat-edit-actions">
                    <button className="chat-edit-save" disabled={!editText.trim() || editHasProfanity} onClick={saveEdit}>Save</button>
                    <button className="chat-edit-cancel" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* safe: user content HTML-escaped by esc() inside formatRichMessage */}
                  <div className="chat-bubble rich-message" dangerouslySetInnerHTML={{ __html: formatRichMessage(msg.text || '') }} />
                  {msg.editedAt && <span className="chat-edited-label">(edited)</span>}
                </>
              )}

              {!isEditing && (
                <div className="chat-reactions">
                  {reactionSummary.map(({ emoji, count }) => {
                    const mine = (msg.reactions?.[emoji] || []).includes(userId);
                    return (
                      <button
                        key={emoji}
                        className={`chat-reaction-pill${mine ? ' chat-reaction-pill--mine' : ''}`}
                        onClick={() => handleReact(msg.id, emoji)}
                        title={mine ? 'Remove reaction' : 'React'}
                      >{emoji} {count}</button>
                    );
                  })}
                  <button
                    className="chat-reaction-add"
                    title="React"
                    ref={el => {
                      if (reactionPickerId === msg.id && el && reactionAnchorRef?.current !== el) {
                        setReactionAnchorRef({ current: el });
                      }
                    }}
                    onClick={e => openReactionPicker(msg.id, e.currentTarget)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Question detection prompt */}
      {questionPrompt && (
        <div className="chat-question-prompt">
          <div className="chat-question-prompt-text">
            <span className="chat-question-prompt-icon">💬→📋</span>
            <span>That looks like a question — post it to the <strong>Q&A board</strong> so the instructor can answer it there?</span>
          </div>
          <div className="chat-question-prompt-actions">
            <button className="chat-question-yes" onClick={handlePostToQA}>Post to Q&A</button>
            <button className="chat-question-no" onClick={handleSendAnyway}>Just chat</button>
          </div>
        </div>
      )}

      {/* Send error / success feedback */}
      {sendError && (
        <div className={`chat-send-feedback${isSuccess ? ' chat-send-feedback--ok' : ' chat-send-feedback--err'}`}>
          {sendError}
        </div>
      )}

      {/* Compose */}
      <div className="chat-toolbar-wrap format-toolbar--compact">
        <FormatToolbar
          targetId={textareaId}
          onInsertFormat={handleInsertFormat}
          onInsertEmoji={handleInsertEmoji}
        />
      </div>
      <div className="chat-compose">
        <textarea
          id={textareaId}
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message the room… (Enter to send)"
          value={text}
          onChange={e => { setText(e.target.value); if (sendError && !sendError.startsWith('✓')) setSendError(''); }}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          className="chat-send-btn"
          disabled={!text.trim() || sending}
          onClick={handleSend}
          title="Send (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}
