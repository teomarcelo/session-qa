import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import FormatToolbar from './FormatToolbar.jsx';
import { insertSlackFormat, insertEmoji } from '../utils/formatHelpers.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { ensureAnonymousStudent } from '../../lib/auth.js';
import {
  dropPendingImage,
  pendingImagesStillUploading,
  pendingRowsFromImageUrls,
  questionImageUrlsFromPending,
  runStudentQuestionImagePaste,
  stripEmbeddedImageUrls,
  uploadStudentQuestionJpeg,
} from '../../lib/imagePaste.js';

/**
 * Edit modal for the student's own question: text + the same image-paste
 * pipeline as the ask box (preview, add, remove). Closes on ESC.
 */
export default function EditModal({
  question,
  sessionCode,
  userId,
  isDemoMode = false,
  showToast,
  onSave,
  onClose,
}) {
  const { storage } = useFirebase();
  const [text, setText] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);
  const pendingImagesRef = useRef([]);
  const textareaId = 'edit-text';
  const questionId = question && question.id;

  useEffect(() => {
    if (!question) return;
    setText(question.text || '');
    const rows = pendingRowsFromImageUrls(question.imageUrls);
    pendingImagesRef.current = rows;
    setPendingImages(rows);
  // Hydrate once per opened question. A new `question` object from a parent
  // render must not wipe an in-flight replacement upload.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate on questionId
  }, [questionId]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (questionId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [questionId]);

  const uploadImage = useCallback(
    async (jpegBlob) => {
      await ensureAnonymousStudent();
      return uploadStudentQuestionJpeg(storage, sessionCode, userId, jpegBlob);
    },
    [storage, sessionCode, userId],
  );

  const handlePaste = useCallback(
    (e) =>
      runStudentQuestionImagePaste(e, {
        sessionCode,
        storage,
        isDemoMode,
        showToast,
        uploadImage,
        setPendingImages,
        pendingRef: pendingImagesRef,
        attachedToast: 'Image attached. Save to keep it.',
        linkFallbackToast: 'Using image link (download or upload was blocked). Save to keep the URL.',
      }),
    [sessionCode, storage, isDemoMode, showToast, uploadImage],
  );

  function removePendingImage(pid) {
    dropPendingImage(pendingImagesRef, setPendingImages, pid);
    if (textareaRef.current) textareaRef.current.focus();
  }

  if (!question) return null;

  const uploading = pendingImagesStillUploading(pendingImages);

  async function handleSave() {
    if (saving || uploading) return;
    const imageUrls = questionImageUrlsFromPending(pendingImages);
    const trimmed = stripEmbeddedImageUrls(text, imageUrls).trim();
    if (!trimmed && !imageUrls.length) {
      showToast('Add some text or an image first.');
      return;
    }
    if (trimmed.length > 10000) {
      showToast('That question is too long. Shorten it and save again.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ text: trimmed, imageUrls });
    } finally {
      setSaving(false);
    }
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
      onPaste={handlePaste}
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
          placeholder="Edit your question. Paste a screenshot to attach."
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
        <div
          id="edit-image-previews"
          className={`paste-preview-row${pendingImages.length ? ' has-images' : ''}`}
          aria-live="polite"
        >
          {pendingImages.map((row) => (
            <span
              key={row.pid}
              className={`paste-preview-item${row.uploading || !row.url ? ' is-uploading' : ''}`}
              data-pid={row.pid}
            >
              <img
                alt=""
                referrerPolicy="no-referrer"
                src={row.blobUrl || row.url || ''}
              />
              <button
                type="button"
                className="paste-preview-remove"
                aria-label="Remove image"
                onClick={() => removePendingImage(row.pid)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-submit" onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
