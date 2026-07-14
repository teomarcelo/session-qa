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
  const unsubRef = useRef(null);

  const currentInstructor = useInstructorStore(s => s.currentInstructor);
  const instructorOwnerId = useInstructorStore(s => s.instructorOwnerId);
  const instructorLegacyOwnerId = useInstructorStore(s => s.instructorLegacyOwnerId);
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

    // Stable identity (email-based) plus the legacy name-based id, so sessions created
    // before the email-identity switch keep showing. Fall back to the display name id
    // if identity hasn't been set (e.g. legacy stored session with no SSO params).
    const ownerId = instructorOwnerId || nameToId(currentInstructor);
    const legacyId = instructorLegacyOwnerId && instructorLegacyOwnerId !== ownerId
      ? instructorLegacyOwnerId
      : null;
    const ownerIds = legacyId ? [ownerId, legacyId] : [ownerId];
    const sessionsQuery = ownerIds.length > 1
      ? db.collection('sessions').where('ownerId', 'in', ownerIds)
      : db.collection('sessions').where('ownerId', '==', ownerId);

    const unsub = sessionsQuery
      .onSnapshot(snap => {
        const owned = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by createdAt descending in JS (no orderBy to avoid composite index)
        owned.sort((a, b) => {
          const at = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
          const bt = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
          return bt - at;
        });

        // Load joined sessions + hidden list from the instructor doc(s). Read both the
        // stable and legacy ids and merge, since older data lives under the legacy id.
        Promise.all(ownerIds.map(id => db.collection('instructors').doc(id).get())).then(docs => {
          const joinedSet = new Set();
          const hiddenArr = [];
          docs.forEach(doc => {
            if (!doc.exists) return;
            const d = doc.data() || {};
            if (Array.isArray(d.joinedSessions)) d.joinedSessions.forEach(c => joinedSet.add(c));
            if (Array.isArray(d.sessionsHiddenFromList)) hiddenArr.push(...d.sessionsHiddenFromList);
          });
          const joinedCodes = [...joinedSet];
          const hiddenSet = new Set(hiddenArr);
          const applyHidden = (arr) => arr.filter(s => s && !hiddenSet.has(s.id));

          const mergeAndUpdate = (joined) => {
            const merged = applyHidden([...owned, ...joined]);
            useInstructorStore.getState().setAllSessions(merged);
            useInstructorStore.getState().setInstructorSessionsHydrated(true);
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
        useInstructorStore.getState().setAllSessions([]);
        useInstructorStore.getState().setInstructorSessionsHydrated(true);
        useInstructorStore.getState().showToast('Error loading sessions: ' + err.message);
      });

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [currentInstructor, instructorOwnerId, instructorLegacyOwnerId, isDemoMode, db]);

  function loadDemoSessions() {
    const hidden = getDemoHiddenSessionIds();
    const sessions = [DEMO_SESSION].filter(s => !hidden.includes(s.id));
    useInstructorStore.getState().setAllSessions(sessions);
    useInstructorStore.getState().setInstructorSessionsHydrated(true);

    if (sessions.length) {
      useInstructorStore.getState().setActiveSessionCode(DEMO_SESSION_CODE);
      const qs = DEMO_QUESTIONS_TEMPLATE.map(q => ({ ...q, voters: [...q.voters] }));
      useInstructorStore.getState().setQuestionPages([{ questions: qs, endSnap: null }]);
      useInstructorStore.getState().setCurrentPage(0);
      useInstructorStore.getState().setInstructorOlderBeyondLoadExhausted(true);
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
      useInstructorStore.getState().setActiveSessionCode(saved);
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
      useInstructorStore.getState().setAllSessions(newSessions);
      if (wasActive) {
        if (newSessions.length) {
          useInstructorStore.getState().setActiveSessionCode(newSessions[0].id);
        } else {
          useInstructorStore.getState().setActiveSessionCode(null);
          persistInstructorActiveSession(null);
        }
      }
      useInstructorStore.getState().showToast('Session hidden. Rejoin with the code anytime.');
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
    const ownerId = state.instructorOwnerId || nameToId(state.currentInstructor || '');
    try {
      // set(..., {merge:true}) so the doc is created if this is the instructor's first
      // write under the stable email-based id (older data lived under the legacy id).
      await db.collection('instructors').doc(ownerId).set({
        sessionsHiddenFromList: firebase.firestore.FieldValue.arrayUnion(sessionCode),
      }, { merge: true });
    } catch (e) {
      useInstructorStore.getState().showToast('Could not update list: ' + (e.message || e));
      return;
    }
    finishHide();
  };

  return { hideSession };
}
