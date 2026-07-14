/**
 * Dashboard — the main two-panel layout after login.
 * Manages:
 * - Top bar (name, demo badge, copy code, sign out)
 * - Sidebar + main panel layout
 * - Global paste handler for answer box images
 * - Global escape/keydown handler
 * - Emoji picker layout (vanilla JS observers)
 * - Stats refresh wiring
 * - Session notes hydration when active session changes
 */
import { Component, useEffect, useRef, useState } from 'react';
import { IMAGE_MAX_EDGE, IMAGE_JPEG_QUALITY } from '../../constants/app.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import useInstructorStore, { DEMO_SESSION, DEMO_SESSION_CODE, DEMO_QUESTIONS_TEMPLATE } from '../store/useInstructorStore.js';
import { useInstructorAuth, persistInstructorActiveSession, getDemoHiddenSessionIds, DEMO_SESSIONS_HIDDEN_KEY, myNameForSession, instructorOwnsSession } from '../hooks/useInstructorAuth.js';
import { useSessionStats } from '../hooks/useSessionStats.js';
import { getSessionNotesFromDoc } from '../../lib/sessionNotes.js';
import { extractImageUrlForQuestionPaste } from '../../lib/clipboardImagePaste.js';
import { insertEmoji } from './FormatToolbar.jsx';
import InstructorSidebar from './sidebar/InstructorSidebar.jsx';
import QuestionsList from './QuestionsList.jsx';
import StudentViewOverlay from './StudentViewOverlay.jsx';
import JoinSessionModal from './JoinSessionModal.jsx';
import CreateSessionModal from './CreateSessionModal.jsx';
import DeleteModal from './DeleteModal.jsx';

// ── Emoji picker layout (vanilla JS) ──────────────────────────
function initEmojiPickerLayout() {
  let rafRe = 0;
  function scheduleReposition() {
    cancelAnimationFrame(rafRe);
    rafRe = requestAnimationFrame(() => {
      document.querySelectorAll('details.fmt-emoji-more[open]').forEach(positionPicker);
    });
  }

  function getFmtEmojiGridForDetails(det) {
    if (!det) return null;
    if (det._fmtEmojiShell) return det._fmtEmojiShell.querySelector('.fmt-emoji-grid');
    return det.querySelector('.fmt-emoji-grid');
  }

  function positionPicker(det) {
    if (!det || !det.open) return;
    const grid = getFmtEmojiGridForDetails(det);
    const sum = det.querySelector('summary');
    if (!grid || !sum) return;
    const shell = grid.closest('.fmt-emoji-grid-shell');
    const dock = shell || grid;

    const rect = sum.getBoundingClientRect();
    const gap = 8, vwPad = 8;
    const vh = window.innerHeight, vw = window.innerWidth;
    const belowSlice = vh - rect.bottom - gap - vwPad;
    const aboveSlice = rect.top - gap - vwPad;
    const panelMax = Math.min(480, vh * 0.62);
    const preferBelow = belowSlice >= Math.min(panelMax, 220) || (belowSlice >= aboveSlice && belowSlice >= 100);
    const w = Math.min(380, vw - vwPad * 2);
    let left = rect.right - w;
    left = Math.max(vwPad, Math.min(left, vw - w - vwPad));
    const preferredH = Math.min(380, panelMax);

    dock.style.position = 'fixed';
    dock.style.left = left + 'px';
    dock.style.right = 'auto';
    dock.style.width = w + 'px';
    dock.style.zIndex = '12000';
    dock.style.margin = '0';

    if (preferBelow) {
      dock.style.top = (rect.bottom + gap) + 'px';
      dock.style.bottom = 'auto';
      dock.style.maxHeight = Math.max(48, Math.min(preferredH, belowSlice)) + 'px';
    } else {
      dock.style.top = 'auto';
      dock.style.bottom = (vh - rect.top + gap) + 'px';
      dock.style.maxHeight = Math.max(48, Math.min(preferredH, aboveSlice)) + 'px';
    }
  }

  function clearDock(det) {
    if (!det) return;
    const grid = getFmtEmojiGridForDetails(det);
    if (!grid) return;
    const shell = grid.closest('.fmt-emoji-grid-shell');
    const dock = shell || grid;
    ['position','top','right','bottom','left','width','maxHeight','zIndex','margin'].forEach(p => {
      try { dock.style.removeProperty(p); } catch (e) {}
    });
  }

  // Keyword filter over a shell's grid cells (matches data-search on each cell).
  function filterShell(shell, q) {
    if (!shell) return;
    const grid = shell.querySelector('.fmt-emoji-grid');
    const empty = shell.querySelector('.fmt-emoji-empty');
    if (!grid) return;
    const raw = String(q || '').trim();
    const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    grid.querySelectorAll('.fmt-emoji-picker-cell').forEach(cell => {
      let show = true;
      if (terms.length) {
        const text = cell.getAttribute('data-search') || '';
        show = terms.every(term => text.includes(term));
      }
      cell.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });
    if (empty) {
      empty.textContent = raw ? `No emoji match “${raw}”` : 'No emoji match';
      empty.classList.toggle('is-hidden', visible > 0);
    }
    shell.classList.toggle('is-search-empty', visible === 0);
    grid.scrollTop = 0;
  }

  document.addEventListener('toggle', (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('details.fmt-emoji-more')) return;
    if (!t.open) {
      clearDock(t);
      return;
    }
    requestAnimationFrame(() => {
      // Move shell to body for proper z-index stacking
      const grid = t.querySelector('.fmt-emoji-grid');
      if (grid) {
        let shell = grid.closest('.fmt-emoji-grid-shell');
        if (!shell) {
          shell = grid.parentNode;
        }
        if (shell && shell.parentNode !== document.body) {
          if (!t._fmtEmojiShell) {
            t._fmtEmojiShell = shell;
            shell._fmtEmojiDetails = t;
          }
          document.body.appendChild(shell);
        }
      }
      positionPicker(t);
      // Reset the search and focus it so instructors can just start typing.
      const shell2 = t._fmtEmojiShell || (grid && grid.closest('.fmt-emoji-grid-shell'));
      if (shell2) {
        const input = shell2.querySelector('.fmt-emoji-search-input');
        if (input) input.value = '';
        filterShell(shell2, '');
        if (input) { try { input.focus({ preventScroll: true }); } catch (err) {} }
      }
    });
  }, true);

  // Cells are moved to document.body (outside React's tree), so their clicks are
  // handled here rather than via React onClick.
  document.addEventListener('click', (e) => {
    const cell = e.target && e.target.closest && e.target.closest('.fmt-emoji-picker-cell[data-emoji-target]');
    if (!cell) return;
    e.preventDefault();
    const tid = cell.getAttribute('data-emoji-target');
    const ch = cell.getAttribute('data-ch');
    if (tid && ch) insertEmoji(tid, ch);
    const shell = cell.closest('.fmt-emoji-grid-shell');
    const det = shell && shell._fmtEmojiDetails;
    if (det) det.open = false;
  });

  // Live filter as the instructor types in a picker's search field.
  document.addEventListener('input', (e) => {
    const input = e.target;
    if (!input || !input.classList || !input.classList.contains('fmt-emoji-search-input')) return;
    const shell = input.closest('.fmt-emoji-grid-shell');
    filterShell(shell, input.value);
    scheduleReposition();
  });

  // Enter inserts the first match; Esc clears the query before closing.
  document.addEventListener('keydown', (e) => {
    const input = e.target;
    if (!input || !input.classList || !input.classList.contains('fmt-emoji-search-input')) return;
    const shell = input.closest('.fmt-emoji-grid-shell');
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = shell && shell.querySelector('.fmt-emoji-picker-cell:not(.is-hidden)');
      if (first) first.click();
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      filterShell(shell, '');
    }
  }, true);

  const cap = { passive: true, capture: true };
  window.addEventListener('scroll', scheduleReposition, cap);
  document.addEventListener('scroll', scheduleReposition, cap);
  window.addEventListener('resize', scheduleReposition);
}

// ── Image paste helpers ────────────────────────────────────────
function collectImageFilesFromPaste(ev) {
  const out = [];
  const cd = ev.clipboardData;
  if (!cd) return out;
  if (cd.items) {
    for (let i = 0; i < cd.items.length; i++) {
      if (cd.items[i].type && cd.items[i].type.indexOf('image') === 0) {
        const f = cd.items[i].getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (!out.length && cd.files && cd.files.length) {
    for (let j = 0; j < cd.files.length; j++) {
      if (cd.files[j].type && cd.files[j].type.indexOf('image') === 0) out.push(cd.files[j]);
    }
  }
  return out;
}

function resizeImageToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const w = img.width, h = img.height;
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(w, h, 1));
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      c.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('encode')); }, 'image/jpeg', IMAGE_JPEG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('img')); };
    img.src = u;
  });
}

// ── Error boundary — catches render errors and shows the message ─
class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[DashboardErrorBoundary] render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#c00', background: '#fff8f8', border: '2px solid #c00', borderRadius: 8, margin: '2rem', maxWidth: 800 }}>
          <strong>Dashboard render error (click a session):</strong>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.85rem' }}>
            {String(this.state.error)}
            {'\n\n'}
            {this.state.error.stack || ''}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '1rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
          >
            Dismiss (try again)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Dashboard component ────────────────────────────────────────
function DashboardInner() {
  const { db, storage } = useFirebase();
  const { logout, setGlobalDisplayName, renameInSession } = useInstructorAuth();
  const { updateStats, cancelPending, runRefresh } = useSessionStats();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const instructorOwnerId = useInstructorStore(s => s.instructorOwnerId);
  const instructorLegacyOwnerId = useInstructorStore(s => s.instructorLegacyOwnerId);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const studentViewOpen = useInstructorStore(s => s.studentViewOpen);
  const setStudentViewOpen = useInstructorStore(s => s.setStudentViewOpen);
  const toast = useInstructorStore(s => s.toast);
  const showToast = useInstructorStore(s => s.showToast);
  const questionPages = useInstructorStore(s => s.questionPages);
  const setSessionNotesDraft = useInstructorStore(s => s.setSessionNotesDraft);
  const setSessionNoteShow = useInstructorStore(s => s.setSessionNoteShow);
  const setPendingAnswerImages = useInstructorStore(s => s.setPendingAnswerImages);
  const pendingAnswerImages = useInstructorStore(s => s.pendingAnswerImages);
  const closeDeleteModal = useInstructorStore(s => s.closeDeleteModal);
  const setJoinSessionModalOpen = useInstructorStore(s => s.setJoinSessionModalOpen);
  const setCreateSessionModalOpen = useInstructorStore(s => s.setCreateSessionModalOpen);

  const emojiInitRef = useRef(false);

  // Init emoji picker layout once
  useEffect(() => {
    if (emojiInitRef.current) return;
    emojiInitRef.current = true;
    initEmojiPickerLayout();

    // Close emoji pickers on outside click
    const closePickersIfOutside = (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      document.querySelectorAll('details.fmt-emoji-more[open]').forEach((d) => {
        if (d.contains(t)) return;
        const shell = d._fmtEmojiShell;
        if (shell && shell.contains(t)) return;
        d.open = false;
      });
    };
    document.addEventListener('pointerdown', closePickersIfOutside, true);
    document.addEventListener('touchstart', closePickersIfOutside, { capture: true, passive: true });
  }, []);

  // Global escape handler
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // Close emoji pickers
      document.querySelectorAll('details.fmt-emoji-more[open]').forEach(d => { d.open = false; });
      // Close modals
      closeDeleteModal();
      setJoinSessionModalOpen(false);
      setCreateSessionModalOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDeleteModal, setJoinSessionModalOpen, setCreateSessionModalOpen]);

  // Global paste handler for answer boxes
  useEffect(() => {
    const onPaste = async (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains('answer-box')) return;
      const files = collectImageFilesFromPaste(e);
      const clipUrl = extractImageUrlForQuestionPaste(e, files.length > 0);
      if (!files.length && !clipUrl) return;

      const state = useInstructorStore.getState();
      if (state.isDemoMode) {
        e.preventDefault();
        showToast('Image paste: use a live session (demo has no Storage).');
        return;
      }
      if (!state.activeSessionCode) return;

      if (!storage) {
        e.preventDefault();
        const qid0 = t.id.replace(/^ans-/, '');
        if (clipUrl && qid0) {
          const current = state.pendingAnswerImages[qid0] || [];
          setPendingAnswerImages(qid0, [...current, clipUrl]);
          showToast('Image link added (Storage not enabled—uses the hosted URL).');
          return;
        }
        showToast('Image files need Firebase Storage. Paste an https:// image link instead, or enable Storage.');
        return;
      }

      e.preventDefault();
      const qid = t.id.replace(/^ans-/, '');
      if (!qid) return;

      const uploadImage = async (blob) => {
        const path = `sessions/${state.activeSessionCode}/answer_paste/${qid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const snap = await storage.ref(path).put(blob, { contentType: 'image/jpeg' });
        return snap.ref.getDownloadURL();
      };

      if (files.length) {
        for (const file of files) {
          try {
            showToast('Uploading image…');
            const blob = await resizeImageToJpeg(file);
            const url = await uploadImage(blob);
            const current = useInstructorStore.getState().pendingAnswerImages[qid] || [];
            setPendingAnswerImages(qid, [...current, url]);
            showToast('Image attached to this answer.');
          } catch (err) {
            console.warn(err);
            showToast('Upload failed. Enable Storage + rules in Firebase (SETUP.md).');
          }
        }
        return;
      }

      if (clipUrl) {
        const current0 = useInstructorStore.getState().pendingAnswerImages[qid] || [];
        setPendingAnswerImages(qid, [...current0, clipUrl]);
        showToast('Uploading image…');
        try {
          const r = await fetch(clipUrl, { mode: 'cors' });
          if (!r.ok) throw new Error('Could not download image.');
          const blob0 = await r.blob();
          const jpeg = await resizeImageToJpeg(blob0);
          const url2 = await uploadImage(jpeg);
          const current2 = useInstructorStore.getState().pendingAnswerImages[qid] || [];
          const idx = current2.lastIndexOf(clipUrl);
          const updated = [...current2];
          if (idx >= 0) updated[idx] = url2;
          else updated.push(url2);
          setPendingAnswerImages(qid, updated);
          showToast('Image attached to this answer.');
        } catch (err) {
          console.warn(err);
          showToast('Using image link (download or upload was blocked). Save to keep the URL.');
        }
      }
    };

    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [storage, showToast, setPendingAnswerImages]);

  // When active session changes: hydrate session notes draft
  useEffect(() => {
    if (!activeSessionCode) return;
    const s = allSessions.find(x => x.id === activeSessionCode);
    if (!s) return;
    const arr = getSessionNotesFromDoc(s);
    // Preserve the instructor's manual expand/collapse per note across re-hydrations
    // (e.g. after Save, which updates allSessions). Only fall back to the default
    // (collapse all but the last) for notes not already in the current draft — i.e.
    // when switching to a different session.
    const prevDraft = useInstructorStore.getState().sessionNotesDraft;
    const prevCollapse = new Map(prevDraft.map(n => [n.id, n.editorCollapsed]));
    setSessionNotesDraft(arr.map((n, i) => ({
      ...n,
      imageUrls: [...(n.imageUrls || [])],
      links: (n.links || []).map(l => ({ url: l.url, label: l.label || '' })),
      editorCollapsed: prevCollapse.has(n.id)
        ? prevCollapse.get(n.id)
        : (arr.length > 1 ? i !== arr.length - 1 : false),
    })));
    setSessionNoteShow(s.sessionNoteShow !== false);
  }, [activeSessionCode, allSessions]);

  // Trigger stats refresh when questions change
  useEffect(() => {
    updateStats();
    return () => cancelPending();
  }, [questionPages, activeSessionCode]);

  // Handle reset demo
  const handleResetDemo = () => {
    try {
      sessionStorage.removeItem(DEMO_SESSIONS_HIDDEN_KEY);
    } catch (e) {}
    const qs = DEMO_QUESTIONS_TEMPLATE.map(q => ({ ...q, voters: [...q.voters] }));
    useInstructorStore.setState({
      questionPages: [{ questions: qs, endSnap: null }],
      currentPage: 0,
      allQuestions: qs,
      instructorOlderBeyondLoadExhausted: true,
      allSessions: [DEMO_SESSION],
      activeSessionCode: DEMO_SESSION_CODE,
      searchQuery: '',
    });
    persistInstructorActiveSession(DEMO_SESSION_CODE);
    showToast('Demo data reset!');
  };

  const copyCode = () => {
    if (!activeSessionCode) return;
    navigator.clipboard.writeText(activeSessionCode).then(() => showToast('Code copied!'));
  };

  // Full sign-out: clear the in-app session, then (when embedded behind the OAuth
  // gateway) navigate the TOP window to the gateway logout so the Google/app session
  // cookie is destroyed and the user lands back on /login.
  const handleSignOut = () => {
    logout();
    let logoutUrl = '';
    try {
      logoutUrl = (new URLSearchParams(window.location.search).get('sso_logout') || '').trim();
    } catch (e) { logoutUrl = ''; }
    if (logoutUrl) {
      try {
        window.top.location.href = logoutUrl;
        return;
      } catch (e) {
        window.location.href = logoutUrl;
        return;
      }
    }
  };

  // Names are per-session: when a session you own is active, the top-bar name is
  // that session's name; otherwise it's your default (used for new sessions).
  const activeSession = allSessions.find(s => s.id === activeSessionCode);
  const ownsActive = instructorOwnsSession(activeSession, instructorOwnerId, instructorLegacyOwnerId);
  const nameIsSessionScoped = !!activeSession && ownsActive;
  const displayNameShown = myNameForSession(activeSession, currentInstructor, instructorOwnerId, instructorLegacyOwnerId);

  const startEditName = () => {
    setNameDraft(displayNameShown || '');
    setEditingName(true);
  };
  const saveEditName = async () => {
    if (savingName) return;
    const draft = nameDraft.trim();
    if (!draft) { showToast('Please enter a name.'); return; }
    if (draft === (displayNameShown || '')) { setEditingName(false); return; }
    setSavingName(true);
    if (nameIsSessionScoped) {
      showToast('Updating your name for this session…');
      const err = await renameInSession(activeSession.id, draft);
      setSavingName(false);
      if (err) { showToast(err); return; }
      setEditingName(false);
      showToast('Name updated for this session.');
    } else {
      const err = setGlobalDisplayName(draft);
      setSavingName(false);
      if (err) { showToast(err); return; }
      setEditingName(false);
      showToast('Default name updated (used for new sessions).');
    }
  };

  return (
    <>
      <div id="app-screen" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Top bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <div className="top-bar-logo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span className="top-bar-name">Session Q&amp;A</span>
            <span className="instructor-badge">Instructor</span>
            {editingName ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  className="mini-input"
                  type="text"
                  aria-label="Your display name"
                  value={nameDraft}
                  autoFocus
                  disabled={savingName}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEditName();
                    if (e.key === 'Escape' && !savingName) setEditingName(false);
                  }}
                  style={{ width: 160, padding: '0.2rem 0.45rem', fontSize: '0.82rem' }}
                />
                <button className="top-btn" onClick={saveEditName} disabled={savingName}>
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                <button className="top-btn" onClick={() => setEditingName(false)} disabled={savingName}>Cancel</button>
              </span>
            ) : (
              <span
                id="instructor-name-bar"
                onClick={isDemoMode ? undefined : startEditName}
                title={isDemoMode
                  ? undefined
                  : (nameIsSessionScoped
                    ? 'Click to change the name students see in this session'
                    : 'Click to change your default name (used for new sessions)')}
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: isDemoMode ? 'default' : 'pointer',
                }}
              >
                {displayNameShown || 'Instructor'}
                {!isDemoMode && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6 }}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                )}
              </span>
            )}
            {isDemoMode && (
              <span id="demo-badge" style={{ display: 'inline-flex', fontSize: '0.72rem', fontWeight: 500, padding: '2px 10px', borderRadius: 20, background: '#fff3e0', color: '#e65100' }}>
                Demo mode
              </span>
            )}
          </div>
          <div className="top-bar-right">
            {isDemoMode && (
              <button
                id="reset-demo-btn"
                onClick={handleResetDemo}
                style={{ fontSize: '0.82rem', color: '#e65100', background: 'none', border: '1.5px solid #e65100', padding: '0.25rem 0.8rem', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = '#fff3e0'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ↺ Reset demo
              </button>
            )}
            {(isDemoMode || activeSessionCode) && (
              <button
                id="student-view-btn"
                onClick={() => setStudentViewOpen(!studentViewOpen)}
                style={{
                  fontSize: '0.82rem', color: '#6a0dad', background: studentViewOpen ? '#f3e8ff' : 'none',
                  border: '1.5px solid #6a0dad', padding: '0.25rem 0.8rem', borderRadius: 6,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                👁 Student view
              </button>
            )}
            {activeSessionCode && (
              <span
                id="active-code"
                className="code-badge"
                title="Click to copy session code"
                onClick={copyCode}
                style={{ cursor: 'pointer' }}
                aria-hidden="false"
              >
                {activeSessionCode}
              </span>
            )}
            <button className="top-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        {/* App body: sidebar + main panel */}
        <div className="app-body" id="instr-app-body" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <InstructorSidebar />

          {/* Resizer */}
          <div
            className="instr-sidebar-resizer"
            id="instr-sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize instructor sidebar. Double-click to hide or show."
            title="Drag left or right to resize. Double-click to hide or show the sidebar."
          >
            <div className="instr-sidebar-resizer-track" id="instr-sidebar-resizer-track" aria-hidden="true"></div>
          </div>

          <QuestionsList />
        </div>
      </div>

      {/* Overlays */}
      <StudentViewOverlay />
      <JoinSessionModal />
      <CreateSessionModal />
      <DeleteModal />

      {/* Toast — always rendered so the CSS slide-up transition fires */}
      <div className={`toast${toast.visible ? ' show' : ''}`} role="status" aria-live="polite">
        {toast.message}
      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <DashboardErrorBoundary>
      <DashboardInner />
    </DashboardErrorBoundary>
  );
}
