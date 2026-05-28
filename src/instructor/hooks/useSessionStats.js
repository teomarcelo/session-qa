import { useRef, useCallback } from 'react';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import { fetchSessionQuestionCountStats } from '../../lib/sessionQuestionCounts.js';
import useInstructorStore from '../store/useInstructorStore.js';

export function useSessionStats() {
  const { db } = useFirebase();
  const timerRef = useRef(null);

  const getAllCachedQuestions = useCallback(() => {
    const { questionPages } = useInstructorStore.getState();
    const m = new Map();
    questionPages.forEach(p => { (p.questions || []).forEach(q => m.set(q.id, q)); });
    return Array.from(m.values());
  }, []);

  const applyFromCache = useCallback(() => {
    const qs = getAllCachedQuestions();
    useInstructorStore.getState().setStats({
      total: qs.length,
      answered: qs.filter(q => q.status === 'answered').length,
      pending: qs.filter(q => q.status !== 'answered').length,
      pinned: qs.filter(q => q.pinned).length,
    });
  }, [getAllCachedQuestions]);

  const runRefresh = useCallback(() => {
    const state = useInstructorStore.getState();
    const { activeSessionCode, isDemoMode, statsSerial } = state;
    if (!activeSessionCode || isDemoMode || !db) {
      applyFromCache();
      return;
    }

    const serialAtStart = statsSerial;
    fetchSessionQuestionCountStats(activeSessionCode)
      .then((stats) => {
        const current = useInstructorStore.getState();
        if (current.statsSerial !== serialAtStart || current.activeSessionCode !== activeSessionCode) return;
        current.setStats({
          total: stats.total,
          answered: stats.answered,
          pending: stats.pending,
          pinned: stats.pinned,
        });
      })
      .catch(() => {
        const current = useInstructorStore.getState();
        if (current.statsSerial !== serialAtStart || current.activeSessionCode !== activeSessionCode) return;
        applyFromCache();
      });
  }, [db, applyFromCache]);

  const scheduleRefresh = useCallback(() => {
    const state = useInstructorStore.getState();
    if (state.isDemoMode || !state.activeSessionCode || !db) {
      applyFromCache();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      runRefresh();
    }, 400);
  }, [db, runRefresh, applyFromCache]);

  const updateStats = useCallback(() => {
    const state = useInstructorStore.getState();
    if (state.isDemoMode || !state.activeSessionCode || !db) {
      applyFromCache();
      return;
    }
    scheduleRefresh();
  }, [db, applyFromCache, scheduleRefresh]);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { updateStats, applyFromCache, cancelPending, runRefresh };
}
