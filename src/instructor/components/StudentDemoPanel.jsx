/**
 * StudentDemoPanel — slide-in panel showing a preview of the student view.
 * Preview only — no Firestore writes. Uses allQuestions from the store.
 * safe: user content is HTML-escaped by esc() inside formatRichMessage
 */
import { useState, useRef } from 'react';
import { formatRichMessage } from '../../lib/richText.js';
import { htmlAnsweredStatusBadges } from '../../lib/answeredBadge.js';
import useInstructorStore from '../store/useInstructorStore.js';
import { insertSlackFormat, insertEmoji } from './FormatToolbar.jsx';

const SDEMO_USER_ID = 'demo-student-' + Math.random().toString(36).slice(2, 8);

export default function StudentDemoPanel() {
  const studentViewOpen = useInstructorStore(s => s.studentViewOpen);
  const setStudentViewOpen = useInstructorStore(s => s.setStudentViewOpen);
  const sdemoFilter = useInstructorStore(s => s.sdemoFilter);
  const setSdemoFilter = useInstructorStore(s => s.setSdemoFilter);
  const allQuestions = useInstructorStore(s => s.allQuestions);
  const allSessions = useInstructorStore(s => s.allSessions);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const prependQuestion = useInstructorStore(s => s.prependQuestion);
  const updateQuestionInPages = useInstructorStore(s => s.updateQuestionInPages);
  const showToast = useInstructorStore(s => s.showToast);

  const [demoText, setDemoText] = useState('');
  const [demoName, setDemoName] = useState('Demo Student');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [voters, setVoters] = useState(new Set()); // track local upvotes

  const activeSession = allSessions.find(s => s.id === activeSessionCode);

  if (!studentViewOpen) return null;

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
    const newQ = {
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
    };
    prependQuestion(newQ);
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

  const handleEdit = (q) => {
    setEditingId(q.id);
    setEditText(q.text);
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
    <div
      id="student-demo-panel"
      style={{
        display: 'block',
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setStudentViewOpen(false); }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 520,
        background: '#f7f6f3', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.25s cubic-bezier(.4,0,.2,1)',
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2ddd6', padding: '0 1.25rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, background: '#6a0dad', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span style={{ fontSize: '.88rem', fontWeight: 500 }}>Student view</span>
            <span style={{ background: '#f3e8ff', color: '#6a0dad', fontSize: '.68rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>Demo preview</span>
          </div>
          <button onClick={() => setStudentViewOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#7a7570', lineHeight: 1 }}>×</button>
        </div>

        {/* Session info */}
        {activeSession && (
          <div style={{ background: '#fff', borderBottom: '1px solid #e2ddd6', padding: '.9rem 1.25rem', flexShrink: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '.95rem', letterSpacing: '-.02em', marginBottom: '.4rem' }}>
              {activeSession.sessionName || 'Session'}
            </div>
            {activeSession.room && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.78rem', color: '#7a7570', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {activeSession.room}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Ask box */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2ddd6', padding: '.9rem 1.25rem', flexShrink: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '.85rem', marginBottom: '.45rem' }}>Ask a question</div>
          <textarea
            id="sdemo-q-text"
            placeholder="What's on your mind?"
            value={demoText}
            onChange={e => setDemoText(e.target.value)}
            style={{ width: '100%', border: '1.5px solid #e2ddd6', borderRadius: 8, padding: '.6rem .8rem', fontFamily: 'inherit', fontSize: '.85rem', resize: 'none', height: 70, background: '#f7f6f3', color: '#1a1814', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => { e.target.style.borderColor = '#0070d2'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#e2ddd6'; e.target.style.background = '#f7f6f3'; }}
          />
          <div style={{ display: 'flex', gap: '.6rem', marginTop: '.5rem' }}>
            <input
              type="text"
              id="sdemo-name"
              placeholder="Your name (optional)"
              value={demoName}
              onChange={e => setDemoName(e.target.value)}
              style={{ flex: 1, padding: '.5rem .7rem', border: '1.5px solid #e2ddd6', borderRadius: 8, fontFamily: 'inherit', fontSize: '.82rem', background: '#f7f6f3', color: '#1a1814', outline: 'none' }}
            />
            <button onClick={handleSubmit} style={{ padding: '.5rem 1.1rem', background: '#0070d2', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 500, cursor: 'pointer' }}>Submit</button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '.4rem', padding: '.65rem 1.25rem', background: '#fff', borderBottom: '1px solid #e2ddd6', flexShrink: 0 }}>
          {filterBtns.map(f => (
            <button
              key={f.key}
              className={`sdemo-filter${sdemoFilter === f.key ? ' active' : ''}`}
              data-f={f.key}
              onClick={() => setSdemoFilter(f.key)}
              style={{
                padding: '3px 11px',
                border: `1.5px solid ${sdemoFilter === f.key ? '#0070d2' : '#e2ddd6'}`,
                borderRadius: 20,
                background: sdemoFilter === f.key ? '#e8f2fc' : '#fff',
                fontFamily: 'inherit',
                fontSize: '.75rem',
                color: sdemoFilter === f.key ? '#0070d2' : '#7a7570',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Questions feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#b0aba4', fontSize: '.88rem' }}>No questions here yet.</div>
          ) : (
            filtered.map(q => {
              const mine = q.authorId === SDEMO_USER_ID;
              const voted = voters.has(q.id);
              const answers = q.answers && q.answers.length ? q.answers : (q.answer ? [{ instructor: 'Instructor', text: q.answer }] : []);
              return (
                <div
                  key={q.id}
                  style={{
                    background: q.pinned ? '#faf5ff' : '#fff',
                    border: `1px solid ${q.pinned ? '#6a0dad' : '#e2ddd6'}`,
                    borderRadius: 10,
                    padding: '.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.75rem', fontWeight: 500, color: '#7a7570' }}>{q.authorName || 'Anonymous'}</span>
                      {q.pinned && <span style={{ fontSize: '.65rem', fontWeight: 500, padding: '2px 6px', borderRadius: 20, background: '#f3e8ff', color: '#6a0dad' }}>Pinned</span>}
                      {q.status === 'answered'
                        /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
                        ? <span dangerouslySetInnerHTML={{ __html: htmlAnsweredStatusBadges(q) }} />
                        : <span style={{ fontSize: '.65rem', fontWeight: 500, padding: '2px 6px', borderRadius: 20, background: '#fff3e0', color: '#e65100' }}>Pending</span>
                      }
                    </div>
                    {mine && editingId !== q.id && (
                      <button onClick={() => handleEdit(q)} style={{ fontSize: '.72rem', color: '#b0aba4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }}>Edit</button>
                    )}
                  </div>

                  {editingId === q.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{ width: '100%', border: '1.5px solid #0070d2', borderRadius: 6, padding: '.5rem .7rem', fontFamily: 'inherit', fontSize: '.88rem', resize: 'vertical', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '.4rem', marginTop: '.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: '3px 10px', border: '1.5px solid #e2ddd6', borderRadius: 6, fontFamily: 'inherit', fontSize: '.78rem', cursor: 'pointer', background: 'none' }}>Cancel</button>
                        <button onClick={() => saveEdit(q.id)} style={{ padding: '3px 10px', background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: '.78rem', cursor: 'pointer' }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    /* safe: user content is HTML-escaped by esc() inside formatRichMessage */
                    <div
                      className="rich-message"
                      id={`sdemo-text-${q.id}`}
                      style={{ fontSize: '.88rem', lineHeight: 1.55, marginBottom: '.45rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: formatRichMessage(q.text || '') }}
                    />
                  )}

                  {answers.map((a, i) => (
                    <div key={i} style={{ background: '#e8f2fc', borderLeft: '3px solid #0070d2', borderRadius: '0 6px 6px 0', padding: '.5rem .75rem', marginTop: '.4rem' }}>
                      <div style={{ fontSize: '.65rem', fontWeight: 600, color: '#0070d2', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>{a.instructor || 'Instructor'}</div>
                      {/* safe: user content is HTML-escaped by esc() inside formatRichMessage */}
                      <div className="rich-message" style={{ fontSize: '.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: formatRichMessage(a.text || '') }} />
                    </div>
                  ))}

                  <div style={{ marginTop: '.45rem' }}>
                    <button
                      onClick={() => handleUpvote(q.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px',
                        border: `1.5px solid ${voted ? '#0070d2' : '#e2ddd6'}`,
                        borderRadius: 20,
                        background: voted ? '#e8f2fc' : 'none',
                        fontFamily: 'inherit',
                        fontSize: '.75rem',
                        color: voted ? '#0070d2' : '#7a7570',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      {q.votes || 0}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Stats bar */}
        <div style={{ background: '#fff', borderTop: '1px solid #e2ddd6', padding: '.6rem 1.25rem', display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '.75rem', color: '#7a7570' }}>Total: <strong id="sdemo-stat-total" style={{ color: '#1a1814' }}>{totalQ}</strong></span>
          <span style={{ fontSize: '.75rem', color: '#7a7570' }}>Answered: <strong id="sdemo-stat-ans" style={{ color: '#2e7d32' }}>{answeredQ}</strong></span>
          <span style={{ fontSize: '.75rem', color: '#7a7570' }}>Pending: <strong id="sdemo-stat-pen" style={{ color: '#e65100' }}>{pendingQ}</strong></span>
        </div>
      </div>
    </div>
  );
}
