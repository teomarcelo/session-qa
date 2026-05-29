import { useEffect, useRef } from 'react';
import { QUESTIONS_PAGE_SIZE } from '../../constants/app.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import useInstructorStore from '../store/useInstructorStore.js';

export function useQuestions() {
  const { db } = useFirebase();
  const unsubRef = useRef(null);

  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);

  // Subscribe to questions when active session changes (non-demo)
  useEffect(() => {
    // Clean up previous listener
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!activeSessionCode || isDemoMode || !db) return;

    // Clear old state when switching sessions
    useInstructorStore.getState().setCurrentPage(0);
    useInstructorStore.getState().setInstructorOlderBeyondLoadExhausted(false);

    const unsub = db.collection('sessions').doc(activeSessionCode).collection('questions')
      .orderBy('createdAt', 'desc')
      .limit(QUESTIONS_PAGE_SIZE)
      .onSnapshot(snap => {
        const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const endSnap = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

        const state = useInstructorStore.getState();
        // Only update page 0 from snapshot (don't clobber older pages we fetched)
        if (state.currentPage === 0) {
          // Preserve any older pages already loaded (pages 1, 2, ...); refresh only page 0.
          const newPages = [{ questions, endSnap }, ...state.questionPages.slice(1)];
          useInstructorStore.getState().setQuestionPages(newPages);
          useInstructorStore.getState().setInstructorOlderBeyondLoadExhausted(questions.length < QUESTIONS_PAGE_SIZE);
        } else {
          // Update page 0 in place but don't navigate away from the current page.
          const newPages = [...state.questionPages];
          newPages[0] = { questions, endSnap };
          // Use setQuestionPages so allQuestions stays in sync with currentPage.
          useInstructorStore.getState().setQuestionPages(newPages);
        }
      });

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [activeSessionCode, isDemoMode, db]);

  const goToPage = (zeroBased) => {
    const state = useInstructorStore.getState();
    if (zeroBased < 0 || zeroBased >= state.questionPages.length || !state.questionPages[zeroBased]) return;
    if (zeroBased === state.currentPage) return;
    useInstructorStore.getState().setCurrentPage(zeroBased);
  };

  const goPreviousPage = () => {
    const state = useInstructorStore.getState();
    if (state.currentPage <= 0) return;
    goToPage(state.currentPage - 1);
  };

  const goNextPage = async () => {
    const state = useInstructorStore.getState();
    if (state.questionsLoading) return;

    // If there's a cached next page, just go there
    if (state.currentPage < state.questionPages.length - 1) {
      goToPage(state.currentPage + 1);
      return;
    }

    // Otherwise load older from Firestore
    await loadOlderPage();
  };

  const loadOlderPage = async () => {
    const state = useInstructorStore.getState();
    if (!state.activeSessionCode || state.isDemoMode || state.questionsLoading) return;
    const cur = state.questionPages[state.currentPage];
    if (!cur || !cur.endSnap || cur.questions.length < QUESTIONS_PAGE_SIZE) return;
    if (state.instructorOlderBeyondLoadExhausted) return;

    useInstructorStore.getState().setQuestionsLoading(true);
    try {
      const snap = await db.collection('sessions').doc(state.activeSessionCode).collection('questions')
        .orderBy('createdAt', 'desc')
        .startAfter(cur.endSnap)
        .limit(QUESTIONS_PAGE_SIZE)
        .get();

      if (!snap.docs.length) {
        useInstructorStore.getState().setInstructorOlderBeyondLoadExhausted(true);
        return;
      }

      const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const endSnap = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      const nextIdx = state.currentPage + 1;

      const latestState = useInstructorStore.getState();
      const newPages = [...latestState.questionPages];
      newPages[nextIdx] = { questions, endSnap };

      useInstructorStore.getState().setInstructorOlderBeyondLoadExhausted(snap.docs.length < QUESTIONS_PAGE_SIZE);
      useInstructorStore.setState({ questionPages: newPages });
      useInstructorStore.getState().setCurrentPage(nextIdx);
    } catch (e) {
      console.error('Load older questions failed:', e);
      useInstructorStore.getState().showToast('Error loading older questions: ' + e.message);
    } finally {
      useInstructorStore.getState().setQuestionsLoading(false);
    }
  };

  return { goToPage, goPreviousPage, goNextPage };
}
