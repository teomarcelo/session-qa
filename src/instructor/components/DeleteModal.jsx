import { useState } from 'react';
import useInstructorStore from '../store/useInstructorStore.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';

export default function DeleteModal() {
  const { db } = useFirebase();
  const deleteTargetId = useInstructorStore(s => s.deleteTargetId);
  const closeDeleteModal = useInstructorStore(s => s.closeDeleteModal);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const removeQuestionFromPages = useInstructorStore(s => s.removeQuestionFromPages);
  const showToast = useInstructorStore(s => s.showToast);

  const [inProgress, setInProgress] = useState(false);

  if (!deleteTargetId) return null;

  const confirmDelete = async () => {
    if (!deleteTargetId || inProgress) return;
    const rid = deleteTargetId;

    if (isDemoMode) {
      removeQuestionFromPages(rid);
      showToast('Question deleted.');
      closeDeleteModal();
      return;
    }

    if (!db) { showToast('Firebase not available.'); closeDeleteModal(); return; }
    setInProgress(true);
    try {
      await db.collection('sessions').doc(activeSessionCode).collection('questions').doc(rid).delete();
      removeQuestionFromPages(rid);
      showToast('Question deleted.');
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      const msg = (err && err.code === 'permission-denied')
        ? 'Firestore denied delete. In Firebase → Firestore → Rules, allow delete on questions (see SETUP.md).'
        : ('Could not delete: ' + (err && err.message ? err.message : 'unknown error'));
      showToast(msg);
      closeDeleteModal();
    } finally {
      setInProgress(false);
    }
  };

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Delete this question?</div>
        <div className="modal-body">This action can't be undone. The question and any answer will be permanently removed.</div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={closeDeleteModal}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={inProgress}>
            {inProgress ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
