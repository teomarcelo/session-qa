import { create } from 'zustand';
import { DEFAULT_STUDENT_ORG_CLAIM_URL } from '../../lib/sessionLaunch.js';

const DEMO_SESSION_CODE = 'SQA-DEMO';
export { DEMO_SESSION_CODE };

export const DEMO_SESSION = {
  id: DEMO_SESSION_CODE,
  sessionName: 'Agentforce Fundamentals — Track A',
  instructors: [],
  instructorNames: '',
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
  sessionNotes: [
    { id: 'demo-sn1', order: 0, title: 'Quick links', body: 'Example: https://trailhead.salesforce.com — appears under Session for students.', imageUrls: [], links: [{ url: 'https://trailhead.salesforce.com', label: 'Trailhead' }], show: true, instructor: 'Alex (demo)' },
    { id: 'demo-sn2', order: 1, title: 'Wi‑Fi', body: 'Network: `Conference-Guest`', imageUrls: [], links: [], show: true, instructor: 'Jordan (demo)' },
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
    text:'Do you need a specific Salesforce license to use Agentforce, or is it included with Enterprise?' },
  { id:'dq5', pinned:false, status:'pending',  authorName:'Daniel R.', authorEmail:'',                     authorId:'u5', votes:1,  voters:[], answer:'',
    text:'Can we use custom LLMs with Agentforce or is it locked to the Einstein models?' },
];

const useInstructorStore = create((set, get) => ({
  // Auth
  currentInstructor: null,
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

  // Actions
  setCurrentInstructor: (name) => set({ currentInstructor: name }),
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
  }),
}));

export default useInstructorStore;
