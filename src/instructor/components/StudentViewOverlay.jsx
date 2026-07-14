/**
 * StudentViewOverlay — full-screen overlay showing the student app view.
 *
 * Live session: renders student.html in an iframe (fully isolated, correct CSS,
 * auto-joins via ?code=SQA-XXXX URL param supported by useStudentSession).
 *
 * Demo mode: renders a full-width preview that mirrors the REAL student dashboard
 * (src/student/components/AppScreen.jsx + children) feature-for-feature, driven by
 * the in-memory demo store. It never touches Firestore and never uses the real
 * student write paths — it only reads/writes the instructor demo store.
 *
 * The instructor bundle only loads instructor.css (not student.css), so the demo
 * view mirrors the student layout with inline styles rather than reusing the
 * student components' class-based markup. Shared classes that DO exist in
 * instructor.css (rich-message, attachment-img-link, the lightbox) are reused so
 * rich text + attached-image zoom work identically.
 *
 * safe: user content is HTML-escaped by esc() inside formatRichMessage
 */
import { useState, useEffect } from 'react';
import { formatRichMessage, isHttpsUrl, isHttpOrHttpsUrl } from '../../lib/richText.js';
import { htmlAnsweredStatusBadges } from '../../lib/answeredBadge.js';
import { getSessionInstructorRoster } from '../../lib/sessionInstructors.js';
import { getStudentVisibleSessionNotes, isStudentInstructorNotesDashboardEnabled } from '../../lib/sessionNotes.js';
import {
  getEffectiveStudentOrgClaimUrl,
  getStudentOrgClaimCodeOnly,
  sessionShowsSurveyOnStudent,
} from '../../lib/sessionLaunch.js';
import { sessionDateTimeLine, studentSessionDisplayTitle } from '../../student/components/SessionInfo.jsx';
import useInstructorStore from '../store/useInstructorStore.js';
import { resetDemoData } from '../hooks/useInstructorAuth.js';

const SDEMO_USER_ID = 'demo-student-overlay';

// Shared palette (mirrors the real student board's tokens).
const C = {
  paper: '#f7f6f3',
  card: '#fff',
  border: '#e2ddd6',
  blue: '#0070d2',
  blueSoft: '#e8f2fc',
  ink: '#1a1814',
  muted: '#7a7570',
  light: '#b0aba4',
  pin: '#6a0dad',
};

export default function StudentViewOverlay() {
  const studentViewOpen = useInstructorStore(s => s.studentViewOpen);
  const setStudentViewOpen = useInstructorStore(s => s.setStudentViewOpen);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const demoResetNonce = useInstructorStore(s => s.demoResetNonce);
  const activeSession = allSessions.find(s => s.id === activeSessionCode);

  if (!studentViewOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: C.paper,
      }}
    >
      {/* Instructor overlay bar */}
      <div style={{
        background: '#1a1814',
        color: '#fff',
        padding: '0 1.25rem',
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, height: 20, background: '#6a0dad', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style={{ fontSize: '.82rem', fontWeight: 500 }}>Student view</span>
          {isDemoMode && (
            <span style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24', fontSize: '.68rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
              Demo preview
            </span>
          )}
          {!isDemoMode && activeSessionCode && (
            <span style={{ background: 'rgba(0,112,210,0.25)', color: '#60a5fa', fontSize: '.68rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
              Live — {activeSessionCode}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDemoMode && (
            <button
              onClick={() => resetDemoData()}
              title="Restore fresh demo data"
              style={{
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.45)',
                color: '#fbbf24',
                borderRadius: 6,
                padding: '3px 12px',
                fontFamily: 'inherit',
                fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              ↺ Reset demo
            </button>
          )}
          <button
            onClick={() => setStudentViewOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 6,
              padding: '3px 12px',
              fontFamily: 'inherit',
              fontSize: '.8rem',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isDemoMode ? (
          // key on the reset nonce so Reset Demo clears the view's local state
          // (voters, edit drafts, search, sort, feed toggle) by remounting.
          <DemoStudentView key={demoResetNonce} activeSession={activeSession} />
        ) : (
          <LiveStudentView sessionCode={activeSessionCode} />
        )}
      </div>
    </div>
  );
}

// ── Live session view ─────────────────────────────────────────────────────────
// Uses an iframe so student.html renders with its own CSS bundle, exactly as
// students see it. ?code= param triggers auto-join via useStudentSession.
function LiveStudentView({ sessionCode }) {
  const src = `./student.html?code=${encodeURIComponent(sessionCode)}`;
  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="Student view"
    />
  );
}

// Track the stacked (narrow) breakpoint so the demo view can mirror the real
// student responsive layout: on narrow screens the session details move BELOW
// the question feed.
function useIsStacked() {
  const [stacked, setStacked] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setStacked(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return stacked;
}

// ── Demo mode full-screen preview ─────────────────────────────────────────────
function DemoStudentView({ activeSession }) {
  const allQuestions = useInstructorStore(s => s.allQuestions);
  const sdemoFilter = useInstructorStore(s => s.sdemoFilter);
  const setSdemoFilter = useInstructorStore(s => s.setSdemoFilter);
  const prependQuestion = useInstructorStore(s => s.prependQuestion);
  const updateQuestionInPages = useInstructorStore(s => s.updateQuestionInPages);
  const addDemoFeedback = useInstructorStore(s => s.addDemoFeedback);
  const showToast = useInstructorStore(s => s.showToast);

  const stacked = useIsStacked();

  const [demoText, setDemoText] = useState('');
  const [demoName, setDemoName] = useState('Demo Student');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [voters, setVoters] = useState(new Set());
  const [sort, setSort] = useState('recent'); // 'recent' | 'votes'
  const [feedView, setFeedView] = useState('qa'); // 'qa' | 'notes'
  const [searchInput, setSearchInput] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const notesEnabled = isStudentInstructorNotesDashboardEnabled(activeSession);
  const isNotesView = feedView === 'notes' && notesEnabled;

  // Filter → search → sort (mirrors the real student board's ordering).
  const query = searchInput.trim().toLowerCase();
  const searchActive = !!query;
  const filtered = allQuestions
    .filter(q => {
      if (sdemoFilter === 'pinned') return q.pinned;
      if (sdemoFilter === 'answered') return q.status === 'answered';
      if (sdemoFilter === 'unanswered') return q.status !== 'answered';
      return true;
    })
    .filter(q => {
      if (!searchActive) return true;
      const answers = (q.answers && q.answers.length ? q.answers.map(a => a.text) : [q.answer]);
      const hay = [q.text, q.authorName, ...answers].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    })
    .slice()
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sort === 'votes') return (b.votes || 0) - (a.votes || 0);
      const at = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
      const bt = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
      return bt - at;
    });

  const totalQ = allQuestions.length;
  const answeredQ = allQuestions.filter(q => q.status === 'answered').length;
  const pendingQ = allQuestions.filter(q => q.status !== 'answered').length;
  const pinnedQ = allQuestions.filter(q => q.pinned).length;

  const handleSubmit = () => {
    const text = demoText.trim();
    if (!text) return;
    prependQuestion({
      id: 'sdemo-' + Date.now(),
      text,
      authorName: demoName.trim() || 'Demo Student',
      authorEmail: '',
      authorId: SDEMO_USER_ID,
      status: 'pending',
      pinned: false,
      votes: 0,
      voters: [],
      answer: '',
      createdAt: new Date(),
    });
    setDemoText('');
    if (isNotesView) setFeedView('qa');
    showToast('Student question submitted!');
  };

  // Image paste is intentionally blocked in demo (no Firebase Storage) with a
  // friendly toast — consistent with how the instructor demo blocks answer/note
  // image paste in Dashboard.jsx.
  const handleAskPaste = (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    let hasImage = false;
    if (cd.items) {
      for (let i = 0; i < cd.items.length; i++) {
        if (cd.items[i].type && cd.items[i].type.indexOf('image') === 0) { hasImage = true; break; }
      }
    }
    if (!hasImage && cd.files && cd.files.length) {
      for (let j = 0; j < cd.files.length; j++) {
        if (cd.files[j].type && cd.files[j].type.indexOf('image') === 0) { hasImage = true; break; }
      }
    }
    if (hasImage) {
      e.preventDefault();
      showToast('Image paste: use a live session (demo has no Storage).');
    }
  };

  const handleUpvote = (id) => {
    const q = allQuestions.find(x => x.id === id);
    if (!q) return;
    const voted = voters.has(id);
    if (voted) {
      setVoters(prev => { const s = new Set(prev); s.delete(id); return s; });
      updateQuestionInPages(id, qItem => ({
        ...qItem,
        votes: Math.max(0, (qItem.votes || 0) - 1),
        voters: (qItem.voters || []).filter(v => v !== SDEMO_USER_ID),
      }));
    } else {
      setVoters(prev => new Set([...prev, id]));
      updateQuestionInPages(id, qItem => ({
        ...qItem,
        votes: (qItem.votes || 0) + 1,
        voters: [...(qItem.voters || []), SDEMO_USER_ID],
      }));
    }
  };

  const saveEdit = (id) => {
    if (!editText.trim()) return;
    updateQuestionInPages(id, qItem => ({ ...qItem, text: editText.trim() }));
    setEditingId(null);
    setEditText('');
  };

  const filterBtns = [
    { key: 'all', label: 'All' },
    { key: 'unanswered', label: 'Unanswered' },
    { key: 'answered', label: 'Answered' },
    { key: 'pinned', label: 'Pinned' },
  ];

  const chipStyle = (active) => ({
    padding: '4px 14px',
    border: `1.5px solid ${active ? C.blue : C.border}`,
    borderRadius: 20,
    background: active ? C.blueSoft : C.card,
    fontFamily: 'inherit',
    fontSize: '.8rem',
    color: active ? C.blue : C.muted,
    cursor: 'pointer',
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.paper }}>
      {/* Student top bar */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.blue, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: '.95rem' }}>Session Q&amp;A</span>
          {activeSession && (
            <span style={{ fontSize: '.8rem', color: C.muted }}>— {studentSessionDisplayTitle(activeSession)}</span>
          )}
        </div>
        <span style={{ fontSize: '.78rem', color: C.light, background: C.paper, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.border}` }}>
          SQA-DEMO
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          alignItems: 'flex-start',
          gap: '1rem',
          maxWidth: stacked ? 760 : 1060,
          margin: '0 auto',
          padding: '1.25rem 1.5rem',
        }}>
          {/* Main column */}
          <div style={{ flex: stacked ? 'none' : 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Ask box */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.1rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: '.6rem' }}>Ask a question</div>
              <textarea
                placeholder="What's on your mind? You can also paste a screenshot."
                value={demoText}
                onChange={e => setDemoText(e.target.value)}
                onPaste={handleAskPaste}
                style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '.65rem .85rem', fontFamily: 'inherit', fontSize: '.88rem', resize: 'none', height: 80, background: C.paper, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = C.blue; e.target.style.background = C.card; }}
                onBlur={e => { e.target.style.borderColor = C.border; e.target.style.background = C.paper; }}
              />
              <div style={{ display: 'flex', gap: '.6rem', marginTop: '.6rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={demoName}
                  onChange={e => setDemoName(e.target.value)}
                  style={{ flex: 1, padding: '.5rem .75rem', border: `1.5px solid ${C.border}`, borderRadius: 8, fontFamily: 'inherit', fontSize: '.83rem', background: C.paper, color: C.ink, outline: 'none' }}
                />
                <button
                  onClick={handleSubmit}
                  style={{ padding: '.5rem 1.25rem', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.83rem', fontWeight: 500, cursor: 'pointer' }}
                >
                  Submit
                </button>
              </div>
              <div style={{ marginTop: '.55rem', fontSize: '.75rem', color: C.light }}>
                💡 In a real session, students can paste screenshots directly into this box to attach images to their question.
              </div>
            </div>

            {/* Search row */}
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search questions…"
                aria-label="Search questions and answers"
                autoComplete="off"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ flex: 1, padding: '.5rem .75rem', border: `1.5px solid ${C.border}`, borderRadius: 8, fontFamily: 'inherit', fontSize: '.83rem', background: C.card, color: C.ink, outline: 'none' }}
              />
              {searchActive && (
                <button
                  onClick={() => setSearchInput('')}
                  style={{ padding: '.45rem .9rem', border: `1.5px solid ${C.border}`, borderRadius: 8, background: C.card, fontFamily: 'inherit', fontSize: '.8rem', color: C.muted, cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter / sort / notes toolbar */}
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {filterBtns.map(f => (
                <button
                  key={f.key}
                  onClick={() => { if (isNotesView) setFeedView('qa'); setSdemoFilter(f.key); setSort('recent'); }}
                  style={chipStyle(!isNotesView && sdemoFilter === f.key && sort !== 'votes')}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => { if (isNotesView) setFeedView('qa'); setSort(s => (s === 'votes' ? 'recent' : 'votes')); }}
                title="Off = newest first, on = highest votes first."
                style={chipStyle(!isNotesView && sort === 'votes')}
              >
                Most votes
              </button>
              {notesEnabled && (
                <button
                  onClick={() => setFeedView(v => (v === 'notes' ? 'qa' : 'notes'))}
                  style={chipStyle(isNotesView)}
                >
                  Instructor notes
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: C.light, alignSelf: 'center' }}>
                {totalQ} questions · {answeredQ} answered · {pendingQ} pending
              </span>
            </div>

            {/* Feed: notes OR question cards */}
            {isNotesView ? (
              <DemoNotesFeed session={activeSession} />
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: C.light, fontSize: '.9rem' }}>
                {searchActive ? `No questions match “${searchInput.trim()}”.` : 'No questions here yet.'}
              </div>
            ) : (
              filtered.map(q => {
                const mine = q.authorId === SDEMO_USER_ID;
                const voted = voters.has(q.id);
                const answers = q.answers && q.answers.length
                  ? q.answers
                  : (q.answer ? [{ instructor: 'Instructor', text: q.answer }] : []);
                const imgUrls = Array.isArray(q.imageUrls) ? q.imageUrls.filter(u => u && u.startsWith('http')) : [];
                return (
                  <div
                    key={q.id}
                    style={{
                      background: q.pinned ? '#faf5ff' : C.card,
                      border: `1px solid ${q.pinned ? '#c084fc' : C.border}`,
                      borderRadius: 12,
                      padding: '1rem 1.1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '.78rem', fontWeight: 500, color: C.muted }}>{q.authorName || 'Anonymous'}</span>
                        {q.pinned && (
                          <span style={{ fontSize: '.67rem', fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#f3e8ff', color: C.pin }}>Pinned</span>
                        )}
                        {q.status === 'answered'
                          /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
                          ? <span dangerouslySetInnerHTML={{ __html: htmlAnsweredStatusBadges(q) }} />
                          : <span style={{ fontSize: '.67rem', fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#fff3e0', color: '#e65100' }}>Pending</span>
                        }
                      </div>
                      {mine && editingId !== q.id && (
                        <button
                          onClick={() => { setEditingId(q.id); setEditText(q.text); }}
                          style={{ fontSize: '.74rem', color: C.light, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }}
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {editingId === q.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onPaste={handleAskPaste}
                          style={{ width: '100%', border: `1.5px solid ${C.blue}`, borderRadius: 6, padding: '.5rem .7rem', fontFamily: 'inherit', fontSize: '.9rem', resize: 'vertical', outline: 'none', background: C.card, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '.4rem', marginTop: '.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingId(null)} style={{ padding: '3px 12px', border: `1.5px solid ${C.border}`, borderRadius: 6, fontFamily: 'inherit', fontSize: '.8rem', cursor: 'pointer', background: 'none' }}>Cancel</button>
                          <button onClick={() => saveEdit(q.id)} style={{ padding: '3px 12px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: '.8rem', cursor: 'pointer' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
                      <div
                        className="rich-message"
                        style={{ fontSize: '.9rem', lineHeight: 1.55, marginBottom: imgUrls.length ? '.6rem' : '.45rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: formatRichMessage(q.text || '') }}
                      />
                    )}

                    {/* Attached images (open in the shared lightbox) */}
                    {imgUrls.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.55rem' }}>
                        {imgUrls.map(u => (
                          <a key={u} className="attachment-img-link" href={u} target="_blank" rel="noopener noreferrer">
                            <img
                              src={u}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }}
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Answers */}
                    {answers.map((a, i) => (
                      <div key={i} style={{ background: C.blueSoft, borderLeft: `3px solid ${C.blue}`, borderRadius: '0 8px 8px 0', padding: '.55rem .85rem', marginTop: '.4rem' }}>
                        <div style={{ fontSize: '.67rem', fontWeight: 600, color: C.blue, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>{a.instructor || 'Instructor'}</div>
                        {/* safe: user content is HTML-escaped by esc() inside formatRichMessage */}
                        <div
                          className="rich-message"
                          style={{ fontSize: '.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: formatRichMessage(a.text || '') }}
                        />
                        {Array.isArray(a.imageUrls) && a.imageUrls.filter(isHttpsUrl).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.5rem' }}>
                            {a.imageUrls.filter(isHttpsUrl).map(u => (
                              <a key={u} className="attachment-img-link" href={u} target="_blank" rel="noopener noreferrer">
                                <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={{ marginTop: '.5rem' }}>
                      <button
                        onClick={() => handleUpvote(q.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '4px 11px',
                          border: `1.5px solid ${voted ? C.blue : C.border}`,
                          borderRadius: 20,
                          background: voted ? C.blueSoft : 'none',
                          fontFamily: 'inherit',
                          fontSize: '.78rem',
                          color: voted ? C.blue : C.muted,
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                        {q.votes || 0}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Session sidebar (below the feed on narrow screens, like the real board) */}
          <DemoSidebar
            session={activeSession}
            stats={{ total: totalQ, answered: answeredQ, pending: pendingQ, pinned: pinnedQ }}
            stacked={stacked}
            showToast={showToast}
            onOpenFeedback={() => setFeedbackOpen(true)}
          />
        </div>
      </div>

      {feedbackOpen && (
        <DemoFeedbackModal
          onClose={() => setFeedbackOpen(false)}
          onSubmit={(entry) => { addDemoFeedback(entry); showToast('Thanks — your feedback was sent.'); }}
        />
      )}
    </div>
  );
}

// ── Session sidebar (mirrors SessionSidebar + SessionInfo) ─────────────────────
function copyPlainToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('clipboard unavailable'));
}

function DemoSidebar({ session, stats, stacked, showToast, onOpenFeedback }) {
  const s = session || {};
  const title = studentSessionDisplayTitle(s);
  const dateLine = sessionDateTimeLine(s);
  const room = s.room || '—';
  const desc = String(s.description || '').trim();
  const { lead, coInstructors } = getSessionInstructorRoster(s);

  const orgClaimUrl = getEffectiveStudentOrgClaimUrl(s);
  const orgClaimCode = getStudentOrgClaimCodeOnly(s).replace(/\r\n/g, '\n').trim();
  const showSurvey = sessionShowsSurveyOnStudent(s);
  const surveyUrl = String(s.studentSurveyUrl || '').trim();
  const surveyCode = String(s.studentSurveyCopyText || '').replace(/\r\n/g, '\n').trim();

  const handleOrgClaim = () => {
    if (!isHttpOrHttpsUrl(orgClaimUrl)) { showToast('OrgClaim link is not a valid http(s) URL.'); return; }
    window.open(orgClaimUrl, '_blank', 'noopener,noreferrer');
    if (!orgClaimCode) { showToast('Link opened. No OrgClaim code to copy.'); return; }
    copyPlainToClipboard(orgClaimCode).then(
      () => showToast('OrgClaim code copied. Link opened in a new tab.'),
      () => showToast('Link opened — copy failed. Use the code shown below.'),
    );
  };

  const handleSurvey = () => {
    window.open(surveyUrl, '_blank', 'noopener,noreferrer');
    copyPlainToClipboard(surveyCode).then(
      () => showToast('Survey ID copied. Link opened in a new tab.'),
      () => showToast('Link opened — copy failed. Use the ID shown below.'),
    );
  };

  const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem 1.1rem' };
  const launchBtn = { width: '100%', padding: '.5rem .75rem', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer' };
  const statCard = { background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: '.6rem', textAlign: 'center' };

  return (
    <div style={{
      width: stacked ? '100%' : 320,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {/* Session info card */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.5rem' }}>{title || 'Session'}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: C.muted, marginBottom: '.35rem' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>{dateLine}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: C.muted, marginBottom: '.35rem' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{room}</span>
        </div>

        {lead && (
          <div style={{ marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: C.ink, fontWeight: 600 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>{lead}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill={C.pin} stroke={C.pin} strokeWidth="1" strokeLinejoin="round" aria-label="Lead instructor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            {coInstructors.map(name => (
              <div key={name} style={{ fontSize: '.8rem', color: C.muted, paddingLeft: 19 }}>{name}</div>
            ))}
          </div>
        )}

        {desc && (
          <div style={{ marginTop: '.6rem', fontSize: '.82rem', lineHeight: 1.5, color: C.ink }}>{desc}</div>
        )}

        {/* OrgClaim */}
        <div style={{ marginTop: '.8rem' }}>
          <button onClick={handleOrgClaim} style={launchBtn}>OrgClaim</button>
          {orgClaimCode && (
            <div style={{ marginTop: '.35rem', fontSize: '.75rem', color: C.muted }}>
              OrgClaim Code: <strong style={{ color: C.ink }}>{orgClaimCode}</strong>
              <div style={{ fontSize: '.7rem', color: C.light, marginTop: 2 }}>Clicking the button copies the OrgClaim code.</div>
            </div>
          )}
        </div>

        {/* Survey */}
        {showSurvey && (
          <div style={{ marginTop: '.7rem' }}>
            <button onClick={handleSurvey} style={launchBtn}>SURVEY</button>
            <div style={{ marginTop: '.35rem', fontSize: '.75rem', color: C.muted }}>
              Survey ID: <strong style={{ color: C.ink }}>{surveyCode}</strong>
              <div style={{ fontSize: '.7rem', color: C.light, marginTop: 2 }}>Clicking the button copies the survey ID.</div>
            </div>
          </div>
        )}
      </div>

      {/* Session stats */}
      <div style={cardStyle}>
        <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: C.muted, marginBottom: '.6rem' }}>Session stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
          <div style={statCard}><div style={{ fontSize: '1.3rem', fontWeight: 700, color: C.ink }}>{stats.total}</div><div style={{ fontSize: '.7rem', color: C.muted }}>Total</div></div>
          <div style={statCard}><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#16a34a' }}>{stats.answered}</div><div style={{ fontSize: '.7rem', color: C.muted }}>Answered</div></div>
          <div style={statCard}><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e65100' }}>{stats.pending}</div><div style={{ fontSize: '.7rem', color: C.muted }}>Pending</div></div>
          <div style={statCard}><div style={{ fontSize: '1.3rem', fontWeight: 700, color: C.pin }}>{stats.pinned}</div><div style={{ fontSize: '.7rem', color: C.muted }}>Pinned</div></div>
        </div>
      </div>

      {/* Feedback entry point */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '.7rem' }}>
        <p style={{ margin: 0, flex: 1, fontSize: '.78rem', color: C.muted, lineHeight: 1.4 }}>
          Please share feedback on this dashboard for improvements or suggestions.
        </p>
        <button
          onClick={onOpenFeedback}
          title="Send feedback"
          aria-label="Send feedback"
          style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.paper, color: C.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Instructor notes feed (mirrors InstructorNotesFeed) ────────────────────────
function DemoNotesFeed({ session }) {
  const notes = getStudentVisibleSessionNotes(session);
  if (!notes.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: C.light, fontSize: '.9rem' }}>
        No instructor notes yet. Check back after the host posts an update.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      {notes.map((n, i) => {
        const who = String(n.instructor || '').trim();
        const t = String(n.title || '').trim();
        const b = String(n.body || '').trim();
        const imgs = (Array.isArray(n.imageUrls) ? n.imageUrls : []).map(u => String(u || '').trim()).filter(isHttpsUrl);
        const links = (Array.isArray(n.links) ? n.links : [])
          .map(l => ({ url: String((l && (l.url || l.href)) || '').trim(), label: String((l && (l.label || l.name)) || '').trim() }))
          .filter(l => /^https?:\/\//i.test(l.url));
        return (
          <div key={n.id || i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem 1.1rem' }}>
            {who && <div style={{ fontSize: '.7rem', fontWeight: 600, color: C.blue, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.35rem' }}>{who}</div>}
            {t && (
              /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
              <div className="rich-message" style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: b ? '.35rem' : 0 }} dangerouslySetInnerHTML={{ __html: formatRichMessage(t) }} />
            )}
            {b && (
              /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
              <div className="rich-message" style={{ fontSize: '.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: formatRichMessage(b) }} />
            )}
            {imgs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.55rem' }}>
                {imgs.map(u => (
                  <a key={u} className="attachment-img-link" href={u} target="_blank" rel="noopener noreferrer">
                    <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }} />
                  </a>
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.55rem' }}>
                {links.map((link, li) => (
                  <a
                    key={li}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.url}
                    style={{ fontSize: '.78rem', padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.paper, color: C.blue, textDecoration: 'none' }}
                  >
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Demo feedback modal (in-memory only) ───────────────────────────────────────
function DemoFeedbackModal({ onClose, onSubmit }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const submit = () => {
    const sub = subject.trim();
    const msg = body.trim();
    if (!sub || !msg) return;
    onSubmit({
      id: 'df-' + Date.now(),
      subject: sub.slice(0, 500),
      body: msg.slice(0, 12000),
      submittedAtMs: Date.now(),
    });
    onClose();
  };

  const field = { width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '.55rem .75rem', fontFamily: 'inherit', fontSize: '.85rem', background: C.paper, color: C.ink, outline: 'none', boxSizing: 'border-box' };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div role="dialog" aria-modal="true" aria-label="Dashboard feedback" style={{ background: C.card, borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 460, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '.4rem' }}>Dashboard feedback</div>
        <p style={{ margin: '0 0 1rem', fontSize: '.8rem', color: C.muted, lineHeight: 1.45 }}>
          Send a private note to the team. Nothing opens on your device, no email address is collected, and you will not get a reply.
        </p>
        <div style={{ marginBottom: '.75rem' }}>
          <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, marginBottom: '.3rem' }}>Subject</label>
          <input type="text" maxLength={500} placeholder="Short summary" autoComplete="off" value={subject} autoFocus onChange={e => setSubject(e.target.value)} style={field} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 600, marginBottom: '.3rem' }}>Message</label>
          <textarea rows={5} maxLength={12000} placeholder="Improvements, bugs, or ideas…" value={body} onChange={e => setBody(e.target.value)} style={{ ...field, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          <button onClick={onClose} style={{ padding: '.5rem 1rem', border: `1.5px solid ${C.border}`, borderRadius: 8, background: C.card, fontFamily: 'inherit', fontSize: '.83rem', cursor: 'pointer', color: C.muted }}>Cancel</button>
          <button onClick={submit} style={{ padding: '.5rem 1.1rem', border: 'none', borderRadius: 8, background: C.blue, color: '#fff', fontFamily: 'inherit', fontSize: '.83rem', fontWeight: 600, cursor: 'pointer' }}>Send feedback</button>
        </div>
      </div>
    </div>
  );
}
