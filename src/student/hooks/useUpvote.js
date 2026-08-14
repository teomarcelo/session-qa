import { useState, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import firebase from '../../lib/firebaseCompat.js';
import { ensureAnonymousStudent, currentUid } from '../../lib/auth.js';
import useStudentDemoStore, { IS_STUDENT_DEMO } from '../demo/useStudentDemoStore.js';

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
  const updateDemoQuestion = useStudentDemoStore((s) => s.updateQuestion);

  const handleUpvote = useCallback(
    (id, question, userId, sessionCode, onSuccess, showToast) => {
      // Demo mode: toggle the vote in the in-memory store and return before any
      // Firestore/auth call. `userId` is the fixed demo id in this path.
      if (IS_STUDENT_DEMO) {
        if (!id || !question) return;
        const voters = question.voters || [];
        const voted = voters.includes(userId);
        updateDemoQuestion(id, (q) => ({
          ...q,
          votes: voted ? Math.max(0, (q.votes || 0) - 1) : (q.votes || 0) + 1,
          voters: voted
            ? (q.voters || []).filter((v) => v !== userId)
            : [...(q.voters || []), userId],
        }));
        return;
      }

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

          // A write may only move `votes` by exactly one and may only add or
          // remove the caller's own uid — the rules cannot verify that a caller
          // owns a localStorage id, so letting a write remove one would let
          // anyone erase anyone else's vote.
          if (voters.includes(voterId)) {
            return ref.update({
              votes: firebase.firestore.FieldValue.increment(-1),
              voters: firebase.firestore.FieldValue.arrayRemove(voterId),
            });
          }

          // Vote cast before Firebase Auth shipped, keyed to a localStorage id.
          // It still counts (so this person cannot vote a second time) but it
          // can no longer be retracted.
          if (userId && userId !== voterId && voters.includes(userId)) {
            showToast('Your earlier vote on this question is already counted.');
            return null;
          }

          return ref.update({
            votes: firebase.firestore.FieldValue.increment(1),
            voters: firebase.firestore.FieldValue.arrayUnion(voterId),
          });
        })
        .then(() => new Promise((resolve) => setTimeout(resolve, 400)))
        .then(() => {
          if (onSuccess) onSuccess();
        })
        .catch((err) => {
          console.warn('Upvote failed:', err);
          showToast('Could not update your vote. Check your connection.');
        })
        .finally(() => {
          setLockedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    },
    [db, lockedIds, pollSkipUntilRef, updateDemoQuestion],
  );

  return { lockedIds, handleUpvote };
}
