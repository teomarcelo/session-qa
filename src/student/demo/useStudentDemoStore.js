/**
 * Student in-memory demo store.
 *
 * When the student app is loaded as `student.html?demo=1` (only ever from the
 * instructor's "Student view" preview iframe), the whole app runs against this
 * tiny in-memory store instead of Firestore. It is seeded from the SHARED demo
 * fixtures (src/lib/demoData.js), so the student demo shows exactly the same
 * questions/feedback the instructor demo works from.
 *
 * HARD RULE: nothing here — and no code path gated by IS_STUDENT_DEMO — ever
 * touches Firestore, Firebase Storage, or Firebase Auth. All reads/writes are
 * local to this store.
 */
import { create } from 'zustand';
import {
  DEMO_SESSION_CODE,
  DEMO_INSTRUCTOR_NAME,
  freshDemoQuestions,
  freshDemoFeedback,
  freshDemoSession,
} from '../../lib/demoData.js';

/**
 * Stable, read-once flag: is this student page running in demo mode? Parsed from
 * the `?demo=1` URL param (mirrors how useStudentSession reads `?code=` for the
 * live instructor preview iframe). Defaults to false, so the real student flow
 * is completely unaffected when the param is absent.
 */
export const IS_STUDENT_DEMO = (() => {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch (e) {
    return false;
  }
})();

// Identity used for demo-submitted questions and votes. Stamped as authorId so
// "edit your own question" works, and used as the voter id for upvote toggles.
export const DEMO_STUDENT_USER_ID = 'demo-student';
export const DEMO_STUDENT_USER_NAME = 'Demo Student';

// Re-export the bits the demo hooks need so they have one import site.
export { DEMO_SESSION_CODE, DEMO_INSTRUCTOR_NAME, freshDemoSession };

const useStudentDemoStore = create((set) => ({
  // Seeded from the shared fixtures. Single page — no pagination in demo.
  questions: freshDemoQuestions(),
  feedback: freshDemoFeedback(),

  /** Prepend a newly-asked demo question (newest first, like the real board). */
  prependQuestion: (q) => set((s) => ({ questions: [q, ...s.questions] })),

  /** Update one question in place via an updater function. */
  updateQuestion: (id, updater) =>
    set((s) => ({
      questions: s.questions.map((q) => (q.id === id ? updater(q) : q)),
    })),

  /** Append an in-memory feedback entry (demo student → nowhere real). */
  addFeedback: (entry) => set((s) => ({ feedback: [entry, ...s.feedback] })),

  /** Re-seed fresh demo data (used if a same-page reset is ever needed). */
  reset: () => set({ questions: freshDemoQuestions(), feedback: freshDemoFeedback() }),
}));

export default useStudentDemoStore;
