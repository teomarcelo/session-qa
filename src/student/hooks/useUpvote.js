import { useState, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import firebase from '../../lib/firebaseCompat.js';

/**
 * Per-question optimistic upvote with lock to prevent double-tap.
 *
 * Returns:
 *   lockedIds: Set<string> — question IDs currently being voted
 *   handleUpvote(id, question, userId, sessionCode, onSuccess, showToast)
 */
export function useUpvote(pollSkipUntilRef) {
  const { db } = useFirebase();
  const [lockedIds, setLockedIds] = useState(new Set());

  const handleUpvote = useCallback(
    (id, question, userId, sessionCode, onSuccess, showToast) => {
      if (!db || !sessionCode) {
        showToast('Not connected. Try refreshing the page.');
        return;
      }
      if (!id || lockedIds.has(id)) return;
      if (!question) {
        showToast('That question is not on this page anymore.');
        return;
      }

      // Set the poll skip window to avoid a race where the poll fires
      // before the Firestore write resolves and reverts the optimistic state.
      if (pollSkipUntilRef) pollSkipUntilRef.current = Date.now() + 1600;

      const voters = question.voters || [];
      const ref = db
        .collection('sessions')
        .doc(sessionCode)
        .collection('questions')
        .doc(id);

      // Lock this question immediately (optimistic)
      setLockedIds((prev) => new Set([...prev, id]));

      const payload = voters.includes(userId)
        ? {
            votes: firebase.firestore.FieldValue.increment(-1),
            voters: firebase.firestore.FieldValue.arrayRemove(userId),
          }
        : {
            votes: firebase.firestore.FieldValue.increment(1),
            voters: firebase.firestore.FieldValue.arrayUnion(userId),
          };

      ref
        .update(payload)
        .then(() => new Promise((resolve) => setTimeout(resolve, 400)))
        .then(() => {
          if (onSuccess) onSuccess();
        })
        .catch((err) => {
          showToast(
            err && err.message ? err.message : 'Could not update vote. Check your connection.',
          );
        })
        .finally(() => {
          setLockedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    },
    [db, lockedIds, pollSkipUntilRef],
  );

  return { lockedIds, handleUpvote };
}
