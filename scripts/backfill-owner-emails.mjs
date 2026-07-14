/**
 * Backfill `ownerEmail` / `instructorEmails` on existing session docs so the
 * rewritten Firestore rules (which authorize instructor writes by verified
 * email) keep working for sessions created before the auth migration.
 *
 * SAFETY: defaults to --dry-run. It prints the intended writes and changes
 * NOTHING. Real writes require the explicit --commit flag.
 *
 *   # Preview (writes nothing):
 *   node scripts/backfill-owner-emails.mjs
 *   node scripts/backfill-owner-emails.mjs --dry-run
 *
 *   # Actually write (must pass --commit):
 *   node scripts/backfill-owner-emails.mjs --commit
 *
 * Resolving the owner email for a session:
 *   1) If the session already has a non-empty `ownerEmail`, it is kept.
 *   2) Otherwise it is looked up in OWNER_EMAIL_MAP — a JSON object keyed by
 *      session code AND/OR by ownerId — supplied via env (or a file):
 *        OWNER_EMAIL_MAP='{"SQA-AB12":"alex@salesforce.com","alex_r_salesforce_com":"alex@salesforce.com"}'
 *        OWNER_EMAIL_MAP_FILE=./owner-emails.json
 *   3) If still unresolved, the session is reported and skipped (never guessed).
 *
 * `instructorEmails` is ensured to be an array that includes the resolved
 * ownerEmail (existing entries are preserved and lowercased).
 *
 * Credentials / target (mirrors scripts/demo-co-instructor.mjs — same public
 * web config, overridable via env). Point at the emulator for a safe rehearsal:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/backfill-owner-emails.mjs
 * Run a real --commit BEFORE strict rules are deployed (so the client SDK is
 * still allowed to write), or against the emulator, or wire an Admin SDK
 * service account if you prefer to run it after enforcement.
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, collection, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCM_fXpm_F2a4-h04m18UPy472UmDaa8OE',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'tdx-qa.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'tdx-qa',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'tdx-qa.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '964102376485',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:964102376485:web:bfa3d741284a1ef20f03cc',
};

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const DRY_RUN = !COMMIT; // dry-run unless an explicit --commit is passed

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// Point at the local emulator when FIRESTORE_EMULATOR_HOST is set (safe rehearsal).
if (process.env.FIRESTORE_EMULATOR_HOST) {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host || '127.0.0.1', Number(port) || 8080);
}

/** Load the ownerId/code → email lookup map from env or a file. */
function loadOwnerEmailMap() {
  let raw = process.env.OWNER_EMAIL_MAP || '';
  const file = process.env.OWNER_EMAIL_MAP_FILE;
  if (!raw && file) {
    try { raw = readFileSync(file, 'utf8'); } catch (e) {
      console.warn(`Could not read OWNER_EMAIL_MAP_FILE (${file}): ${e.message}`);
    }
  }
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    // Normalize keys/values: keys kept as-is; emails lowercased.
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.includes('@')) out[k] = v.trim().toLowerCase();
    }
    return out;
  } catch (e) {
    console.warn(`OWNER_EMAIL_MAP is not valid JSON: ${e.message}`);
    return {};
  }
}

function lowerEmail(x) {
  return typeof x === 'string' ? x.trim().toLowerCase() : '';
}

function existingInstructorEmails(data) {
  const arr = Array.isArray(data.instructorEmails) ? data.instructorEmails : [];
  return arr.map(lowerEmail).filter(Boolean);
}

/**
 * Compute the intended change set for one session, or null if nothing to do.
 * Returns { updates, resolved, reason }.
 */
function planForSession(code, data, emailMap) {
  const currentOwner = lowerEmail(data.ownerEmail);
  const mapped = emailMap[code] || emailMap[data.ownerId] || '';
  const ownerEmail = currentOwner || mapped;

  const updates = {};
  if (!currentOwner && ownerEmail) updates.ownerEmail = ownerEmail;

  // Ensure instructorEmails is an array that includes the owner.
  const existing = existingInstructorEmails(data);
  let nextInstructors = existing.slice();
  if (ownerEmail && !nextInstructors.includes(ownerEmail)) nextInstructors.push(ownerEmail);
  const instructorsFieldMissingOrWrong = !Array.isArray(data.instructorEmails);
  if (
    (ownerEmail && !existing.includes(ownerEmail)) ||
    (instructorsFieldMissingOrWrong && nextInstructors.length)
  ) {
    updates.instructorEmails = nextInstructors;
  }

  if (!ownerEmail) {
    return { updates: {}, resolved: false, reason: 'no ownerEmail resolvable (add it to OWNER_EMAIL_MAP)' };
  }
  if (!Object.keys(updates).length) {
    return { updates: {}, resolved: true, reason: 'already backfilled' };
  }
  return { updates, resolved: true, reason: '' };
}

async function main() {
  const emailMap = loadOwnerEmailMap();
  console.log(`\nSession Q&A — ownerEmail / instructorEmails backfill`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'COMMIT (writing changes)'}`);
  console.log(`Project: ${FIREBASE_CONFIG.projectId}${process.env.FIRESTORE_EMULATOR_HOST ? ' (emulator)' : ''}`);
  console.log(`Owner-email map entries: ${Object.keys(emailMap).length}\n`);

  const snap = await getDocs(collection(db, 'sessions'));
  if (snap.empty) { console.log('No sessions found.'); return; }

  let toWrite = 0, skipped = 0, unchanged = 0, unresolved = 0;

  for (const d of snap.docs) {
    const code = d.id;
    const data = d.data() || {};
    const { updates, resolved, reason } = planForSession(code, data, emailMap);

    if (!resolved) {
      unresolved++;
      console.log(`  ⚠️  ${code}: SKIP — ${reason}`);
      continue;
    }
    if (!Object.keys(updates).length) {
      unchanged++;
      console.log(`  ✓  ${code}: ${reason}`);
      continue;
    }

    toWrite++;
    console.log(`  →  ${code}: set ${JSON.stringify(updates)}`);

    if (COMMIT) {
      try {
        await updateDoc(doc(db, 'sessions', code), updates);
        console.log(`     committed.`);
      } catch (e) {
        skipped++;
        console.log(`     FAILED: ${e.message}`);
      }
    }
  }

  console.log(`\nSummary: ${toWrite} to write, ${unchanged} already ok, ${unresolved} unresolved, ${skipped} failed.`);
  if (DRY_RUN && toWrite > 0) {
    console.log('Dry run only — no documents were modified. Re-run with --commit to apply.');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
