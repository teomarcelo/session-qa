/**
 * StudentViewOverlay — full-screen overlay showing the student app view.
 *
 * Live session: renders student.html in an iframe (fully isolated, correct CSS,
 * auto-joins via ?code=SQA-XXXX URL param supported by useStudentSession).
 *
 * Demo mode: renders the demo preview panel expanded to full width
 * (no Firestore, uses store questions directly).
 *
 * safe: user content is HTML-escaped by esc() inside formatRichMessage
 */
import { useState } from 'react';
import { formatRichMessage } from '../../lib/richText.js';
import { htmlAnsweredStatusBadges } from '../../lib/answeredBadge.js';
import useInstructorStore from '../store/useInstructorStore.js';

const SDEMO_USER_ID = 'demo-student-overlay';

export default function StudentViewOverlay() {
  const studentViewOpen = useInstructorStore(s => s.studentViewOpen);
  const setStudentViewOpen = useInstructorStore(s => s.setStudentViewOpen);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
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
        background: '#f7f6f3',
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

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isDemoMode ? (
          <DemoStudentView activeSession={activeSession} />
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

// ── Demo mode full-screen preview ─────────────────────────────────────────────
function DemoStudentView({ activeSession }) {
  const allQuestions = useInstructorStore(s => s.allQuestions);
  const sdemoFilter = useInstructorStore(s => s.sdemoFilter);
  const setSdemoFilter = useInstructorStore(s => s.setSdemoFilter);
  const prependQuestion = useInstructorStore(s => s.prependQuestion);
  const updateQuestionInPages = useInstructorStore(s => s.updateQuestionInPages);
  const showToast = useInstructorStore(s => s.showToast);

  const [demoText, setDemoText] = useState('');
  const [demoName, setDemoName] = useState('Demo Student');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [voters, setVoters] = useState(new Set());

  const filtered = allQuestions.filter(q => {
    if (sdemoFilter === 'pinned') return q.pinned;
    if (sdemoFilter === 'answered') return q.status === 'answered';
    if (sdemoFilter === 'unanswered') return q.status !== 'answered';
    return true;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const at = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const bt = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return bt - at;
  });

  const totalQ = allQuestions.length;
  const answeredQ = allQuestions.filter(q => q.status === 'answered').length;
  const pendingQ = allQuestions.filter(q => q.status !== 'answered').length;

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
    showToast('Student question submitted!');
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f7f6f3' }}>
      {/* Student top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2ddd6', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#0070d2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: '.95rem' }}>Session Q&amp;A</span>
          {activeSession && (
            <span style={{ fontSize: '.8rem', color: '#7a7570' }}>— {activeSession.sessionName}</span>
          )}
        </div>
        <span style={{ fontSize: '.78rem', color: '#b0aba4', background: '#f7f6f3', padding: '3px 10px', borderRadius: 20, border: '1px solid #e2ddd6' }}>
          SQA-DEMO
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Ask box */}
          <div style={{ background: '#fff', border: '1px solid #e2ddd6', borderRadius: 12, padding: '1.1rem 1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: '.6rem' }}>Ask a question</div>
            <textarea
              placeholder="What's on your mind? You can also paste a screenshot."
              value={demoText}
              onChange={e => setDemoText(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e2ddd6', borderRadius: 8, padding: '.65rem .85rem', fontFamily: 'inherit', fontSize: '.88rem', resize: 'none', height: 80, background: '#f7f6f3', color: '#1a1814', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = '#0070d2'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#e2ddd6'; e.target.style.background = '#f7f6f3'; }}
            />
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '.6rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={demoName}
                onChange={e => setDemoName(e.target.value)}
                style={{ flex: 1, padding: '.5rem .75rem', border: '1.5px solid #e2ddd6', borderRadius: 8, fontFamily: 'inherit', fontSize: '.83rem', background: '#f7f6f3', color: '#1a1814', outline: 'none' }}
              />
              <button
                onClick={handleSubmit}
                style={{ padding: '.5rem 1.25rem', background: '#0070d2', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.83rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Submit
              </button>
            </div>
            <div style={{ marginTop: '.55rem', fontSize: '.75rem', color: '#b0aba4' }}>
              💡 In a real session, students can paste screenshots directly into this box to attach images to their question.
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            {filterBtns.map(f => (
              <button
                key={f.key}
                onClick={() => setSdemoFilter(f.key)}
                style={{
                  padding: '4px 14px',
                  border: `1.5px solid ${sdemoFilter === f.key ? '#0070d2' : '#e2ddd6'}`,
                  borderRadius: 20,
                  background: sdemoFilter === f.key ? '#e8f2fc' : '#fff',
                  fontFamily: 'inherit',
                  fontSize: '.8rem',
                  color: sdemoFilter === f.key ? '#0070d2' : '#7a7570',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#b0aba4', alignSelf: 'center' }}>
              {totalQ} questions · {answeredQ} answered · {pendingQ} pending
            </span>
          </div>

          {/* Question cards */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#b0aba4', fontSize: '.9rem' }}>
              No questions here yet.
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
                    background: q.pinned ? '#faf5ff' : '#fff',
                    border: `1px solid ${q.pinned ? '#c084fc' : '#e2ddd6'}`,
                    borderRadius: 12,
                    padding: '1rem 1.1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.78rem', fontWeight: 500, color: '#7a7570' }}>{q.authorName || 'Anonymous'}</span>
                      {q.pinned && (
                        <span style={{ fontSize: '.67rem', fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#f3e8ff', color: '#6a0dad' }}>Pinned</span>
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
                        style={{ fontSize: '.74rem', color: '#b0aba4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }}
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
                        style={{ width: '100%', border: '1.5px solid #0070d2', borderRadius: 6, padding: '.5rem .7rem', fontFamily: 'inherit', fontSize: '.9rem', resize: 'vertical', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '.4rem', marginTop: '.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: '3px 12px', border: '1.5px solid #e2ddd6', borderRadius: 6, fontFamily: 'inherit', fontSize: '.8rem', cursor: 'pointer', background: 'none' }}>Cancel</button>
                        <button onClick={() => saveEdit(q.id)} style={{ padding: '3px 12px', background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: '.8rem', cursor: 'pointer' }}>Save</button>
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

                  {/* Attached images */}
                  {imgUrls.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.55rem' }}>
                      {imgUrls.map(u => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                          <img
                            src={u}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #e2ddd6', display: 'block' }}
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Answers */}
                  {answers.map((a, i) => (
                    <div key={i} style={{ background: '#e8f2fc', borderLeft: '3px solid #0070d2', borderRadius: '0 8px 8px 0', padding: '.55rem .85rem', marginTop: '.4rem' }}>
                      <div style={{ fontSize: '.67rem', fontWeight: 600, color: '#0070d2', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>{a.instructor || 'Instructor'}</div>
                      {/* safe: user content is HTML-escaped by esc() inside formatRichMessage */}
                      <div
                        className="rich-message"
                        style={{ fontSize: '.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: formatRichMessage(a.text || '') }}
                      />
                    </div>
                  ))}

                  <div style={{ marginTop: '.5rem' }}>
                    <button
                      onClick={() => handleUpvote(q.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 11px',
                        border: `1.5px solid ${voted ? '#0070d2' : '#e2ddd6'}`,
                        borderRadius: 20,
                        background: voted ? '#e8f2fc' : 'none',
                        fontFamily: 'inherit',
                        fontSize: '.78rem',
                        color: voted ? '#0070d2' : '#7a7570',
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
      </div>
    </div>
  );
}
