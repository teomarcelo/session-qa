/**
 * SessionChat — Zoom-style live chat for the instructor sidebar.
 *
 * Features:
 *  - Messages stored in sessions/{code}/chat Firestore subcollection
 *  - Real-time onSnapshot listener
 *  - Emoji reactions (stored per message as { emoji: count } map)
 *  - Question detection: if a message looks like a question, prompt to
 *    escalate it to the Q&A board
 *  - Full-text search across loaded messages
 *  - Rich text format toolbar (bold, italic, link, code)
 *  - Demo mode: local state only, no Firestore writes
 *
 * safe: all user content rendered via esc() / formatRichMessage
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import firebase from '../../../lib/firebaseCompat.js';
import { useFirebase } from '../../../shared/FirebaseContext.jsx';
import useInstructorStore from '../../store/useInstructorStore.js';
import { formatRichMessage, esc } from '../../../lib/richText.js';
import { insertSlackFormat } from '../FormatToolbar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const CHAT_PAGE_SIZE = 60;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '💡', '🙌', '✅'];

// Heuristic: does this message look like a question?
function looksLikeQuestion(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 8) return false;
  if (t.endsWith('?')) return true;
  const lower = t.toLowerCase();
  return /^(how|what|why|when|where|who|which|can|could|is|are|does|do|will|would|should|has|have)\b/.test(lower);
}

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function genDemoId() {
  return 'chat-demo-' + Math.random().toString(36).slice(2, 10);
}

const DEMO_MESSAGES = [
  { id: 'dm1', authorName: 'Alex Rivera', authorId: 'instr-demo', text: "Welcome everyone! Feel free to chat here while we get started.", createdAt: { seconds: Math.floor(Date.now() / 1000) - 300 }, reactions: {}, isInstructor: true },
  { id: 'dm2', authorName: 'Maria S.', authorId: 'u1', text: "Thanks! Excited for this session.", createdAt: { seconds: Math.floor(Date.now() / 1000) - 240 }, reactions: { '👍': ['u2', 'u3'] } },
  { id: 'dm3', authorName: 'James K.', authorId: 'u2', text: "Can you share the slide deck after?", createdAt: { seconds: Math.floor(Date.now() / 1000) - 180 }, reactions: {} },
  { id: 'dm4', authorName: 'Priya M.', authorId: 'u4', text: "This is really helpful, thank you 🙌", createdAt: { seconds: Math.floor(Date.now() / 1000) - 60 }, reactions: { '❤️': ['u1'] } },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function SessionChat() {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const showToast = useInstructorStore(s => s.showToast);
  const prependQuestion = useInstructorStore(s => s.prependQuestion);

  const [messages, setMessages] = useState(isDemoMode ? DEMO_MESSAGES : []);
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [escalateMsg, setEscalateMsg] = useState(null); // message to escalate
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(!isDemoMode);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const textareaId = 'chat-input-ta';
  const searchTimerRef = useRef(null);
  const unsubRef = useRef(null);
  const scrolledRef = useRef(false);

  // Scroll to bottom on new messages (unless user has scrolled up)
  useEffect(() => {
    if (!scrolledRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-scroll on mount
  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView();
  }, []);

  // ── Firestore listener ──────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode || !db || !activeSessionCode) {
      setLoading(false);
      return;
    }

    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    setLoading(true);
    const unsub = db
      .collection('sessions')
      .doc(activeSessionCode)
      .collection('chat')
      .orderBy('createdAt', 'desc')
      .limit(CHAT_PAGE_SIZE)
      .onSnapshot(
        (snap) => {
          const msgs = snap.docs.reverse().map(d => ({ id: d.id, ...d.data() }));
          setMessages(msgs);
          setLoading(false);
        },
        (err) => {
          console.warn('[SessionChat] listener error:', err);
          setLoading(false);
        }
      );

    unsubRef.current = unsub;
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [db, isDemoMode, activeSessionCode]);

  // ── Send message ────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const t = text.trim();
    if (!t || sending) return;

    if (isDemoMode) {
      const msg = {
        id: genDemoId(),
        authorName: currentInstructor || 'Instructor',
        authorId: 'instr-demo',
        text: t,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        reactions: {},
        isInstructor: true,
      };
      setMessages(prev => [...prev, msg]);
      setText('');
      // Check if it looks like a question
      if (looksLikeQuestion(t)) setEscalateMsg(msg);
      return;
    }

    if (!db || !activeSessionCode) return;
    setSending(true);
    try {
      const payload = {
        authorName: currentInstructor || 'Instructor',
        authorId: 'instructor',
        text: t,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        reactions: {},
        isInstructor: true,
      };
      const ref = await db
        .collection('sessions').doc(activeSessionCode)
        .collection('chat').add(payload);
      setText('');
      if (looksLikeQuestion(t)) setEscalateMsg({ ...payload, id: ref.id, text: t });
    } catch (e) {
      showToast('Could not send message.');
    } finally {
      setSending(false);
    }
  }, [text, sending, isDemoMode, db, activeSessionCode, currentInstructor, showToast]);

  // ── React to a message ──────────────────────────────────────────
  const handleReact = useCallback(async (msgId, emoji) => {
    setReactionPickerId(null);
    const instructorId = isDemoMode ? 'instr-demo' : 'instructor';

    if (isDemoMode) {
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const voters = m.reactions?.[emoji] || [];
        const already = voters.includes(instructorId);
        const next = already ? voters.filter(v => v !== instructorId) : [...voters, instructorId];
        return { ...m, reactions: { ...(m.reactions || {}), [emoji]: next } };
      }));
      return;
    }

    if (!db || !activeSessionCode) return;
    const msgRef = db.collection('sessions').doc(activeSessionCode).collection('chat').doc(msgId);
    try {
      const snap = await msgRef.get();
      if (!snap.exists) return;
      const data = snap.data();
      const voters = (data.reactions && data.reactions[emoji]) || [];
      const already = voters.includes(instructorId);
      const next = already ? voters.filter(v => v !== instructorId) : [...voters, instructorId];
      await msgRef.update({ [`reactions.${emoji}`]: next });
    } catch (e) {
      showToast('Could not add reaction.');
    }
  }, [isDemoMode, db, activeSessionCode, showToast]);

  // ── Escalate chat message to Q&A board ─────────────────────────
  const handleEscalate = useCallback(async (msg) => {
    setEscalateMsg(null);
    const newQ = {
      id: isDemoMode ? 'sdemo-chat-' + Date.now() : undefined,
      text: msg.text,
      authorName: msg.authorName || 'Anonymous',
      authorEmail: '',
      authorId: msg.authorId || 'chat',
      status: 'pending',
      pinned: false,
      votes: 0,
      voters: [],
      answer: '',
      createdAt: msg.createdAt || new Date(),
    };

    if (isDemoMode) {
      prependQuestion(newQ);
      showToast('Added to Q&A board!');
      return;
    }

    if (!db || !activeSessionCode) return;
    try {
      await db
        .collection('sessions').doc(activeSessionCode)
        .collection('questions').add({
          text: msg.text,
          authorName: msg.authorName || 'Anonymous',
          authorEmail: '',
          authorId: msg.authorId || 'chat',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
          pinned: false,
          votes: 0,
          voters: [],
          answer: '',
          fromChat: true,
        });
      showToast('Added to Q&A board!');
    } catch (e) {
      showToast('Could not add to board.');
    }
  }, [isDemoMode, db, activeSessionCode, prependQuestion, showToast]);

  // ── Search filter ───────────────────────────────────────────────
  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(val.trim().toLowerCase()), 200);
  }

  const displayed = searchQuery
    ? messages.filter(m => (m.text || '').toLowerCase().includes(searchQuery) || (m.authorName || '').toLowerCase().includes(searchQuery))
    : messages;

  // ── Format toolbar helpers ──────────────────────────────────────
  function handleInsertFormat(mode) {
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    insertSlackFormat(textareaId, mode);
    setText(ta.value);
    ta.focus();
  }

  // Enter to send, Shift+Enter for newline
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionPickerId) return;
    function handler(e) {
      if (!e.target.closest('.chat-reaction-picker')) setReactionPickerId(null);
    }
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [reactionPickerId]);

  if (!activeSessionCode) {
    return <p className="instr-feedback-lead">Select a session to use chat.</p>;
  }

  return (
    <div className="session-chat">
      {/* Search bar */}
      <div className="chat-search-row">
        <input
          type="search"
          placeholder="Search messages…"
          value={searchInput}
          onChange={handleSearchChange}
          className="mini-input chat-search-input"
        />
        {searchInput && (
          <button className="chat-search-clear" onClick={() => { setSearchInput(''); setSearchQuery(''); }}>✕</button>
        )}
      </div>

      {/* Messages feed */}
      <div className="chat-feed" onScroll={e => { scrolledRef.current = e.target.scrollTop < e.target.scrollHeight - e.target.clientHeight - 40; }}>
        {loading && <div className="chat-loading">Loading…</div>}
        {!loading && displayed.length === 0 && (
          <div className="chat-empty">
            {searchQuery ? 'No messages match.' : 'No messages yet. Say something!'}
          </div>
        )}
        {displayed.map((msg, idx) => {
          const isInstr = msg.isInstructor;
          const totalReactions = Object.values(msg.reactions || {}).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
          const reactionSummary = Object.entries(msg.reactions || {})
            .filter(([, v]) => Array.isArray(v) && v.length > 0)
            .map(([emoji, v]) => ({ emoji, count: v.length }));
          const showEscalate = looksLikeQuestion(msg.text);
          const prevMsg = idx > 0 ? displayed[idx - 1] : null;
          const sameSender = prevMsg && prevMsg.authorId === msg.authorId;

          return (
            <div key={msg.id} className={`chat-msg${isInstr ? ' chat-msg--instr' : ''}${sameSender ? ' chat-msg--grouped' : ''}`}>
              {!sameSender && (
                <div className="chat-msg-header">
                  <span className={`chat-author${isInstr ? ' chat-author--instr' : ''}`}>{msg.authorName || 'Anonymous'}</span>
                  {isInstr && <span className="chat-instr-badge">Instructor</span>}
                  <span className="chat-time">{formatTime(msg.createdAt)}</span>
                </div>
              )}
              {sameSender && (
                <span className="chat-time chat-time--grouped">{formatTime(msg.createdAt)}</span>
              )}
              {/* safe: user content is HTML-escaped by esc() inside formatRichMessage */}
              <div
                className="chat-bubble rich-message"
                dangerouslySetInnerHTML={{ __html: formatRichMessage(msg.text || '') }}
              />

              {/* Reaction summary + add reaction */}
              <div className="chat-reactions">
                {reactionSummary.map(({ emoji, count }) => {
                  const myId = isDemoMode ? 'instr-demo' : 'instructor';
                  const mine = (msg.reactions?.[emoji] || []).includes(myId);
                  return (
                    <button
                      key={emoji}
                      className={`chat-reaction-pill${mine ? ' chat-reaction-pill--mine' : ''}`}
                      onClick={() => handleReact(msg.id, emoji)}
                      title={mine ? 'Remove reaction' : 'Add reaction'}
                    >
                      {emoji} {count}
                    </button>
                  );
                })}
                <div className="chat-reaction-trigger-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    className="chat-reaction-add"
                    title="React"
                    onClick={() => setReactionPickerId(p => p === msg.id ? null : msg.id)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </button>
                  {reactionPickerId === msg.id && (
                    <div className="chat-reaction-picker">
                      {REACTION_EMOJIS.map(em => (
                        <button
                          key={em}
                          className="chat-reaction-option"
                          onClick={() => handleReact(msg.id, em)}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {showEscalate && (
                  <button
                    className="chat-escalate-btn"
                    title="Add to Q&A board"
                    onClick={() => setEscalateMsg(msg)}
                  >
                    ↑ Move to Q&A
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Escalate confirmation */}
      {escalateMsg && (
        <div className="chat-escalate-prompt">
          <div className="chat-escalate-text">
            <strong>Post to Q&A board?</strong>
            <span className="chat-escalate-preview">&ldquo;{escalateMsg.text.slice(0, 80)}{escalateMsg.text.length > 80 ? '…' : ''}&rdquo;</span>
          </div>
          <div className="chat-escalate-actions">
            <button className="chat-escalate-yes" onClick={() => handleEscalate(escalateMsg)}>Yes, add it</button>
            <button className="chat-escalate-no" onClick={() => setEscalateMsg(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Format mini-toolbar */}
      <div className="chat-fmt-bar">
        <button type="button" className="fmt-btn fmt-btn-b chat-fmt-btn" title="Bold (*text*)" onClick={() => handleInsertFormat('bold')}><strong>B</strong></button>
        <button type="button" className="fmt-btn fmt-btn-i chat-fmt-btn" title="Italic (_text_)" onClick={() => handleInsertFormat('italic')}><em>I</em></button>
        <button type="button" className="fmt-btn fmt-btn-link chat-fmt-btn" title="Link [label](url)" onClick={() => handleInsertFormat('link')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
        <button type="button" className="fmt-btn fmt-btn-mono chat-fmt-btn" title="Code (`text`)" onClick={() => handleInsertFormat('code')}>`</button>
        <span className="chat-fmt-hint">Shift+Enter for newline</span>
      </div>

      {/* Compose */}
      <div className="chat-compose">
        <textarea
          id={textareaId}
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message the room… (Enter to send)"
          value={text}
          onChange={e => setText(e.target.value)}
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
