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

// --- helpers ---
async function seedSession(code) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sessions').doc(code).set({
      sessionName: 'Seeded', ownerEmail: SF_EMAIL, instructorEmails: [SF_EMAIL],
    });
  });
}

// FieldValue.arrayUnion from the compat SDK, loaded lazily so the file parses
// even if firebase is not present when only linting.
async function loadFieldValue() {
  const mod = await import('firebase/compat/app');
  const firebase = mod.default;
  await import('firebase/compat/firestore');
  return { arrayUnion: firebase.firestore.FieldValue.arrayUnion };
}

// Keep node:test from reporting "no assertions" on env issues.
assert.ok(RULES.includes('service cloud.firestore'));
