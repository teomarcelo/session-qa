import { useState, useRef, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import firebase from '../../lib/firebaseCompat.js';
import { ensureAnonymousStudent, currentUid } from '../../lib/auth.js';
import FormatToolbar from './FormatToolbar.jsx';
import { insertSlackFormat, insertEmoji } from '../utils/formatHelpers.js';
import { extractImageUrlForQuestionPaste } from '../../lib/clipboardImagePaste.js';
import { IMAGE_MAX_EDGE, IMAGE_JPEG_QUALITY } from '../../constants/app.js';

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Resize an image file to JPEG blob, capped at IMAGE_MAX_EDGE on the longest side. */
function resizeImageToJpegBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const w = img.width, h = img.height;
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(w, h, 1));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      c.toBlob(
        (blob) => { blob ? resolve(blob) : reject(new Error('encode')); },
        'image/jpeg',
        IMAGE_JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('image')); };
    img.src = u;
  });
}

/** Extract image File objects from a paste event's clipboard data. */
function collectImageFilesFromPaste(e) {
  const out = [];
  const cd = e.clipboardData;
  if (!cd) return out;
  if (cd.items && cd.items.length) {
    for (let i = 0; i < cd.items.length; i++) {
      const it = cd.items[i];
      if (it.kind === 'file' && it.type && it.type.indexOf('image') === 0) {
        const f = it.getAsFile();
        if (f && f.size > 0) out.push(f);
      }
    }
  }
  if (!out.length && cd.files && cd.files.length) {
    for (let j = 0; j < cd.files.length; j++) {
      if (cd.files[j].type && cd.files[j].type.indexOf('image') === 0 && cd.files[j].size > 0) {
        out.push(cd.files[j]);
      }
    }
  }
  return out;
}

/** Human-readable upload error with CORS hint. */
function formatUploadError(err) {
  const m = (err && err.message) ? String(err.message) : '';
  const code = (err && err.code) ? String(err.code) : '';
  const blob = (m + ' ' + code).toLowerCase();
  if (
    blob.indexOf('cors') >= 0 ||
    blob.indexOf('network') >= 0 ||
    blob.indexOf('preflight') >= 0 ||
    blob.indexOf('xmlhttprequest') >= 0
  ) {
    return 'Image upload blocked (browser ↔ Storage). Apply storage-cors.json to your bucket with this origin — SETUP.md step "CORS".';
  }
  return 'Upload failed: ' + (m || 'check Storage rules in SETUP.md');
}

/**
 * Ask box component: textarea, format toolbar, image paste previews, anon toggle, submit.
 *
 * Manages:
 *  - text state (controlled textarea)
 *  - pendingImages state: array of { pid, url, blobUrl, uploading }
 *  - postAnonymously toggle
 *  - image paste upload via Firebase Storage
 */
export default function AskBox({ sessionCode, userId, userName, showToast, onSubmitDone }) {
  const { db, storage } = useFirebase();
  const [text, setText] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [postAnonymously, setPostAnonymously] = useState(
    !userName || userName === 'Anonymous',
  );
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const textareaId = 'q-text';

  // --- Image upload to Firebase Storage ---
  function uploadImage(jpegBlob) {
    if (!storage || !sessionCode) return Promise.reject(new Error('no storage'));
    const path =
      'sessions/' +
      sessionCode +
      '/question_paste/' +
      userId +
      '_' +
      Date.now() +
      '_' +
      genId() +
      '.jpg';
    return storage
      .ref(path)
      .put(jpegBlob, { contentType: 'image/jpeg' })
      .then((snap) => snap.ref.getDownloadURL());
  }

  // --- Paste handler ---
  const handlePaste = useCallback(
    async (e) => {
      if (!sessionCode) return;
      const files = collectImageFilesFromPaste(e);
      const htmlSrc = extractImageUrlForQuestionPaste(e, files.length > 0);
      if (!files.length && !htmlSrc) return;

      if (!storage) {
        if (htmlSrc) {
          e.preventDefault();
          setPendingImages((prev) => [
            ...prev,
            { pid: genId() + genId(), url: htmlSrc, blobUrl: '' },
          ]);
          showToast('Image link added (Firebase Storage not active—this uses the original URL).');
          return;
        }
        showToast(
          'Image files need Firebase Storage (paid plan). Paste an https:// image link instead, or upgrade Storage.',
        );
        return;
      }

      e.preventDefault();

      if (files.length) {
        for (let k = 0; k < files.length; k++) {
          const pid = genId() + '_' + Date.now() + '_' + k;
          setPendingImages((prev) => [...prev, { pid, url: '', blobUrl: '', uploading: true }]);
          showToast('Uploading image…');
          try {
            const jpegBlob = await resizeImageToJpegBlob(files[k]);
            const blobUrl = URL.createObjectURL(jpegBlob);
            setPendingImages((prev) =>
              prev.map((r) =>
                r.pid === pid ? { pid, url: '', blobUrl, uploading: false } : r,
              ),
            );
            const url = await uploadImage(jpegBlob);
            setPendingImages((prev) => {
              return prev.map((r) => {
                if (r.pid !== pid) return r;
                try { URL.revokeObjectURL(r.blobUrl); } catch (er) {}
                return { pid, url, blobUrl: '' };
              });
            });
            showToast('Image attached. Add text or submit.');
          } catch (err) {
            console.warn(err);
            setPendingImages((prev) => {
              const row = prev.find((r) => r.pid === pid);
              if (row) { try { URL.revokeObjectURL(row.blobUrl); } catch (er2) {} }
              return prev.filter((r) => r.pid !== pid);
            });
            showToast(formatUploadError(err));
          }
        }
        return;
      }

      if (htmlSrc) {
        const pid2 = genId() + '_' + Date.now();
        setPendingImages((prev) => [...prev, { pid: pid2, url: htmlSrc, blobUrl: '' }]);
        showToast('Uploading image…');
        try {
          const r = await fetch(htmlSrc, { mode: 'cors' });
          if (!r.ok) throw new Error('Could not download image (site blocked copy). Try right-click → Copy image.');
          const blob0 = await r.blob();
          const jpeg2 = await resizeImageToJpegBlob(blob0);
          const url2 = await uploadImage(jpeg2);
          setPendingImages((prev) =>
            prev.map((r) => (r.pid === pid2 ? { pid: pid2, url: url2, blobUrl: '' } : r)),
          );
          showToast('Image attached. Add text or submit.');
        } catch (err) {
          console.warn(err);
          // Keep the placeholder with the original URL (fallback)
          showToast('Using image link (download or upload was blocked). Submit to attach.');
        }
      }
    },
    [sessionCode, storage, showToast, userId],
  );

  function removePendingImage(pid) {
    setPendingImages((prev) => {
      const row = prev.find((r) => r.pid === pid);
      if (row && row.blobUrl) { try { URL.revokeObjectURL(row.blobUrl); } catch (e) {} }
      return prev.filter((r) => r.pid !== pid);
    });
  }

  function clearPendingImages() {
    setPendingImages((prev) => {
      prev.forEach((row) => {
        if (row.blobUrl) { try { URL.revokeObjectURL(row.blobUrl); } catch (e) {} }
      });
      return [];
    });
  }

  // --- Submit question ---
  async function handleSubmit() {
    let t = text.trim();
    if (!t && !pendingImages.length) return;

    if (pendingImages.some((r) => !r.url)) {
      showToast('Wait for images to finish uploading, then submit.');
      return;
    }

    const imageUrls = pendingImages.map((r) => r.url).filter(Boolean);
    if (pendingImages.length && imageUrls.length !== pendingImages.length) {
      showToast('Wait for all images to finish uploading, then submit again.');
      return;
    }

    // Strip any embedded image URLs that were pasted as text
    imageUrls.forEach((u) => {
      if (!u) return;
      const re = new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      t = t.replace(re, '').replace(/\n{3,}/g, '\n\n').trim();
    });

    let textOut = t.trim();
    if (!textOut && imageUrls.length) textOut = '';
    else if (!textOut && !imageUrls.length) textOut = '(Image)';

    const displayName = postAnonymously
      ? 'Anonymous'
      : userName && userName !== 'Anonymous'
      ? userName
      : 'Anonymous';

    setSubmitting(true);
    try {
      // Ensure a silent anonymous identity so the write carries a Firebase uid
      // the rules can bind to. Falls back gracefully if auth is unavailable.
      await ensureAnonymousStudent();
      const authUid = currentUid();

      const payload = {
        text: textOut,
        authorName: displayName || 'Anonymous',
        authorEmail: '',
        // authorId (localStorage id) is kept for continuity with existing docs;
        // authorUid is the new Firebase-auth-backed owner used by strict rules.
        authorId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        pinned: false,
        votes: 0,
        voters: [],
        answer: '',
      };
      if (authUid) payload.authorUid = authUid;
      if (imageUrls.length) payload.imageUrls = imageUrls;

      const docRef = await db
        .collection('sessions')
        .doc(sessionCode)
        .collection('questions')
        .add(payload);

      // Track this question as "mine" in sessionStorage
      const key = 'sqa_my_questions_' + String(sessionCode || '').replace(/[^A-Z0-9_-]/gi, '');
      try {
        const myQs = JSON.parse(sessionStorage.getItem(key) || '[]');
        myQs.push(docRef.id);
        sessionStorage.setItem(key, JSON.stringify(myQs));
      } catch (e) {}

      setText('');
      clearPendingImages();
      showToast('Question submitted!');
      if (onSubmitDone) onSubmitDone();
    } catch (e) {
      console.warn('Submit question error:', e);
    } finally {
      setSubmitting(false);
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

  const anonLabel = postAnonymously
    ? 'Anonymous'
    : userName && userName !== 'Anonymous'
    ? userName
    : 'Anonymous';

  return (
    <div className="ask-box">
      <div className="ask-box-header">Ask a question</div>
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
        onPaste={handlePaste}
        placeholder="What's on your mind? Ask anything about the session…"
        rows={3}
      />

      {/* Image previews */}
      <div
        id="q-image-previews"
        className={`paste-preview-row${pendingImages.length ? ' has-images' : ''}`}
        aria-live="polite"
      >
        {pendingImages.map((row) => (
          <span key={row.pid} className="paste-preview-item" data-pid={row.pid}>
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

      <div
        className="ask-footer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Anonymous toggle */}
        <label
          id="anon-toggle-label"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          <div
            id="anon-toggle"
            onClick={() => setPostAnonymously((p) => !p)}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '20px',
              background: postAnonymously ? 'var(--border)' : 'var(--accent)',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <div
              id="anon-knob"
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '2px',
                left: '2px',
                transition: 'transform 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transform: postAnonymously ? 'translateX(0)' : 'translateX(16px)',
              }}
            />
          </div>
          <span id="anon-label-text">
            Post as{' '}
            <strong
              id="anon-name-preview"
              style={{ color: postAnonymously ? 'var(--text-muted)' : 'var(--accent)' }}
            >
              {anonLabel}
            </strong>
          </span>
        </label>

        <button
          className="btn-submit"
          id="submit-btn"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Submit question
        </button>
      </div>
    </div>
  );
}
