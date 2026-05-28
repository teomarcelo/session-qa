import { useState, useEffect, useRef, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { QUESTIONS_PAGE_SIZE, STUDENT_POLL_MS } from '../../constants/app.js';

/**
 * Manages paginated question fetching for the student board.
 *
 * - Polls page 0 every STUDENT_POLL_MS (10s).
 * - Pagination uses a pages array: each page has { questions, endSnap }.
 * - Cached pages are served without a re-fetch when navigating back.
 * - Poll is skipped when pollSkipUntilRef.current > Date.now() (set by upvote).
 */
export function useQuestions(sessionCode, pollSkipUntilRef) {
  const { db } = useFirebase();

  const [questionPages, setQuestionPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadingRef = useRef(false);
  const pollTimerRef = useRef(null);
  // Keep a ref to currentPage so callbacks can read the latest value without
  // being in their deps array (avoids stale closures in pagination callbacks).
  const currentPageRef = useRef(0);
  const questionPagesRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { questionPagesRef.current = questionPages; }, [questionPages]);

  // Convenience: questions on the current page
  const allQuestions = questionPages[currentPage]?.questions ?? [];

  /** Fetch (or refresh) page 0. Safe to call repeatedly; skips if already loading. */
  const fetchFirstPage = useCallback(async () => {
    if (!db || !sessionCode) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const snap = await db
        .collection('sessions')
        .doc(sessionCode)
        .collection('questions')
        .orderBy('createdAt', 'desc')
        .limit(QUESTIONS_PAGE_SIZE)
        .get();

      const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const endSnap = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

      setQuestionPages((prev) => {
        const next = prev.slice();
        next[0] = { questions, endSnap };
        // Refreshing page 0 invalidates cached older pages to avoid stale cursors.
        return next.slice(0, 1);
      });
      setCurrentPage(0);
      setOlderExhausted(snap.docs.length < QUESTIONS_PAGE_SIZE);
    } catch (e) {
      console.warn('useQuestions fetchFirstPage error:', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [db, sessionCode]);

  /** Load or navigate to the next (older) page. */
  const goNextPage = useCallback(async () => {
    if (!db || !sessionCode || loadingRef.current) return;

    const cp = currentPageRef.current;
    const pages = questionPagesRef.current;
    const nextIdx = cp + 1;

    // Navigate to already-cached page without a fetch
    if (pages[nextIdx]) {
      setCurrentPage(nextIdx);
      return;
    }

    // Need to fetch the next page
    const cur = pages[cp];
    if (!cur || !cur.endSnap || cur.questions.length < QUESTIONS_PAGE_SIZE) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const snap = await db
        .collection('sessions')
        .doc(sessionCode)
        .collection('questions')
        .orderBy('createdAt', 'desc')
        .startAfter(cur.endSnap)
        .limit(QUESTIONS_PAGE_SIZE)
        .get();

      if (!snap.docs.length) {
        setOlderExhausted(true);
        return;
      }
      const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const endSnap = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      setQuestionPages((pp) => {
        const next = pp.slice();
        next[nextIdx] = { questions, endSnap };
        return next;
      });
      setCurrentPage(nextIdx);
      setOlderExhausted(snap.docs.length < QUESTIONS_PAGE_SIZE);
    } catch (e) {
      console.warn('useQuestions goNextPage error:', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [db, sessionCode]);

  /** Navigate to previous (newer) page — always cached. */
  const goPrevPage = useCallback(() => {
    const cp = currentPageRef.current;
    if (cp <= 0) return;
    setCurrentPage(cp - 1);
  }, []);

  /** Jump directly to a cached page by zero-based index. */
  const goToPage = useCallback((idx) => {
    const pages = questionPagesRef.current;
    if (idx < 0 || idx >= pages.length || !pages[idx]) return;
    setCurrentPage(idx);
  }, []);

  // --- Reset when session changes: reset state and start polling ---
  useEffect(() => {
    if (!sessionCode) return;

    // Reset all state for the new session
    setQuestionPages([]);
    setCurrentPage(0);
    setOlderExhausted(false);
    setLoading(false);
    loadingRef.current = false;
    currentPageRef.current = 0;
    questionPagesRef.current = [];

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    fetchFirstPage();

    pollTimerRef.current = setInterval(() => {
      if (pollSkipUntilRef && Date.now() < pollSkipUntilRef.current) return;
      // Only auto-poll when on page 0
      if (currentPageRef.current !== 0) return;
      fetchFirstPage();
    }, STUDENT_POLL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // fetchFirstPage is stable per (db, sessionCode); pollSkipUntilRef is a ref (stable identity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, db]);

  /** All questions across all cached pages (for stats / search). */
  const getAllCached = useCallback(() => {
    const m = new Map();
    questionPagesRef.current.forEach((p) => {
      (p.questions || []).forEach((q) => m.set(q.id, q));
    });
    return Array.from(m.values());
  }, []);

  /** Reset to page 0 and clear cache (for manual refresh). */
  const reset = useCallback(() => {
    setQuestionPages([]);
    setCurrentPage(0);
    setOlderExhausted(false);
    loadingRef.current = false;
    currentPageRef.current = 0;
    questionPagesRef.current = [];
  }, []);

  return {
    allQuestions,
    questionPages,
    currentPage,
    olderExhausted,
    loading,
    fetchFirstPage,
    goNextPage,
    goPrevPage,
    goToPage,
    getAllCached,
    reset,
  };
}
