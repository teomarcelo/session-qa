import { useState, useEffect, useRef } from 'react';
import { fetchSessionQuestionCountStats } from '../../lib/sessionQuestionCounts.js';
import { IS_STUDENT_DEMO } from '../demo/useStudentDemoStore.js';

const EMPTY_STATS = { total: 0, answered: 0, pending: 0, pinned: 0 };

// Matches the instructor-side stats debounce. Collapses bursts of question
// changes (a page load, a batch of upvotes) into a single aggregate query.
const STATS_DEBOUNCE_MS = 400;

/**
 * Fetches Firestore aggregate question counts for the stats grid.
 * Falls back to counting from cached questions if the aggregate call fails.
 * Uses a serial number to cancel stale requests when the session changes.
 *
 * In demo mode the aggregate query is never issued — stats are counted from the
 * in-memory demo questions passed in as `allCachedQuestions`.
 *
 * BILLING-SENSITIVE (read before editing):
 * Each refresh costs three Firestore `count()` reads. Callers rebuild
 * `allCachedQuestions` during render, so the array identity changes every pass.
 * Depending on that identity — or calling setStats with a fresh object every
 * time — makes this hook re-render itself and refetch forever, burning reads for
 * as long as the tab is open. Keep the effect keyed on `cacheKey` (a primitive)
 * and keep the setStats calls identity-stable so React can bail out.
 */
export function useSessionStats(sessionCode, db, allCachedQuestions) {
  const [stats, setStats] = useState(EMPTY_STATS);
  const serialRef = useRef(0);

  const cacheStats = countFromCache(allCachedQuestions);
  const cacheKey = statsKey(cacheStats);

  // Lets the effect read the freshest cache counts without depending on the
  // array identity that changes on every render.
  const cacheStatsRef = useRef(cacheStats);
  cacheStatsRef.current = cacheStats;

  useEffect(() => {
    // Bump the serial to invalidate any in-flight request from the previous session.
    serialRef.current += 1;
    const mySerial = serialRef.current;

    if (IS_STUDENT_DEMO || !db || !sessionCode) {
      // Demo mode or no Firebase — count from cached (in-memory) questions.
      setStats((prev) => (sameStats(prev, cacheStatsRef.current) ? prev : cacheStatsRef.current));
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchSessionQuestionCountStats(sessionCode)
        .then((s) => {
          if (cancelled || mySerial !== serialRef.current) return; // stale
          setStats((prev) => (sameStats(prev, s) ? prev : s));
        })
        .catch(() => {
          if (cancelled || mySerial !== serialRef.current) return;
          const fallback = cacheStatsRef.current;
          setStats((prev) => (sameStats(prev, fallback) ? prev : fallback));
        });
    }, STATS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // Keyed on the cache *counts*, not the cache array, so an unchanged feed never
  // triggers another aggregate query.
  }, [sessionCode, db, cacheKey]);

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

function statsKey(s) {
  return `${s.total}|${s.answered}|${s.pending}|${s.pinned}`;
}

function sameStats(a, b) {
  return (
    !!a &&
    !!b &&
    a.total === b.total &&
    a.answered === b.answered &&
    a.pending === b.pending &&
    a.pinned === b.pinned
  );
}
