/**
 * AnswerBox — controlled textarea for composing / editing instructor answers.
 * Answer draft is stored in Zustand (answerDrafts[qId]) — survives re-renders
 * caused by Firestore onSnapshot updates without any captureAnswerDrafts cycle.
 */
import useInstructorStore from '../store/useInstructorStore.js';
import FormatToolbar from './FormatToolbar.jsx';

export default function AnswerBox({ qId, isEditing, onSave, onCancelEdit }) {
  // Controlled: read/write from Zustand store — no captureAnswerDrafts needed
  const draft = useInstructorStore(s => s.answerDrafts[qId] ?? '');
  const setAnswerDraft = useInstructorStore(s => s.setAnswerDraft);
  const pendingImages = useInstructorStore(s => s.pendingAnswerImages[qId] || []);
  const setPendingAnswerImages = useInstructorStore(s => s.setPendingAnswerImages);
  const showToast = useInstructorStore(s => s.showToast);

  const removePendingImage = (url) => {
    const updated = pendingImages.filter(u => u !== url);
    if (updated.length === 0) {
      useInstructorStore.getState().clearPendingAnswerImages(qId);
    } else {
      setPendingAnswerImages(qId, updated);
    }
  };

  const answerBoxId = `ans-${qId}`;

  return (
    <div className="q-answer-area">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <div className="answer-label">
          {isEditing ? 'Editing answer — save to update' : 'Answer'}
        </div>
        {isEditing && (
          <button type="button" className="action-btn btn-cancel-ans-edit" onClick={onCancelEdit}>
            Cancel edit
          </button>
        )}
      </div>

      {/* Paste preview images */}
      {pendingImages.length > 0 && (
        <div className="answer-paste-preview" id={`ans-prev-${qId}`}>
          {pendingImages.map(url => (
            <span key={url} className="paste-preview-item">
              <img src={url} alt="" />
              <button
                type="button"
                className="paste-preview-remove"
                aria-label="Remove"
                onClick={() => removePendingImage(url)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {pendingImages.length === 0 && (
        <div className="answer-paste-preview" id={`ans-prev-${qId}`}></div>
      )}

      <FormatToolbar textareaId={answerBoxId} />

      {/* The id is required for the format toolbar targeting and paste handler */}
      <textarea
        id={answerBoxId}
        className="answer-box"
        placeholder="Type your answer here… Paste links or screenshots (images upload to Firebase Storage)."
        value={draft}
        onChange={e => setAnswerDraft(qId, e.target.value)}
      />

      <div style={{ marginTop: '0.4rem' }}>
        <button
          type="button"
          className="action-btn btn-answer"
          onClick={onSave}
        >
          <svg className="action-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
          <span>{isEditing ? 'Update answer' : 'Save answer'}</span>
        </button>
      </div>
    </div>
  );
}
