import { useEffect, useRef } from 'react';
import firebase from '../../lib/firebaseCompat.js';
import { useFirebase } from '../../shared/FirebaseContext.jsx';
import useInstructorStore, { DEMO_SESSION, DEMO_SESSION_CODE, DEMO_QUESTIONS_TEMPLATE } from '../store/useInstructorStore.js';
import {
  nameToId,
  readInstructorActiveSessionFromStorage,
  persistInstructorActiveSession,
  getDemoHiddenSessionIds,
  DEMO_SESSIONS_HIDDEN_KEY,
} from './useInstructorAuth.js';

export function useSessions() {
  const { db } = useFirebase();
  const store = useInstructorStore();
  const unsubRef = useRef(null);

  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const allSessions = useInstructorStore(s => s.allSessions);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);

  // Load sessions when instructor logs in
  useEffect(() => {
    if (!currentInstructor) return;
    if (isDemoMode) {
      loadDemoSessions();
      return;
    }
    if (!db) return;

    // Clean up previous listener
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    const ownerId = nameToId(currentInstructor);
    const unsub = db.collection('sessions')
      .where('ownerId', '==', ownerId)
      .onSnapshot(snap => {
        const owned = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by createdAt descending in JS (no orderBy to avoid composite index)
        owned.sort((a, b) => {
          const at = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
          const bt = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
          return bt - at;
        });

        // Load joined sessions from instructors/{id}
        db.collection('instructors').doc(ownerId).get().then(doc => {
          const joinedCodes = doc.exists && doc.data().joinedSessions ? doc.data().joinedSessions : [];
          const hidden = doc.exists && Array.isArray(doc.data().sessionsHiddenFromList) ? doc.data().sessionsHiddenFromList : [];
          const hiddenSet = new Set(hidden);
          const applyHidden = (arr) => arr.filter(s => s && !hiddenSet.has(s.id));

          const mergeAndUpdate = (joined) => {
            const merged = applyHidden([...owned, ...joined]);
            store.setAllSessions(merged);
            store.setInstructorSessionsHydrated(true);
            tryRestoreActiveSession(merged);
          };

          if (!joinedCodes.length) {
            mergeAndUpdate([]);
            return;
          }
          Promise.all(joinedCodes.map(code => db.collection('sessions').doc(code).get()))
            .then(docs => {
              const joined = docs
                .filter(d => d.exists && !owned.find(o => o.id === d.id))
                .map(d => ({ id: d.id, ...d.data() }));
              mergeAndUpdate(joined);
            });
        });
      }, err => {
        console.error('loadSessions error:', err);
        store.setAllSessions([]);
        store.setInstructorSessionsHydrated(true);
        store.showToast('Error loading sessions: ' + err.message);
      });

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [currentInstructor, isDemoMode, db]);

  function loadDemoSessions() {
    const hidden = getDemoHiddenSessionIds();
    const sessions = [DEMO_SESSION].filter(s => !hidden.includes(s.id));
    store.setAllSessions(sessions);
    store.setInstructorSessionsHydrated(true);

    if (sessions.length) {
      store.setActiveSessionCode(DEMO_SESSION_CODE);
      const qs = DEMO_QUESTIONS_TEMPLATE.map(q => ({ ...q, voters: [...q.voters] }));
      store.setQuestionPages([{ questions: qs, endSnap: null }]);
      store.setCurrentPage(0);
      store.setInstructorOlderBeyondLoadExhausted(true);
      persistInstructorActiveSession(DEMO_SESSION_CODE);
    }
  }

  function tryRestoreActiveSession(sessions) {
    const current = useInstructorStore.getState();
    if (current.isDemoMode || current.activeSessionCode) return;
    let saved = null;
    try { saved = readInstructorActiveSessionFromStorage(); } catch (e) { return; }
    if (!saved || !sessions.length) return;
    if (sessions.some(s => s.id === saved)) {
      store.setActiveSessionCode(saved);
    } else {
      try {
        sessionStorage.removeItem('sqa_instructor_active_session');
        sessionStorage.removeItem('tdx_instructor_active_session');
      } catch (e) {}
    }
  }

  const hideSession = async (sessionCode) => {
    const state = useInstructorStore.getState();
    const finishHide = () => {
      const wasActive = state.activeSessionCode === sessionCode;
      const newSessions = state.allSessions.filter(s => s.id !== sessionCode);
      store.setAllSessions(newSessions);
      if (wasActive) {
        if (newSessions.length) {
          store.setActiveSessionCode(newSessions[0].id);
        } else {
          store.setActiveSessionCode(null);
          persistInstructorActiveSession(null);
        }
      }
      store.showToast('Removed from your list. Join with the code again to restore it.');
    };

    if (state.isDemoMode) {
      const arr = getDemoHiddenSessionIds();
      if (!arr.includes(sessionCode)) arr.push(sessionCode);
      try {
        sessionStorage.setItem(DEMO_SESSIONS_HIDDEN_KEY, JSON.stringify(arr));
      } catch (e) {}
      finishHide();
      return;
    }

    if (!db) return;
    const ownerId = nameToId(state.currentInstructor || '');
    try {
      await db.collection('instructors').doc(ownerId).update({
        sessionsHiddenFromList: firebase.firestore.FieldValue.arrayUnion(sessionCode),
      });
    } catch (e) {
      store.showToast('Could not update list: ' + (e.message || e));
      return;
    }
    finishHide();
  };

  return { hideSession };
}
