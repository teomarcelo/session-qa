import { create } from 'zustand';
import { DEFAULT_STUDENT_ORG_CLAIM_URL } from '../../lib/sessionLaunch.js';

const DEMO_SESSION_CODE = 'SQA-DEMO';
export { DEMO_SESSION_CODE };

// Demo teaching roster. The lead name MUST match the instructor name set in
// enterDemo() (useInstructorAuth.js) so the instructor "owns" the demo session
// (rename + roster render correctly).
export const DEMO_INSTRUCTOR_NAME = 'Alex Rivera (Demo)';
export const DEMO_CO_INSTRUCTORS = ['Jordan Rivera', 'Sam Lee'];

// Local mirror of nameToId() from useInstructorAuth.js. That module imports this
// store, so importing it back would create a circular dependency — keep this in
// sync with nameToId if its logic ever changes.
function demoNameToId(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
export const DEMO_INSTRUCTOR_OWNER_ID = demoNameToId(DEMO_INSTRUCTOR_NAME);

const DEMO_INSTRUCTOR_ROSTER = [DEMO_INSTRUCTOR_NAME, ...DEMO_CO_INSTRUCTORS];

export const DEMO_SESSION = {
  id: DEMO_SESSION_CODE,
  sessionName: 'Agentforce Fundamentals — Track A',
  // Ownership + roster so the demo dashboard shows a Lead chip + co-instructors,
  // exactly like a real session. getSessionInstructorRoster() reads ownerName as
  // the lead and `instructors` (fallback instructorNames) for the full roster.
  ownerId: DEMO_INSTRUCTOR_OWNER_ID,
  ownerName: DEMO_INSTRUCTOR_NAME,
  instructors: DEMO_INSTRUCTOR_ROSTER,
  instructorNames: DEMO_INSTRUCTOR_ROSTER.join(', '),
  sessionDate: 'Apr 10, 2026',
  sessionTime: '10:00 AM',
  sessionTimezone: 'America/Los_Angeles',
  room: 'Hall D — Room 214',
  description: 'Intro to Agentforce: architecture, agent types, and how to build your first autonomous agent without code.',
  studentOrgClaimUrl: DEFAULT_STUDENT_ORG_CLAIM_URL,
  studentOrgClaimCopyText: 'DEMO-ORG-CODE',
  studentSurveyUrl: 'https://example.com',
  studentSurveyCopyText: 'EXAMPLE-COPY-CODE',
  sessionNoteShow: true,
  // Note bylines use the roster names so renaming the lead in demo also rewrites
  // the note they authored (mirrors the real per-session rename behavior).
  sessionNotes: [
    { id: 'demo-sn1', order: 0, title: 'Quick links', body: 'Example: https://trailhead.salesforce.com — appears under Session for students.', imageUrls: [], links: [{ url: 'https://trailhead.salesforce.com', label: 'Trailhead' }], show: true, instructor: DEMO_INSTRUCTOR_NAME },
    { id: 'demo-sn2', order: 1, title: 'Wi‑Fi', body: 'Network: `Conference-Guest`', imageUrls: [], links: [], show: true, instructor: DEMO_CO_INSTRUCTORS[0] },
  ],
};

export const DEMO_QUESTIONS_TEMPLATE = [
  { id:'dq1', pinned:true,  status:'pending',  authorName:'Maria S.',  authorEmail:'maria@trailblazer.io', authorId:'u1', votes:7,  voters:[], answer:'',
    text:'Can Agentforce agents trigger flows mid-conversation, or does the flow have to be invoked at the start of the action?' },
  { id:'dq2', pinned:false, status:'answered', answeredVerbally: true, authorName:'James K.',  authorEmail:'james@company.com',    authorId:'u2', votes:4,  voters:[], answer:"Great question! Agent Actions are the atomic steps an agent can take — think of them as the agent's toolkit. Flows are one type of action the agent can call.",
    text:"What's the difference between an Agent Action and a Flow in this context? They seem to overlap." },
  { id:'dq3', pinned:false, status:'answered', authorName:'Anonymous', authorEmail:'',                     authorId:'u3', votes:2,  voters:[], answer:"Currently the limit is 50 topics per agent in the Spring '26 release.",
    text:'Is there a limit on how many topics a single agent can handle?' },
  { id:'dq4', pinned:false, status:'pending',  authorName:'Priya M.',  authorEmail:'priya@sf-partner.com', authorId:'u4', votes:3,  voters:[], answer:'',
    imageUrls: ['https://placehold.co/560x180/1b1f23/ef4444?text=AgentError%3A+Topic+routing+failed%0ANo+matching+topic+found+for+intent%3A+%22check_order_status%22%0A(paste+a+screenshot+to+attach+it+to+your+question)'],
    text:'Getting this error when my agent tries to route — anyone else seen this? (pasted screenshot above — image paste is supported!)' },
  { id:'dq5', pinned:false, status:'pending',  authorName:'Daniel R.', authorEmail:'',                     authorId:'u5', votes:1,  voters:[], answer:'',
    text:'Can we use custom LLMs with Agentforce or is it locked to the Einstein models?' },
];

// Seed feedback shown in the instructor demo (SessionFeedbackList). Timestamps are
// computed once at module load so the demo shows realistic "x minutes ago" times.
const DEMO_FEEDBACK_BASE_MS = Date.now();
export const DEMO_FEEDBACK_TEMPLATE = [
  { id: 'df1', subject: 'Loved the live formatting', body: 'The bold/code formatting in the answers made it easy to follow along. Thank you!', submittedAtMs: DEMO_FEEDBACK_BASE_MS - 1000 * 60 * 7 },
  { id: 'df2', subject: 'A bit cramped on mobile', body: 'On my phone the question cards were a little tight, but everything still worked. Great session overall.', submittedAtMs: DEMO_FEEDBACK_BASE_MS - 1000 * 60 * 34 },
  { id: 'df3', subject: 'More Agentforce demos please', body: 'Would love a deeper dive into custom agent actions next time.', submittedAtMs: DEMO_FEEDBACK_BASE_MS - 1000 * 60 * 88 },
];

// Fresh copies of the demo fixtures. All demo state is in-memory only — nothing
// here ever touches Firestore.
export function freshDemoQuestions() {
  return DEMO_QUESTIONS_TEMPLATE.map(q => ({ ...q, voters: [...q.voters] }));
}
export function freshDemoFeedback() {
  return DEMO_FEEDBACK_TEMPLATE.map(f => ({ ...f }));
}
export function freshDemoSession() {
  // Deep clone so per-session mutations (renames, roster edits) never corrupt the
  // shared template that a later reset re-seeds from.
  return JSON.parse(JSON.stringify(DEMO_SESSION));
}

const useInstructorStore = create((set, get) => ({
  // Auth
  currentInstructor: null,      // editable DISPLAY name (what students see)
  instructorOwnerId: null,      // stable identity key (from verified Google email)
  instructorLegacyOwnerId: null,// pre-OAuth name-based id, still queried so old sessions show
  instructorEmail: null,        // verified Google email, when signed in via the gateway
  isDemoMode: false,

  // Sessions
  allSessions: [],
  activeSessionCode: null,
  instructorSessionsHydrated: false,

  // Questions
  questionPages: [],      // [{ questions: [...], endSnap }]
  currentPage: 0,
  questionsLoading: false,
  instructorOlderBeyondLoadExhausted: false,
  allQuestions: [],       // derived from questionPages[currentPage]

  // UI state
  currentFilter: 'all',   // 'all' | 'pinned' | 'pending' | 'answered'
  currentSort: 'recent',  // 'recent' | 'votes'
  searchQuery: '',

  // Answer editing
  answerDrafts: {},        // { [questionId]: string }
  pendingAnswerImages: {}, // { [questionId]: string[] }
  answerEditState: null,   // { qId, index } | null

  // Session notes editor
  sessionNotesDraft: [],
  sessionNoteShow: true,

  // Modals
  deleteTargetId: null,
  joinSessionModalOpen: false,
  createSessionModalOpen: false,

  // Student demo panel
  studentViewOpen: false,
  sdemoFilter: 'all',

  // Stats serial (cancels stale requests)
  statsSerial: 0,

  // Stats values (shown in sidebar)
  stats: { total: 0, answered: 0, pending: 0, pinned: 0 },

  // Toast
  toast: { message: '', visible: false },

  // Demo-only, in-memory session feedback (seeded + appended from the demo
  // student view; never read from or written to Firestore).
  demoFeedback: freshDemoFeedback(),
  // Bumped on Reset Demo so the demo student view remounts and clears its local
  // UI state (voters, edit drafts, search, sort, feed toggle).
  demoResetNonce: 0,

  // Actions
  setCurrentInstructor: (name) => set({ currentInstructor: name }),
  // Set the stable identity separately from the display name. ownerId is required;
  // legacyOwnerId/email are optional (null when unknown, e.g. demo or direct access).
  setInstructorIdentity: ({ ownerId, legacyOwnerId = null, email = null }) => set({
    instructorOwnerId: ownerId || null,
    instructorLegacyOwnerId: legacyOwnerId || null,
    instructorEmail: email || null,
  }),
  setIsDemoMode: (val) => set({ isDemoMode: val }),
  setAllSessions: (sessions) => set({ allSessions: sessions }),
  setActiveSessionCode: (code) => set({ activeSessionCode: code }),

  setQuestionPages: (pages) => set((state) => {
    const cur = pages[state.currentPage];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    return { questionPages: pages, allQuestions };
  }),

  setCurrentPage: (page) => set((state) => {
    const cur = state.questionPages[page];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    return { currentPage: page, allQuestions };
  }),

  rebuildAllQuestions: () => set((state) => {
    const cur = state.questionPages[state.currentPage];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    return { allQuestions };
  }),

  setCurrentFilter: (f) => set({ currentFilter: f }),
  setCurrentSort: (s) => set({ currentSort: s }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  setAnswerDraft: (qId, text) => set(state => ({ answerDrafts: { ...state.answerDrafts, [qId]: text } })),
  clearAnswerDraft: (qId) => set(state => {
    const drafts = { ...state.answerDrafts };
    delete drafts[qId];
    return { answerDrafts: drafts };
  }),
  setPendingAnswerImages: (qId, urls) => set(state => ({ pendingAnswerImages: { ...state.pendingAnswerImages, [qId]: urls } })),
  clearPendingAnswerImages: (qId) => set(state => {
    const imgs = { ...state.pendingAnswerImages };
    delete imgs[qId];
    return { pendingAnswerImages: imgs };
  }),
  setAnswerEditState: (editState) => set({ answerEditState: editState }),

  setSessionNotesDraft: (notes) => set({ sessionNotesDraft: notes }),
  setSessionNoteShow: (val) => set({ sessionNoteShow: val }),

  setDeleteTargetId: (id) => set({ deleteTargetId: id }),
  openDeleteModal: (id) => set({ deleteTargetId: id }),
  closeDeleteModal: () => set({ deleteTargetId: null }),

  setJoinSessionModalOpen: (v) => set({ joinSessionModalOpen: v }),
  setCreateSessionModalOpen: (v) => set({ createSessionModalOpen: v }),

  setStudentViewOpen: (v) => set({ studentViewOpen: v }),
  setSdemoFilter: (f) => set({ sdemoFilter: f }),

  incrementStatsSerial: () => set(state => ({ statsSerial: state.statsSerial + 1 })),
  setStats: (stats) => set({ stats }),

  setInstructorSessionsHydrated: (v) => set({ instructorSessionsHydrated: v }),
  setQuestionsLoading: (v) => set({ questionsLoading: v }),
  setInstructorOlderBeyondLoadExhausted: (v) => set({ instructorOlderBeyondLoadExhausted: v }),

  showToast: (message) => {
    set({ toast: { message, visible: true } });
    setTimeout(() => set({ toast: { message: '', visible: false } }), 2500);
  },

  // Prepend an in-memory feedback entry (demo student view → instructor feedback list).
  addDemoFeedback: (entry) => set(state => ({ demoFeedback: [entry, ...state.demoFeedback] })),

  // Re-seed ALL demo data + reset the demo-facing UI state in one place. Shared by
  // both Reset Demo buttons (instructor top bar + student view overlay) so they can
  // never drift. Only demo/UI state is touched — never real/authed state.
  resetDemoState: () => set(state => {
    const qs = freshDemoQuestions();
    return {
      currentInstructor: DEMO_INSTRUCTOR_NAME,
      allSessions: [freshDemoSession()],
      activeSessionCode: DEMO_SESSION_CODE,
      questionPages: [{ questions: qs, endSnap: null }],
      currentPage: 0,
      allQuestions: qs,
      instructorOlderBeyondLoadExhausted: true,
      currentFilter: 'all',
      currentSort: 'recent',
      sdemoFilter: 'all',
      searchQuery: '',
      answerDrafts: {},
      pendingAnswerImages: {},
      answerEditState: null,
      demoFeedback: freshDemoFeedback(),
      demoResetNonce: state.demoResetNonce + 1,
    };
  }),

  // Update a question in-place within all pages (for demo mode mutations)
  updateQuestionInPages: (qId, updater) => set(state => {
    const questionPages = state.questionPages.map(page => ({
      ...page,
      questions: page.questions.map(q => q.id === qId ? updater(q) : q),
    }));
    const cur = questionPages[state.currentPage];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    return { questionPages, allQuestions };
  }),

  // Remove a question from all pages (for delete)
  removeQuestionFromPages: (qId) => set(state => {
    const questionPages = state.questionPages.map(page => ({
      ...page,
      questions: page.questions.filter(q => q.id !== qId),
    }));
    const cur = questionPages[state.currentPage];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    const answerDrafts = { ...state.answerDrafts };
    const pendingAnswerImages = { ...state.pendingAnswerImages };
    delete answerDrafts[qId];
    delete pendingAnswerImages[qId];
    return { questionPages, allQuestions, answerDrafts, pendingAnswerImages };
  }),

  // Prepend a question to page 0 (for sdemo submit)
  prependQuestion: (q) => set(state => {
    const questionPages = state.questionPages.length > 0
      ? state.questionPages.map((page, i) => i === 0
          ? { ...page, questions: [q, ...page.questions] }
          : page
        )
      : [{ questions: [q], endSnap: null }];
    const cur = questionPages[state.currentPage];
    const allQuestions = cur && cur.questions ? cur.questions.slice() : [];
    return { questionPages, allQuestions };
  }),

  // Full reset for logout / new login
  resetForLogin: () => set({
    currentInstructor: null,
    instructorOwnerId: null,
    instructorLegacyOwnerId: null,
    instructorEmail: null,
    isDemoMode: false,
    allSessions: [],
    activeSessionCode: null,
    instructorSessionsHydrated: false,
    questionPages: [],
    currentPage: 0,
    questionsLoading: false,
    instructorOlderBeyondLoadExhausted: false,
    allQuestions: [],
    currentFilter: 'all',
    currentSort: 'recent',
    searchQuery: '',
    answerDrafts: {},
    pendingAnswerImages: {},
    answerEditState: null,
    sessionNotesDraft: [],
    sessionNoteShow: true,
    deleteTargetId: null,
    joinSessionModalOpen: false,
    createSessionModalOpen: false,
    studentViewOpen: false,
    sdemoFilter: 'all',
    stats: { total: 0, answered: 0, pending: 0, pinned: 0 },
    demoFeedback: freshDemoFeedback(),
    demoResetNonce: 0,
  }),
}));

export default useInstructorStore;
