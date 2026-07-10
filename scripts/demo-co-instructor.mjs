/**
 * One-off helper to DEMO a co-instructor on a real session (and delete it after).
 *
 * Usage:
 *   node scripts/demo-co-instructor.mjs list
 *   node scripts/demo-co-instructor.mjs add <SESSION_CODE> "Display Name"
 *   node scripts/demo-co-instructor.mjs remove <SESSION_CODE> "Display Name"
 *
 * Mirrors what the app does on join: appends the name to the session's
 * `instructors` array (and `instructorNames`). Uses the same public Firebase web
 * config as the client. Safe to delete this file when you're done.
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, doc, getDoc, updateDoc,
} from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCM_fXpm_F2a4-h04m18UPy472UmDaa8OE',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'tdx-qa.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'tdx-qa',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'tdx-qa.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '964102376485',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:964102376485:web:bfa3d741284a1ef20f03cc',
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function rosterOf(data) {
  const d = data || {};
  return Array.isArray(d.instructors)
    ? d.instructors.map(n => String(n || '').trim()).filter(Boolean)
    : String(d.instructorNames || '').split(',').map(n => n.trim()).filter(Boolean);
}

async function list() {
  const snap = await getDocs(collection(db, 'sessions'));
  if (snap.empty) { console.log('No sessions found.'); return; }
  console.log('\nSessions:\n');
  snap.forEach(d => {
    const s = d.data() || {};
    const roster = rosterOf(s);
    const lead = String(s.ownerName || '').trim() || roster[0] || '(none)';
    const co = roster.filter(n => n !== lead);
    console.log(`  ${d.id}`);
    console.log(`    name: ${s.sessionName || '(untitled)'}`);
    console.log(`    lead: ${lead}`);
    console.log(`    co-instructors: ${co.length ? co.join(', ') : '(none)'}`);
    console.log('');
  });
}

async function mutate(action, code, name) {
  if (!code || !name) {
    console.error(`Usage: node scripts/demo-co-instructor.mjs ${action} <SESSION_CODE> "Display Name"`);
    process.exit(1);
  }
  const ref = doc(db, 'sessions', code);
  const d = await getDoc(ref);
  if (!d.exists()) { console.error(`Session ${code} not found.`); process.exit(1); }
  const roster = rosterOf(d.data());
  let next = roster;
  if (action === 'add') {
    if (roster.includes(name)) { console.log(`${name} already on ${code}.`); return; }
    next = [...roster, name];
  } else {
    next = roster.filter(n => n !== name);
    if (next.length === roster.length) { console.log(`${name} not found on ${code}.`); return; }
  }
  await updateDoc(ref, { instructors: next, instructorNames: next.join(', ') });
  console.log(`${action === 'add' ? 'Added' : 'Removed'} "${name}" ${action === 'add' ? 'to' : 'from'} ${code}.`);
  console.log(`Roster now: ${next.join(', ') || '(empty)'}`);
}

const [, , action, code, name] = process.argv;

if (action === 'list') {
  list().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (action === 'add' || action === 'remove') {
  mutate(action, code, name).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  console.log('Usage:');
  console.log('  node scripts/demo-co-instructor.mjs list');
  console.log('  node scripts/demo-co-instructor.mjs add <SESSION_CODE> "Display Name"');
  console.log('  node scripts/demo-co-instructor.mjs remove <SESSION_CODE> "Display Name"');
  process.exit(1);
}
