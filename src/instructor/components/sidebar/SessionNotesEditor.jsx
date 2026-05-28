/**
 * SessionNotesEditor — instructor notes shown to students on the student board.
 * Draft stored in Zustand (sessionNotesDraft). Save writes to Firestore.
 * Drag-to-reorder uses HTML5 DnD in a useEffect.
 * dangerouslySetInnerHTML is NOT used here — all content is controlled inputs.
 */
import { useEffect, useRef } from 'react';
import firebase from '../../../lib/firebaseCompat.js';
import { useFirebase } from '../../../shared/FirebaseContext.jsx';
import useInstructorStore from '../../store/useInstructorStore.js';
import { SESSION_SIDEBAR_NOTES_MAX, SESSION_NOTE_LINKS_MAX } from '../../../lib/sessionNotes.js';
import FormatToolbar from '../FormatToolbar.jsx';

function newSessionNoteId() {
  return 'sn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function NoteCard({ note, index, onUpdate, onRemove, onToggleCollapse }) {
  const bodyId = `sn-body-${note.id}`;
  const titleId = `sn-title-${note.id}`;

  const updateField = (field, value) => {
    onUpdate({ ...note, [field]: value });
  };

  const updateLink = (i, field, value) => {
    const links = (note.links || []).map((l, idx) => idx === i ? { ...l, [field]: value } : l);
    onUpdate({ ...note, links });
  };

  const addLink = () => {
    if ((note.links || []).length >= SESSION_NOTE_LINKS_MAX) return;
    onUpdate({ ...note, links: [...(note.links || []), { url: '', label: '' }] });
  };

  const removeLink = (i) => {
    onUpdate({ ...note, links: (note.links || []).filter((_, idx) => idx !== i) });
  };

  return (
    <div
      className={`session-note-edit-card${note.editorCollapsed ? ' sn-card-collapsed' : ''}`}
      data-note-id={note.id}
      draggable={false}
    >
      <div className="session-note-edit-card-head">
        <span
          className="sn-drag-handle"
          draggable={true}
          title="Drag to reorder"
          aria-label="Drag to reorder notes"
        >
          ⠿
        </span>
        <button
          type="button"
          className="sn-card-toggle"
          onClick={() => onToggleCollapse(note.id)}
          title="Expand or collapse this note"
          aria-expanded={!note.editorCollapsed}
          aria-label="Expand or collapse note editor"
        >
          <svg
            className="sn-card-toggle-chevron"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <div className="sn-card-head-text">
          <span className="sn-card-preview">{note.title || 'Untitled note'}</span>
          {note.instructor && <span className="sn-card-author">Added by {note.instructor}</span>}
        </div>
        <label className="sn-show-label">
          <input
            type="checkbox"
            className="sn-show"
            checked={note.show !== false}
            onChange={e => updateField('show', e.target.checked)}
          />
          {' '}Show
        </label>
        <button type="button" className="sn-remove-btn" onClick={() => onRemove(note.id)}>Remove</button>
      </div>

      {!note.editorCollapsed && (
        <div className="sn-card-body">
          <div className="form-field">
            <label>Title (optional)</label>
            <input
              className="mini-input sn-title-input"
              type="text"
              id={titleId}
              value={note.title || ''}
              placeholder="e.g. Wi‑Fi, slides"
              onChange={e => updateField('title', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Message</label>
            <FormatToolbar textareaId={bodyId} />
            <textarea
              className="mini-input mini-textarea sn-body-input"
              id={bodyId}
              placeholder="Links, dial-in…"
              value={note.body || ''}
              onChange={e => updateField('body', e.target.value)}
            />
          </div>

          {/* Links */}
          <div className="form-field sn-links-field">
            {(note.links || []).some(l => l.url) && (
              <label className="sn-links-label">Named links (https only)</label>
            )}
            <div className="sn-links-rows">
              {(note.links || []).map((link, i) => (
                <div key={i} className="sn-link-row">
                  <input
                    className="mini-input sn-link-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={link.url || ''}
                    onChange={e => updateLink(i, 'url', e.target.value)}
                  />
                  <input
                    className="mini-input sn-link-label"
                    type="text"
                    placeholder="Display name (optional)"
                    value={link.label || ''}
                    onChange={e => updateLink(i, 'label', e.target.value)}
                  />
                  <button type="button" className="sn-link-remove-btn" title="Remove link" aria-label="Remove link" onClick={() => removeLink(i)}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="add-btn sn-add-link-row-btn" onClick={addLink}>+ Add link</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionNotesEditor() {
  const { db } = useFirebase();
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const setAllSessions = useInstructorStore(s => s.setAllSessions);
  const sessionNotesDraft = useInstructorStore(s => s.sessionNotesDraft);
  const setSessionNotesDraft = useInstructorStore(s => s.setSessionNotesDraft);
  const sessionNoteShow = useInstructorStore(s => s.sessionNoteShow);
  const setSessionNoteShow = useInstructorStore(s => s.setSessionNoteShow);
  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const showToast = useInstructorStore(s => s.showToast);

  const editorRef = useRef(null);

  // Wire HTML5 drag-and-drop for reordering
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let draggingId = null;

    const onDragStart = (e) => {
      const h = e.target.closest('.sn-drag-handle');
      if (!h) return;
      const card = h.closest('.session-note-edit-card');
      if (!card) return;
      draggingId = card.getAttribute('data-note-id');
      e.dataTransfer.setData('text/plain', draggingId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    };

    const onDragEnd = () => {
      editor.querySelectorAll('.session-note-edit-card.is-dragging').forEach(c => c.classList.remove('is-dragging'));
      editor.querySelectorAll('.session-note-edit-card.sn-drag-over').forEach(c => c.classList.remove('sn-drag-over'));
      draggingId = null;
    };

    const onDragOver = (e) => {
      const card = e.target.closest('.session-note-edit-card');
      editor.querySelectorAll('.session-note-edit-card.sn-drag-over').forEach(c => {
        if (c !== card) c.classList.remove('sn-drag-over');
      });
      if (!card || card.classList.contains('is-dragging')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('sn-drag-over');
    };

    const onDrop = (e) => {
      const card = e.target.closest('.session-note-edit-card');
      if (!card) return;
      e.preventDefault();
      card.classList.remove('sn-drag-over');
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = card.getAttribute('data-note-id');
      if (!fromId || !toId || fromId === toId) return;

      // Reorder in store
      const latestDraft = useInstructorStore.getState().sessionNotesDraft;
      const arr = [...latestDraft];
      let iFrom = arr.findIndex(n => n.id === fromId);
      let iTo = arr.findIndex(n => n.id === toId);
      if (iFrom < 0 || iTo < 0) return;
      const [item] = arr.splice(iFrom, 1);
      if (iFrom < iTo) iTo--;
      arr.splice(iTo, 0, item);
      arr.forEach((n, i) => { n.order = i; });
      setSessionNotesDraft(arr);
    };

    editor.addEventListener('dragstart', onDragStart);
    editor.addEventListener('dragend', onDragEnd);
    editor.addEventListener('dragover', onDragOver);
    editor.addEventListener('drop', onDrop);

    return () => {
      editor.removeEventListener('dragstart', onDragStart);
      editor.removeEventListener('dragend', onDragEnd);
      editor.removeEventListener('dragover', onDragOver);
      editor.removeEventListener('drop', onDrop);
    };
  }, [setSessionNotesDraft]);

  const addNote = () => {
    if (!activeSessionCode) { showToast('Select a session first.'); return; }
    if (sessionNotesDraft.length >= SESSION_SIDEBAR_NOTES_MAX) {
      showToast(`At most ${SESSION_SIDEBAR_NOTES_MAX} session notes.`);
      return;
    }
    const collapsed = sessionNotesDraft.map(n => ({ ...n, editorCollapsed: true }));
    setSessionNotesDraft([
      ...collapsed,
      {
        id: newSessionNoteId(),
        order: collapsed.length,
        title: '',
        body: '',
        imageUrls: [],
        links: [],
        show: true,
        instructor: currentInstructor || 'Instructor',
        editorCollapsed: false,
      },
    ]);
  };

  const updateNote = (updatedNote) => {
    setSessionNotesDraft(sessionNotesDraft.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const removeNote = (noteId) => {
    const filtered = sessionNotesDraft.filter(n => n.id !== noteId);
    filtered.forEach((n, i) => { n.order = i; });
    if (filtered.length) {
      filtered.forEach((n, i) => { n.editorCollapsed = i !== filtered.length - 1; });
    }
    setSessionNotesDraft([...filtered]);
  };

  const toggleCollapse = (noteId) => {
    setSessionNotesDraft(sessionNotesDraft.map(n =>
      n.id === noteId ? { ...n, editorCollapsed: !n.editorCollapsed } : n
    ));
  };

  const save = async () => {
    if (!activeSessionCode) { showToast('Select a session first.'); return; }

    const persistNotes = sessionNotesDraft
      .filter(n =>
        String(n.title || '').trim() ||
        String(n.body || '').trim() ||
        (Array.isArray(n.imageUrls) && n.imageUrls.length) ||
        (Array.isArray(n.links) && n.links.length)
      )
      .map((n, i) => {
        const { editorCollapsed, ...rest } = { ...n, order: i };
        return {
          ...rest,
          links: (rest.links || [])
            .filter(l => /^https?:\/\//i.test(l.url))
            .slice(0, SESSION_NOTE_LINKS_MAX),
        };
      });

    const payload = {
      sessionNoteShow,
      sessionNotes: persistNotes,
      sessionNoteTitle: '',
      sessionNoteBody: '',
      sessionNoteImageUrls: [],
      sessionNoteUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (isDemoMode) {
      const updated = allSessions.map(s =>
        s.id === activeSessionCode
          ? { ...s, sessionNoteShow, sessionNotes: persistNotes, sessionNoteTitle: '', sessionNoteBody: '', sessionNoteImageUrls: [] }
          : s
      );
      setAllSessions(updated);
      showToast('Session notes updated (demo).');
      return;
    }

    try {
      await db.collection('sessions').doc(activeSessionCode).update(payload);
      const updated = allSessions.map(s =>
        s.id === activeSessionCode
          ? { ...s, sessionNoteShow, sessionNotes: persistNotes, sessionNoteTitle: '', sessionNoteBody: '', sessionNoteImageUrls: [] }
          : s
      );
      setAllSessions(updated);
      showToast('Session notes saved.');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', marginBottom: '0.65rem', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          id="session-note-show"
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
          checked={sessionNoteShow}
          onChange={e => setSessionNoteShow(e.target.checked)}
        />
        Show in student dashboard
      </label>

      <div id="session-notes-editor-host">
        <div ref={editorRef} id="session-notes-editor" className="session-notes-editor" aria-label="Instructor notes for students">
          {sessionNotesDraft.length === 0 ? (
            <p className="sn-empty-hint">No notes yet. Use <strong>+ Add note</strong>, then save.</p>
          ) : (
            sessionNotesDraft.map((note, i) => (
              <NoteCard
                key={note.id}
                note={note}
                index={i}
                onUpdate={updateNote}
                onRemove={removeNote}
                onToggleCollapse={toggleCollapse}
              />
            ))
          )}
        </div>
      </div>

      <button type="button" className="add-btn sn-add-note-btn" style={{ marginTop: '0.5rem', width: '100%' }} onClick={addNote}>
        + Add note
      </button>
      <button className="save-btn" style={{ background: 'var(--accent)', marginTop: '0.65rem' }} onClick={save}>
        Save session notes
      </button>
    </div>
  );
}
