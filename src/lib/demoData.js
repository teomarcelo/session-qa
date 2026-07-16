/**
 * Shared demo fixtures — the single source of truth for BOTH the instructor demo
 * (useInstructorStore) and the student demo (useStudentDemoStore). Keeping these
 * in one module guarantees the instructor's "Student view" preview shows exactly
 * the same seed data the instructor demo works from.
 *
 * Everything here is plain in-memory data. Nothing in this module ever touches
 * Firestore, Storage, or Auth.
 */
import { DEFAULT_STUDENT_ORG_CLAIM_URL } from './sessionLaunch.js';

export const DEMO_SESSION_CODE = 'SQA-DEMO';

// Demo teaching roster. The lead name MUST match the instructor name set in
// enterDemo() (useInstructorAuth.js) so the instructor "owns" the demo session
// (rename + roster render correctly).
export const DEMO_INSTRUCTOR_NAME = 'Alex Rivera (Demo)';
export const DEMO_CO_INSTRUCTORS = ['Jordan Rivera', 'Sam Lee'];

// Local mirror of nameToId() from useInstructorAuth.js. That module imports this
// data, so importing it back would create a circular dependency — keep this in
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
