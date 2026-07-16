import { useState, useEffect, useRef } from 'react';
import { fetchSessionQuestionCountStats } from '../../lib/sessionQuestionCounts.js';
import { IS_STUDENT_DEMO } from '../demo/useStudentDemoStore.js';

/**
 * Fetches Firestore aggregate question counts for the stats grid.
 * Falls back to counting from cached questions if the aggregate call fails.
 * Uses a serial number to cancel stale requests when the session changes.
 *
 * In demo mode the aggregate query is never issued — stats are counted from the
 * in-memory demo questions passed in as `allCachedQuestions`.
 */
export function useSessionStats(sessionCode, db, allCachedQuestions) {
  const [stats, setStats] = useState({ total: 0, answered: 0, pending: 0, pinned: 0 });
  const serialRef = useRef(0);

  useEffect(() => {
    // Bump the serial to invalidate any in-flight request from the previous session.
    serialRef.current += 1;
    const mySerial = serialRef.current;

    if (IS_STUDENT_DEMO || !db || !sessionCode) {
      // Demo mode or no Firebase — count from cached (in-memory) questions.
      setStats(countFromCache(allCachedQuestions));
      return;
    }

    fetchSessionQuestionCountStats(sessionCode)
      .then((s) => {
        if (mySerial !== serialRef.current) return; // stale
        setStats(s);
      })
      .catch(() => {
        if (mySerial !== serialRef.current) return;
        setStats(countFromCache(allCachedQuestions));
      });
  // Re-run when cached questions change (updates fallback count) or session changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, db, allCachedQuestions]);

  return stats;
}

function countFromCache(questions) {
  const qs = questions || [];
  return {
    total: qs.length,
    answered: qs.filter((q) => q.status === 'answered').length,
    pending: qs.filter((q) => q.status === 'pending').length,
    pinned: qs.filter((q) => q.pinned).length,
  };
}
