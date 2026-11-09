/**
 * Unit tests for src/lib/joinTracking.js (no Firebase, no emulator).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createJoinRecorder, joinFlagKey } from '../../src/lib/joinTracking.js';

/** Minimal fake of the compat Firestore chain used by the recorder. */
function fakeDb({ fail } = {}) {
  const writes = [];
  const db = {
    collection: (c1) => ({
      doc: (d1) => ({
        collection: (c2) => ({
          doc: (d2) => ({
            set: async (data) => {
              if (fail) { const e = new Error('denied'); e.code = 'permission-denied'; throw e; }
              writes.push({ path: `${c1}/${d1}/${c2}/${d2}`, data });
            },
          }),
        }),
      }),
    }),
  };
  return { db, writes };
}

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

const TS = { __ts: true };
const anonUser = { uid: 'anon-1', isAnonymous: true };

test('records one join at sessions/{code}/joins/{uid} with only a server timestamp', async () => {
  const { db, writes } = fakeDb();
  const storage = memStorage();
  const record = createJoinRecorder({ ensureUser: async () => anonUser, serverTimestamp: () => TS, storage });
  assert.equal(await record(db, 'SQA-AB12'), 'recorded');
  assert.deepEqual(writes, [{ path: 'sessions/SQA-AB12/joins/anon-1', data: { at: TS } }]);
  assert.equal(storage.getItem(joinFlagKey('SQA-AB12')), 'anon-1');
});

test('second call for the same session in the same browser does not write again', async () => {
  const { db, writes } = fakeDb();
  const record = createJoinRecorder({ ensureUser: async () => anonUser, serverTimestamp: () => TS, storage: memStorage() });
  await record(db, 'SQA-AB12');
  assert.equal(await record(db, 'SQA-AB12'), 'skipped');
  assert.equal(writes.length, 1);
  // A different session is a separate join.
  assert.equal(await record(db, 'SQA-CD34'), 'recorded');
  assert.equal(writes.length, 2);
});

test('a new anonymous identity in the same browser is recorded again', async () => {
  const { db, writes } = fakeDb();
  const storage = memStorage();
  let user = anonUser;
  const record = createJoinRecorder({ ensureUser: async () => user, serverTimestamp: () => TS, storage });
  await record(db, 'SQA-AB12');
  user = { uid: 'anon-2', isAnonymous: true };
  assert.equal(await record(db, 'SQA-AB12'), 'recorded');
  assert.equal(writes[1].path, 'sessions/SQA-AB12/joins/anon-2');
});

test('concurrent calls (auto-rejoin + join racing) write once', async () => {
  const { db, writes } = fakeDb();
  const record = createJoinRecorder({ ensureUser: async () => anonUser, serverTimestamp: () => TS, storage: memStorage() });
  await Promise.all([record(db, 'SQA-AB12'), record(db, 'SQA-AB12')]);
  assert.equal(writes.length, 1);
});

test('instructor (non-anonymous) identity is never recorded', async () => {
  const { db, writes } = fakeDb();
  const record = createJoinRecorder({
    ensureUser: async () => ({ uid: 'g-1', isAnonymous: false, email: 't@salesforce.com' }),
    serverTimestamp: () => TS,
    storage: memStorage(),
  });
  assert.equal(await record(db, 'SQA-AB12'), 'skipped');
  assert.equal(writes.length, 0);
});

test('auth unavailable, no db, or no code are skipped without throwing', async () => {
  const { db, writes } = fakeDb();
  const record = createJoinRecorder({ ensureUser: async () => null, serverTimestamp: () => TS, storage: memStorage() });
  assert.equal(await record(db, 'SQA-AB12'), 'skipped');
  assert.equal(await record(null, 'SQA-AB12'), 'skipped');
  assert.equal(await record(db, ''), 'skipped');
  assert.equal(writes.length, 0);
});

test('a rejected write never throws and leaves no flag, so it retries next load', async () => {
  const { db } = fakeDb({ fail: true });
  const storage = memStorage();
  const logs = [];
  const record = createJoinRecorder({ ensureUser: async () => anonUser, serverTimestamp: () => TS, storage, log: (...a) => logs.push(a) });
  assert.equal(await record(db, 'SQA-AB12'), 'failed');
  assert.equal(storage.getItem(joinFlagKey('SQA-AB12')), null);
  assert.equal(logs.length, 1);
});

test('ensureUser rejecting is contained', async () => {
  const { db } = fakeDb();
  const record = createJoinRecorder({ ensureUser: async () => { throw new Error('boom'); }, serverTimestamp: () => TS, storage: memStorage() });
  assert.equal(await record(db, 'SQA-AB12'), 'failed');
});

test('storage that throws (Safari private mode) does not break recording', async () => {
  const { db, writes } = fakeDb();
  const storage = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  const record = createJoinRecorder({ ensureUser: async () => anonUser, serverTimestamp: () => TS, storage });
  assert.equal(await record(db, 'SQA-AB12'), 'recorded');
  assert.equal(writes.length, 1);
});

test('flag key is sanitised', () => {
  assert.equal(joinFlagKey('SQA-AB12'), 'sqa_joined_SQA-AB12');
  assert.equal(joinFlagKey('SQA/../x'), 'sqa_joined_SQAx');
});
