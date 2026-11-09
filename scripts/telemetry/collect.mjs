/**
 * Session Q&A — private usage telemetry collector (owner-only, local-only).
 *
 * WHAT IT DOES
 *   Reads production Firestore + Firebase Storage metadata with YOUR gcloud
 *   Application Default Credentials, reduces it to an anonymised dataset, and
 *   writes a self-contained dashboard to ~/.session-qa/telemetry/ (mode 0600).
 *
 * WHY IT IS PRIVATE
 *   - Nothing here is served by Vite or Firebase Hosting: the script lives in
 *     scripts/, and its output lives in your home directory, outside the repo,
 *     outside dist/, and outside every deploy target.
 *   - Access to production data is gated by Google IAM on the tdx-qa project,
 *     not by firestore.rules, so no rules change is needed (or made).
 *
 * SAFETY
 *   - READ-ONLY. The request helper below refuses every method except GET and
 *     the two read-only Firestore POST endpoints (runQuery / runAggregationQuery).
 *   - No student names, emails, question text, or answer text are written out.
 *     Students are counted by a salted SHA-256 of their uid/localStorage id.
 *   - Cost: about one Firestore read per document (≈330 today) — far inside the
 *     50k/day free tier.
 *
 * USAGE
 *   gcloud auth application-default login     # once, if the token has expired
 *   npm run telemetry                         # collect + open the dashboard
 *   npm run telemetry -- --no-open            # collect only
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));

const PROJECT = process.env.TELEMETRY_PROJECT || 'tdx-qa';
const BUCKET = process.env.TELEMETRY_BUCKET || 'tdx-qa.firebasestorage.app';
const OUT_DIR = process.env.TELEMETRY_OUT_DIR || join(homedir(), '.session-qa', 'telemetry');
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const GCS_BASE = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o`;
const NO_OPEN = process.argv.includes('--no-open');
const REPO_ROOT = join(HERE, '..', '..');

// Load-test rooms seeded by scripts/prod-load-test.mjs. Flagged, not dropped,
// so the dashboard can toggle them.
const TEST_CODE_RE = /^SQA-HTA\d$/i;
const TEST_NAME_RE = /^(loadtest|test\d*|demo)\b/i;

// ── Auth ─────────────────────────────────────────────────────────────────────
async function getAccessToken() {
  try {
    const { stdout } = await run('gcloud', ['auth', 'application-default', 'print-access-token']);
    const token = stdout.trim();
    if (!token) throw new Error('empty token');
    return token;
  } catch (err) {
    throw new Error(
      'Could not get a Google access token. Run `gcloud auth application-default login` '
      + `with an account that can read project ${PROJECT}. (${err.message})`,
      { cause: err },
    );
  }
}

// ── Read-only HTTP helper ────────────────────────────────────────────────────
const READ_ONLY_POSTS = [/:runQuery$/, /:runAggregationQuery$/];

function makeClient(token) {
  let reads = 0;
  async function request(url, { method = 'GET', body } = {}) {
    // Hard guard: this tool must never be able to write to production.
    const allowed = method === 'GET'
      || (method === 'POST' && READ_ONLY_POSTS.some((re) => re.test(new URL(url).pathname)));
    if (!allowed) throw new Error(`Refusing non-read request: ${method} ${url}`);

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': PROJECT,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    reads += 1;
    return res.json();
  }
  return { request, get requests() { return reads; } };
}

// ── Firestore REST value decoding ────────────────────────────────────────────
function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}
function decodeDoc(doc) {
  return {
    id: doc.name.split('/').pop(),
    createTime: doc.createTime,
    ...decodeFields(doc.fields),
  };
}

/** List every document in a collection (paginated, optional field mask). */
async function listCollection(client, path, mask = []) {
  const docs = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ pageSize: '300' });
    for (const f of mask) qs.append('mask.fieldPaths', f);
    if (pageToken) qs.set('pageToken', pageToken);
    const page = await client.request(`${FS_BASE}/${path}?${qs}`);
    for (const d of page.documents || []) docs.push(decodeDoc(d));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/** List Storage object metadata (name/size/time only — never the bytes). */
async function listStorage(client) {
  const items = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ fields: 'items(name,size,timeCreated),nextPageToken', maxResults: '1000' });
    if (pageToken) qs.set('pageToken', pageToken);
    const page = await client.request(`${GCS_BASE}?${qs}`);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return items;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const toIso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const lower = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/** Earliest valid answer timestamp on a question (answers[].ts is ISO). */
function firstAnswerTs(answers) {
  if (!Array.isArray(answers)) return null;
  let best = null;
  for (const a of answers) {
    const t = toIso(a && a.ts);
    if (t && (!best || t < best)) best = t;
  }
  return best;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Never write production data inside the repo (git, dist/, Vite dev server).
  // Compare real paths (symlinks resolved, case-folded for macOS APFS) and
  // match '..' as a path segment, not a string prefix.
  const realish = (p) => {
    let cur = resolve(p); const tail = [];
    while (!existsSync(cur) && dirname(cur) !== cur) { tail.unshift(basename(cur)); cur = dirname(cur); }
    return join(realpathSync(cur), ...tail);
  };
  const fold = (p) => (process.platform === 'darwin' ? p.toLowerCase() : p);
  const outAbs = realish(OUT_DIR);
  const rel = relative(fold(realish(REPO_ROOT)), fold(outAbs));
  const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (!outside) throw new Error(`Refusing to write telemetry inside the repo: ${outAbs}`);
  const started = Date.now();
  const token = await getAccessToken();
  const client = makeClient(token);
  const salt = randomBytes(16).toString('hex'); // per-run: student keys never link across runs
  const studentKey = (raw) => createHash('sha256').update(salt + raw).digest('hex').slice(0, 12);

  console.log(`Reading project ${PROJECT} (read-only)…`);
  const rawSessions = await listCollection(client, 'sessions');
  console.log(`  ${rawSessions.length} sessions`);

  const sessions = [];
  for (const s of rawSessions) {
    // Field mask keeps question/answer TEXT out of memory where possible.
    // (answers[] is an array of maps and cannot be sub-masked; its text is dropped below.)
    const [questions, feedback, joins] = await Promise.all([
      listCollection(client, `sessions/${s.id}/questions`, [
        'createdAt', 'status', 'votes', 'voters', 'pinned', 'imageUrls', 'authorUid', 'authorId', 'answers', 'answer',
      ]),
      listCollection(client, `sessions/${s.id}/sessionFeedback`).catch((err) => {
        console.warn(`  ! feedback for ${s.id} unreadable: ${err.message}`);
        return [];
      }),
      // Attendance (sessions/{code}/joins/{uid}); empty until join tracking ships.
      listCollection(client, `sessions/${s.id}/joins`, ['at']).catch((err) => {
        console.warn(`  ! joins for ${s.id} unreadable: ${err.message}`);
        return [];
      }),
    ]);

    const ownerEmail = lower(s.ownerEmail);
    const instructorEmails = [...new Set([ownerEmail, ...(s.instructorEmails || []).map(lower)].filter(Boolean))];
    const notes = Array.isArray(s.sessionNotes) ? s.sessionNotes : [];
    const name = typeof s.sessionName === 'string' ? s.sessionName
      : typeof s.name === 'string' ? s.name
        : typeof s.title === 'string' ? s.title : '';

    sessions.push({
      code: s.id,
      name: name.slice(0, 120),
      createdAt: toIso(s.createdAt) || toIso(s.createTime),
      sessionDate: typeof s.sessionDate === 'string' ? s.sessionDate : '',
      ownerEmail,
      instructorEmails,
      isTest: TEST_CODE_RE.test(s.id) || TEST_NAME_RE.test(name),
      features: {
        coInstructor: instructorEmails.length > 1,
        notes: notes.length > 0 || Boolean(s.sessionNoteBody),
        survey: Boolean(s.studentSurveyUrl),
      },
      questions: questions.map((q) => {
        const answers = Array.isArray(q.answers) ? q.answers : [];
        const author = q.authorUid || q.authorId || '';
        return {
          createdAt: toIso(q.createdAt) || toIso(q.createTime),
          status: q.status || 'pending',
          answered: q.status === 'answered' || answers.length > 0 || Boolean(q.answer),
          votes: Number(q.votes) || 0,
          pinned: Boolean(q.pinned),
          hasImage: Array.isArray(q.imageUrls) && q.imageUrls.length > 0,
          answerHasImage: answers.some((a) => Array.isArray(a && a.imageUrls) && a.imageUrls.length > 0),
          answerCount: answers.length,
          firstAnswerAt: firstAnswerTs(answers),
          student: author ? studentKey(author) : '',
          // Voter ids are uids (or legacy localStorage ids); hashed like authors.
          voters: Array.isArray(q.voters) ? q.voters.filter((v) => typeof v === 'string' && v).map(studentKey) : [],
        };
      }),
      joins: joins.map((j) => ({ student: studentKey(j.id), at: toIso(j.at) || toIso(j.createTime) })),
      // Feedback is anonymous by design ({subject, body, submittedAtMs}).
      feedback: feedback.map((f) => ({
        subject: String(f.subject || '').slice(0, 200),
        body: String(f.body || '').slice(0, 2000),
        at: f.submittedAtMs ? new Date(Number(f.submittedAtMs)).toISOString() : toIso(f.createTime),
      })),
    });
  }

  let instructorsDocs = 0;
  try {
    instructorsDocs = (await listCollection(client, 'instructors', ['__name__'])).length;
  } catch (err) {
    console.warn(`  ! instructors collection unreadable: ${err.message}`);
  }

  // Storage: aggregate by surface prefix and by session, sizes only.
  let storage = null;
  try {
    const objects = await listStorage(client);
    const byPrefix = Object.create(null);
    const bySession = Object.create(null);
    let totalBytes = 0;
    const daily = Object.create(null);
    for (const o of objects) {
      const size = Number(o.size) || 0;
      totalBytes += size;
      const parts = o.name.split('/'); // sessions/{code}/{surface}/file
      const surface = parts[0] === 'sessions' && parts[2] ? parts[2] : parts[0] || 'other';
      byPrefix[surface] = byPrefix[surface] || { count: 0, bytes: 0 };
      byPrefix[surface].count += 1;
      byPrefix[surface].bytes += size;
      if (parts[0] === 'sessions' && parts[1]) {
        bySession[parts[1]] = bySession[parts[1]] || { count: 0, bytes: 0 };
        bySession[parts[1]].count += 1;
        bySession[parts[1]].bytes += size;
      }
      const day = (o.timeCreated || '').slice(0, 10);
      if (day) daily[day] = (daily[day] || 0) + size;
    }
    storage = { objects: objects.length, totalBytes, byPrefix, bySession, daily };
    console.log(`  ${objects.length} storage objects`);
  } catch (err) {
    console.warn(`  ! storage listing failed (dashboard will omit it): ${err.message}`);
  }

  const dataset = {
    generatedAt: new Date().toISOString(),
    project: PROJECT,
    requests: client.requests,
    collectMs: Date.now() - started,
    instructorsDocs,
    sessions,
    storage,
  };

  // ── Write private output ───────────────────────────────────────────────────
  await mkdir(OUT_DIR, { recursive: true, mode: 0o700 });
  await chmod(OUT_DIR, 0o700);
  const template = await readFile(join(HERE, 'dashboard.template.html'), 'utf8');
  // Escape '<' so no string in the data can close the <script> tag.
  const json = JSON.stringify(dataset).replace(/</g, '\\u003c');
  // Function replacer: a string replacer would interpret `$'`, `$\``, `$&` in
  // student-supplied text (e.g. feedback) as patterns and splice template HTML
  // into the page — a stored-XSS path. The function's return value is literal.
  const html = template.replace('/*__DATA__*/null', () => json);

  const dataPath = join(OUT_DIR, 'data.json');
  const htmlPath = join(OUT_DIR, 'dashboard.html');
  await writeFile(dataPath, JSON.stringify(dataset, null, 2), { mode: 0o600 });
  await writeFile(htmlPath, html, { mode: 0o600 });
  await chmod(dataPath, 0o600);
  await chmod(htmlPath, 0o600);

  console.log(`Done in ${dataset.collectMs} ms, ${client.requests} API requests.`);
  console.log(`Dashboard: ${htmlPath}`);
  if (!NO_OPEN && existsSync(htmlPath) && process.platform === 'darwin') {
    await run('open', [htmlPath]).catch(() => {});
  }
}

main().catch((err) => {
  console.error(`Telemetry failed: ${err.message}`);
  process.exitCode = 1;
});
