import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FormatToolbar from './FormatToolbar.jsx';
import { insertSlackFormat, insertEmoji } from '../utils/formatHelpers.js';

/**
 * Edit modal for editing the student's own question text.
 * Closes on ESC.
 * The format toolbar injects Slack-style formatting into the textarea via DOM ref.
 */
export default function EditModal({ question, onSave, onClose }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const textareaId = 'edit-text';

  useEffect(() => {
    if (question) {
      setText(question.text || '');
    }
  }, [question]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus the textarea when opened
  useEffect(() => {
    if (question && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [question]);

  if (!question) return null;

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  function handleInsertFormat(mode) {
    if (textareaRef.current) {
      insertSlackFormat(textareaRef.current, mode);
      setText(textareaRef.current.value);
    }
  }

  function handleInsertEmoji(ch) {
    if (textareaRef.current) {
      insertEmoji(textareaRef.current, ch);
      setText(textareaRef.current.value);
    }
  }

  const modal = (
    <div
      className="modal-overlay open"
      id="edit-modal"
      aria-hidden="false"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        <div className="modal-title" id="edit-modal-title">Edit your question</div>
        <FormatToolbar
          targetId={textareaId}
          targetRef={textareaRef}
          onInsertFormat={handleInsertFormat}
          onInsertEmoji={handleInsertEmoji}
          onClear={() => { setText(''); if (textareaRef.current) textareaRef.current.focus(); }}
        />
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '0.75rem',
            border: '1.5px solid var(--border)',
            borderRadius: '8px',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-submit" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
