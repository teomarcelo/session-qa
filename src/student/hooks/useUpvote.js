import { useState, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import firebase from '../../lib/firebaseCompat.js';
import { ensureAnonymousStudent, currentUid } from '../../lib/auth.js';

/**
 * Per-question optimistic upvote with lock to prevent double-tap.
 *
 * Voter identity is the Firebase anonymous uid when available (stable per
 * browser, enforceable by rules), falling back to the legacy localStorage id
 * so demo mode and any auth-unavailable path keep working.
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

      // Set the poll skip window to avoid a race where a refresh fires
      // before the Firestore write resolves and reverts the optimistic state.
      if (pollSkipUntilRef) pollSkipUntilRef.current = Date.now() + 1600;

      const ref = db
        .collection('sessions')
        .doc(sessionCode)
        .collection('questions')
        .doc(id);

      // Lock this question immediately (optimistic)
      setLockedIds((prev) => new Set([...prev, id]));

      // Ensure the anonymous identity, then write using the uid-based voter.
      ensureAnonymousStudent()
        .then((user) => {
          const voterId = (user && user.uid) || currentUid() || userId;
          const voters = question.voters || [];
          // Treat a prior vote under EITHER the uid or the legacy localStorage id
          // as "already voted", so migrating identities never lets one person
          // vote twice. Decrement by however many of their ids we remove.
          const removeIds = [];
          if (voters.includes(voterId)) removeIds.push(voterId);
          if (userId && userId !== voterId && voters.includes(userId)) removeIds.push(userId);
          const payload = removeIds.length
            ? {
                votes: firebase.firestore.FieldValue.increment(-removeIds.length),
                voters: firebase.firestore.FieldValue.arrayRemove(...removeIds),
              }
            : {
                votes: firebase.firestore.FieldValue.increment(1),
                voters: firebase.firestore.FieldValue.arrayUnion(voterId),
              };
          return ref.update(payload);
        })
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
