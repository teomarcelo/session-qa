/**
 * Firestore security-rules unit tests (run on the Firestore emulator).
 *
 * How to run:
 *   npm run test:rules
 * which wraps this file in `firebase emulators:exec --only firestore ...`, so the
 * emulator is started, tests run against it, and it shuts down automatically.
 * Requires the Firebase Local Emulator Suite (Java 11+). No production project is
 * touched — everything runs against a throwaway `demo-*` project id.
 *
 * Coverage (matches the QA plan):
 *   - salesforce-email instructor write ALLOWED (session create/update, question
 *     answer + delete)
 *   - non-salesforce email DENIED
 *   - anonymous student question create allowed ONLY when authorUid == uid
 *   - upvotes allowed for any signed-in user; deletes restricted to instructors
 *   - legacy docs (no ownerEmail / no authorUid) tolerated
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(__dirname, '..', 'firestore.rules'), 'utf8');

let testEnv;

// --- Identity fixtures ---
const SF_EMAIL = 'teacher@salesforce.com';
const SF2_EMAIL = 'coteacher@salesforce.com';

function salesforce(uid = 'inst1', email = SF_EMAIL) {
  return testEnv.authenticatedContext(uid, { email, email_verified: true }).firestore();
}
function nonSalesforce(uid = 'ext1', email = 'someone@gmail.com') {
  return testEnv.authenticatedContext(uid, { email, email_verified: true }).firestore();
}
function anon(uid = 'stud1') {
  // Anonymous student: signed in, no email on the token.
  return testEnv.authenticatedContext(uid).firestore();
}
function unauthed() {
  return testEnv.unauthenticatedContext().firestore();
}

function validQuestion(authorUid, over = {}) {
  return {
    text: 'How does Agentforce routing work?',
    authorName: 'Student',
    authorEmail: '',
    authorId: 'local-abc',
    authorUid,
    createdAt: Date.now(),
    status: 'pending',
    pinned: false,
    votes: 0,
    voters: [],
    answer: '',
    ...over,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-session-qa',
    firestore: { rules: RULES },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test('sessions: salesforce instructor can create a session they own', async () => {
  await testEnv.clearFirestore();
  const db = salesforce();
  await assertSucceeds(
    db.collection('sessions').doc('SQA-AAAA').set({
      sessionName: 'Track A',
      ownerEmail: SF_EMAIL,
      instructorEmails: [SF_EMAIL],
    }),
  );
});

test('sessions: non-salesforce email cannot create a session', async () => {
  await testEnv.clearFirestore();
  const db = nonSalesforce();
  await assertFails(
    db.collection('sessions').doc('SQA-BBBB').set({
      sessionName: 'Track B',
      ownerEmail: 'someone@gmail.com',
      instructorEmails: ['someone@gmail.com'],
    }),
  );
});

test('sessions: create denied when ownerEmail does not match the caller', async () => {
  await testEnv.clearFirestore();
  const db = salesforce();
  await assertFails(
    db.collection('sessions').doc('SQA-CCCC').set({
      sessionName: 'Spoofed owner',
      ownerEmail: SF2_EMAIL, // not the caller's email
      instructorEmails: [SF2_EMAIL],
    }),
  );
});

test('sessions: owner can update, co-instructor can update, outsider cannot', async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-DDDD').set({
      sessionName: 'Owned',
      ownerEmail: SF_EMAIL,
      instructorEmails: [SF_EMAIL, SF2_EMAIL],
    });
  });
  await assertSucceeds(salesforce('inst1', SF_EMAIL).collection('sessions').doc('SQA-DDDD').update({ room: 'Hall D' }));
  await assertSucceeds(salesforce('inst2', SF2_EMAIL).collection('sessions').doc('SQA-DDDD').update({ room: 'Hall E' }));
  await assertFails(salesforce('inst3', 'stranger@salesforce.com').collection('sessions').doc('SQA-DDDD').update({ room: 'Hall Z' }));
});

test('sessions: legacy doc without ownerEmail is tolerated for salesforce updates', async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-LEGA').set({
      sessionName: 'Legacy session',
      ownerId: 'some_name', // pre-migration shape, no ownerEmail
    });
  });
  await assertSucceeds(salesforce().collection('sessions').doc('SQA-LEGA').update({ room: 'Room 1' }));
  await assertFails(nonSalesforce().collection('sessions').doc('SQA-LEGA').update({ room: 'Room 2' }));
});

test('sessions: salesforce instructor can self-join a session as co-instructor', async () => {
  await testEnv.clearFirestore();
  const { arrayUnion } = await loadFieldValue();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-JOIN').set({
      sessionName: 'Joinable',
      ownerEmail: SF_EMAIL,
      instructorEmails: [SF_EMAIL],
    });
  });
  // A different salesforce instructor appends themselves.
  await assertSucceeds(
    salesforce('inst2', SF2_EMAIL)
      .collection('sessions')
      .doc('SQA-JOIN')
      .update({ instructorEmails: arrayUnion(SF2_EMAIL) }),
  );
});

test('questions: signed-in student can create when authorUid matches uid', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q1');
  const db = anon('stud1');
  await assertSucceeds(
    db.collection('sessions').doc('SQA-Q1').collection('questions').add(validQuestion('stud1')),
  );
});

test('questions: create denied when authorUid != uid (spoofing)', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q2');
  const db = anon('stud1');
  await assertFails(
    db.collection('sessions').doc('SQA-Q2').collection('questions').add(validQuestion('someone-else')),
  );
});

test('questions: unauthenticated cannot create a question', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q3');
  const db = unauthed();
  await assertFails(
    db.collection('sessions').doc('SQA-Q3').collection('questions').add(validQuestion('anon')),
  );
});

test('questions: create denied when arriving pre-voted / pre-pinned', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q4');
  const db = anon('stud1');
  await assertFails(
    db.collection('sessions').doc('SQA-Q4').collection('questions').add(validQuestion('stud1', { votes: 5 })),
  );
  await assertFails(
    db.collection('sessions').doc('SQA-Q4').collection('questions').add(validQuestion('stud1', { pinned: true })),
  );
});

test('questions: any signed-in user may upvote (votes/voters only)', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q5');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-Q5').collection('questions').doc('q1')
      .set(validQuestion('author-uid'));
  });
  const db = anon('voter1');
  await assertSucceeds(
    db.collection('sessions').doc('SQA-Q5').collection('questions').doc('q1')
      .update({ votes: 1, voters: ['voter1'] }),
  );
  // Changing a non-vote field via the vote path is denied.
  await assertFails(
    db.collection('sessions').doc('SQA-Q5').collection('questions').doc('q1')
      .update({ votes: 2, voters: ['voter1'], status: 'answered' }),
  );
});

test('questions: author can edit own text; instructor can answer', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q6');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-Q6').collection('questions').doc('q1')
      .set(validQuestion('author-uid'));
  });
  // Author edits their own text.
  await assertSucceeds(
    anon('author-uid').collection('sessions').doc('SQA-Q6').collection('questions').doc('q1')
      .update({ text: 'edited text' }),
  );
  // A different student cannot edit the text.
  await assertFails(
    anon('other-uid').collection('sessions').doc('SQA-Q6').collection('questions').doc('q1')
      .update({ text: 'hijacked' }),
  );
  // Salesforce instructor answers (multi-field update).
  await assertSucceeds(
    salesforce().collection('sessions').doc('SQA-Q6').collection('questions').doc('q1')
      .update({ status: 'answered', answer: 'Here you go', pinned: true }),
  );
});

test('questions: only salesforce instructors can delete', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-Q7');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-Q7').collection('questions').doc('q1')
      .set(validQuestion('author-uid'));
  });
  await assertFails(anon('author-uid').collection('sessions').doc('SQA-Q7').collection('questions').doc('q1').delete());
  await assertFails(nonSalesforce().collection('sessions').doc('SQA-Q7').collection('questions').doc('q1').delete());
  await assertSucceeds(salesforce().collection('sessions').doc('SQA-Q7').collection('questions').doc('q1').delete());
});

test('feedback: signed-in create allowed with exact shape; extra field denied', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-F1');
  const db = anon('stud1');
  await assertSucceeds(
    db.collection('sessions').doc('SQA-F1').collection('sessionFeedback').add({
      subject: 'Great class', body: 'Loved it', submittedAtMs: Date.now(),
    }),
  );
  // Extra key breaks the exact-shape rule.
  await assertFails(
    db.collection('sessions').doc('SQA-F1').collection('sessionFeedback').add({
      subject: 'x', body: 'y', submittedAtMs: Date.now(), authorUid: 'stud1',
    }),
  );
});

test('feedback: only salesforce instructors can read feedback', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-F2');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc('SQA-F2').collection('sessionFeedback').doc('f1')
      .set({ subject: 's', body: 'b', submittedAtMs: Date.now() });
  });
  await assertSucceeds(salesforce().collection('sessions').doc('SQA-F2').collection('sessionFeedback').doc('f1').get());
  await assertFails(anon('stud1').collection('sessions').doc('SQA-F2').collection('sessionFeedback').doc('f1').get());
});

// ─────────────────────────────────────────────────────────────────────────────
// Session takeover via the co-instructor "join" path.
// A verified salesforce identity is a large trust boundary (every employee), so
// self-joining must not double as a way to edit or seize someone else's session.
// ─────────────────────────────────────────────────────────────────────────────

/** Session owned by SF_EMAIL with SF2_EMAIL already on the roster. */
async function seedOwnedSession(code) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc(code).set({
      sessionName: 'Owned',
      ownerEmail: SF_EMAIL,
      instructorEmails: [SF_EMAIL, SF2_EMAIL],
      instructors: ['Teacher', 'Coteacher'],
      instructorNames: 'Teacher, Coteacher',
    });
  });
}

const MALLORY = 'mallory@salesforce.com';

test('sessions: self-join cannot smuggle content edits into the same write', async () => {
  await testEnv.clearFirestore();
  await seedOwnedSession('SQA-HJ1');
  const { arrayUnion } = await loadFieldValue();
  await assertFails(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ1').update({
      instructorEmails: arrayUnion(MALLORY),
      sessionName: 'Hijacked',
    }),
  );
});

test('sessions: self-join cannot delete ownerEmail (legacy-doc escalation)', async () => {
  await testEnv.clearFirestore();
  await seedOwnedSession('SQA-HJ2');
  const { deleteField } = await loadFieldValue();
  // Dropping ownerEmail would demote the session to a "legacy" doc, which
  // legacySession() then lets ANY salesforce user rewrite or delete.
  await assertFails(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ2').update({
      instructorEmails: [MALLORY],
      ownerEmail: deleteField(),
    }),
  );
});

test('sessions: self-join cannot drop existing instructors from the roster', async () => {
  await testEnv.clearFirestore();
  await seedOwnedSession('SQA-HJ3');
  // Replacing (rather than appending to) instructorEmails evicts the owner and
  // co-instructor from the allow-list.
  await assertFails(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ3').update({
      instructorEmails: [MALLORY],
    }),
  );
  await assertFails(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ3').update({
      instructorEmails: [SF_EMAIL, SF2_EMAIL, MALLORY],
      instructors: ['Mallory'],
      instructorNames: 'Mallory',
    }),
  );
});

test('sessions: self-join cannot add someone other than the caller', async () => {
  await testEnv.clearFirestore();
  await seedOwnedSession('SQA-HJ4');
  const { arrayUnion } = await loadFieldValue();
  await assertFails(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ4').update({
      instructorEmails: arrayUnion(MALLORY, 'accomplice@salesforce.com'),
    }),
  );
});

test('sessions: the real join flow (roster + email append) still works', async () => {
  await testEnv.clearFirestore();
  await seedOwnedSession('SQA-HJ5');
  const { arrayUnion } = await loadFieldValue();
  // Exactly what JoinSessionModal writes: append the display name to the roster
  // and the verified email to the allow-list, in one update.
  await assertSucceeds(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ5').update({
      instructors: ['Teacher', 'Coteacher', 'Mallory'],
      instructorNames: 'Teacher, Coteacher, Mallory',
      instructorEmails: arrayUnion(MALLORY),
    }),
  );
  // ...and once joined, they are a co-instructor with normal edit rights.
  await assertSucceeds(
    salesforce('mal', MALLORY).collection('sessions').doc('SQA-HJ5').update({ room: 'Hall F' }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Instructor accounts: display name + PIN hash + joined-session lists.
// ─────────────────────────────────────────────────────────────────────────────

/** Doc id the app derives from a verified email (see emailToId in the client). */
const SF_DOC_ID = 'teacher_salesforce_com';

async function seedInstructorDoc(id = SF_DOC_ID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('instructors').doc(id).set({
      displayName: 'Teacher',
      pinHash: 'deadbeef',
      joinedSessions: [],
      sessionsHiddenFromList: [],
    });
  });
}

test('instructors: unauthenticated read is denied (PIN hashes are not public)', async () => {
  await testEnv.clearFirestore();
  await seedInstructorDoc();
  await assertFails(unauthed().collection('instructors').doc(SF_DOC_ID).get());
  await assertFails(anon('stud1').collection('instructors').doc(SF_DOC_ID).get());
});

test('instructors: a verified salesforce instructor can read', async () => {
  await testEnv.clearFirestore();
  await seedInstructorDoc();
  await assertSucceeds(salesforce().collection('instructors').doc(SF_DOC_ID).get());
});

test('instructors: cannot write another instructor account', async () => {
  await testEnv.clearFirestore();
  await seedInstructorDoc();
  // Overwriting someone else's pinHash / displayName must be denied.
  await assertFails(
    salesforce('mal', MALLORY).collection('instructors').doc(SF_DOC_ID).update({
      pinHash: 'attacker-controlled',
    }),
  );
  await assertFails(
    salesforce('mal', MALLORY)
      .collection('instructors')
      .doc(SF_DOC_ID)
      .set({ displayName: 'Mallory', pinHash: 'x' }, { merge: true }),
  );
});

test('instructors: can write their own email-derived account doc', async () => {
  await testEnv.clearFirestore();
  const { arrayUnion } = await loadFieldValue();
  // Create (first join) and then update, exactly as the join / hide flows do.
  await assertSucceeds(
    salesforce()
      .collection('instructors')
      .doc(SF_DOC_ID)
      .set({ joinedSessions: ['SQA-AAAA'], sessionsHiddenFromList: [] }, { merge: true }),
  );
  await assertSucceeds(
    salesforce().collection('instructors').doc(SF_DOC_ID).update({
      sessionsHiddenFromList: arrayUnion('SQA-BBBB'),
    }),
  );
});

test('instructors: dotted emails map to the same doc id the client uses', async () => {
  await testEnv.clearFirestore();
  // emailToId('first.last@salesforce.com') === 'first_last_salesforce_com', so
  // every non-alphanumeric run must collapse, not just the first one.
  const db = salesforce('inst5', 'First.Last@salesforce.com');
  await assertSucceeds(
    db.collection('instructors').doc('first_last_salesforce_com').set({ displayName: 'First' }),
  );
  await assertFails(
    db.collection('instructors').doc('first.last_salesforce_com').set({ displayName: 'First' }),
  );
});

test('instructors: deletion stays blocked', async () => {
  await testEnv.clearFirestore();
  await seedInstructorDoc();
  await assertFails(salesforce().collection('instructors').doc(SF_DOC_ID).delete());
});

// ─────────────────────────────────────────────────────────────────────────────
// Vote integrity. Anonymous identities are unlimited, so the rules cannot stop
// sockpuppets, but a single write must not be able to forge or destroy tallies.
// ─────────────────────────────────────────────────────────────────────────────

async function seedQuestion(code, { votes = 0, voters = [] } = {}) {
  await seedSession(code);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection('sessions')
      .doc(code)
      .collection('questions')
      .doc('q1')
      .set(validQuestion('author-uid', { votes, voters }));
  });
}

function questionRef(db, code) {
  return db.collection('sessions').doc(code).collection('questions').doc('q1');
}

test('votes: cannot inflate the counter', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V1');
  await assertFails(
    questionRef(anon('voter1'), 'SQA-V1').update({ votes: 9999, voters: ['voter1'] }),
  );
});

test('votes: cannot raise the counter without joining the voters list', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V2');
  await assertFails(questionRef(anon('voter1'), 'SQA-V2').update({ votes: 1, voters: [] }));
});

test('votes: cannot wipe or remove other people votes', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V3', { votes: 3, voters: ['a', 'b', 'c'] });
  await assertFails(questionRef(anon('mal'), 'SQA-V3').update({ votes: 0, voters: [] }));
  await assertFails(
    questionRef(anon('mal'), 'SQA-V3').update({ votes: 2, voters: ['a', 'b'] }),
  );
});

test('votes: cannot vote on behalf of another uid', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V4');
  await assertFails(
    questionRef(anon('voter1'), 'SQA-V4').update({ votes: 1, voters: ['someone-else'] }),
  );
});

test('votes: cannot double-vote', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V5', { votes: 1, voters: ['voter1'] });
  await assertFails(
    questionRef(anon('voter1'), 'SQA-V5').update({ votes: 2, voters: ['voter1', 'voter1'] }),
  );
});

test('votes: a single up-vote and un-vote by the caller succeed', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V6', { votes: 1, voters: ['other'] });
  const { arrayUnion, arrayRemove, increment } = await loadFieldValue();
  // Up-vote, written exactly the way useUpvote does.
  await assertSucceeds(
    questionRef(anon('voter1'), 'SQA-V6').update({
      votes: increment(1),
      voters: arrayUnion('voter1'),
    }),
  );
  // Un-vote.
  await assertSucceeds(
    questionRef(anon('voter1'), 'SQA-V6').update({
      votes: increment(-1),
      voters: arrayRemove('voter1'),
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Question field validation and feedback scoping.
// ─────────────────────────────────────────────────────────────────────────────

test('questions: unknown fields are rejected at creation', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-K1');
  const db = anon('stud1');
  await assertFails(
    db
      .collection('sessions')
      .doc('SQA-K1')
      .collection('questions')
      .add(validQuestion('stud1', { smuggled: 'x'.repeat(5000) })),
  );
  // The fields the client actually writes are still accepted.
  await assertSucceeds(
    db
      .collection('sessions')
      .doc('SQA-K1')
      .collection('questions')
      .add(validQuestion('stud1', { imageUrls: ['https://example.com/a.jpg'] })),
  );
});

test('questions: author edits cannot exceed the text cap', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-K2');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection('sessions')
      .doc('SQA-K2')
      .collection('questions')
      .doc('q1')
      .set(validQuestion('author-uid'));
  });
  const ref = questionRef(anon('author-uid'), 'SQA-K2');
  await assertFails(ref.update({ text: 'x'.repeat(10001) }));
  await assertSucceeds(ref.update({ text: 'a reasonable edit' }));
});

test('feedback: an instructor cannot read another session feedback', async () => {
  await testEnv.clearFirestore();
  await seedSession('SQA-F3'); // owned by SF_EMAIL
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection('sessions')
      .doc('SQA-F3')
      .collection('sessionFeedback')
      .doc('f1')
      .set({ subject: 's', body: 'b', submittedAtMs: Date.now() });
  });
  // Owner can read; an unrelated salesforce instructor cannot.
  await assertSucceeds(
    salesforce().collection('sessions').doc('SQA-F3').collection('sessionFeedback').doc('f1').get(),
  );
  await assertFails(
    salesforce('mal', MALLORY)
      .collection('sessions')
      .doc('SQA-F3')
      .collection('sessionFeedback')
      .doc('f1')
      .get(),
  );
});

test('votes: instructors keep full update rights', async () => {
  await testEnv.clearFirestore();
  await seedQuestion('SQA-V7', { votes: 2, voters: ['a', 'b'] });
  await assertSucceeds(
    questionRef(salesforce(), 'SQA-V7').update({ status: 'answered', pinned: true }),
  );
});

// --- helpers ---
async function seedSession(code) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc(code).set({
      sessionName: 'Seeded', ownerEmail: SF_EMAIL, instructorEmails: [SF_EMAIL],
    });
  });
}

// FieldValue sentinels from the compat SDK, loaded lazily so the file parses
// even if firebase is not present when only linting.
async function loadFieldValue() {
  const mod = await import('firebase/compat/app');
  const firebase = mod.default;
  await import('firebase/compat/firestore');
  const FieldValue = firebase.firestore.FieldValue;
  return {
    arrayUnion: FieldValue.arrayUnion,
    arrayRemove: FieldValue.arrayRemove,
    increment: FieldValue.increment,
    deleteField: FieldValue.delete,
  };
}

// Keep node:test from reporting "no assertions" on env issues.
assert.ok(RULES.includes('service cloud.firestore'));
