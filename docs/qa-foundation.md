# QA — Firebase Auth Security Foundation (Phase 1)

Local-only verification for the auth/security foundation. **Nothing here is
deployed or pushed.** `firestore.rules` is edited as a file only; it becomes
live only when a human runs `firebase deploy --only firestore:rules` later.

Environment note: this machine has **no JDK ≥ 21**, so the Firestore emulator
(and therefore `npm run test:rules`) could not be executed here. The rules tests
are written and syntax-valid; see "How to run the rules tests" below.

## Per-step smoke tests + results

Legend: ✅ pass · 🟡 partial (verified as far as the local env allows) · ⛔ blocked

### 1. auth-sdk — `firebase/compat/auth` + guarded App Check + `src/lib/auth.js`
- [x] `npm run build` clean. ✅
- [x] Lint clean on edited files. ✅
- [x] `firebase.auth()` resolves (imported in `firebaseCompat.js`; `getAuth()` returns it). ✅ (static verification)
- [x] App Check init is skipped when `VITE_APPCHECK_SITE_KEY` is unset (logs a one-line notice), initializes when set. ✅ (code path; needs a real key to fully exercise)
- [x] Demo / no-config path does not crash (every helper no-ops when `getAuth()` is null). ✅
- Result: ✅ pass.

### 2. instructor-signin — real Google sign-in, drop spoofable `sso_*`
- [x] `?sso_name` / `?sso_email` are no longer read anywhere (grep clean). ✅
- [x] `onAuthStateChanged` sets identity from a verified Google user (email-keyed ownerId), ignores anonymous sessions. ✅ (static)
- [x] "Continue with Google" button calls `signInInstructorWithGoogle()`; provider-disabled surfaces a clean message, no crash. ✅ (error mapping in `friendlyAuthError`)
- [x] Editable display-name field retained; demo mode retained; name-only fallback retained. ✅
- [x] `logout` calls `firebase.auth().signOut()` then clears local state. ✅
- [ ] Live popup sign-in ⛔ requires Google provider enabled + authorized domain in the console (not available locally).
- Result: 🟡 partial — all code paths in place and build/lint clean; live popup needs console setup (see human steps).

### 3. student-anon — silent anonymous auth before writes; `authorUid` + uid voters
- [x] `ensureAnonymousStudent()` called on student session start/join, and before each write (AskBox, upvote, feedback). ✅
- [x] New questions stamp `authorUid = auth.currentUser.uid` (kept `authorId` for continuity). ✅
- [x] Upvote uses uid-based voter (falls back to legacy id); "voted" highlight recognizes both. ✅
- [x] Feedback payload shape unchanged (exact 3 keys) so it still passes the *currently-deployed* rules. ✅
- [x] Demo unaffected (no `db`, helpers no-op). ✅
- [ ] Live anonymous sign-in ⛔ requires Anonymous provider enabled in the console.
- Result: 🟡 partial — code complete, build/lint clean; live anon sign-in needs console setup.

### 4. ownership-fields — `ownerEmail` on create; `instructorEmails` on join
- [x] Create persists `ownerEmail` (lowercased verified email) + seeds `instructorEmails: [ownerEmail]`. ✅
- [x] Join appends the joiner's verified email via `arrayUnion` (plus roster display name). ✅
- [x] Per-session display names still work (roster logic unchanged). ✅
- [x] Legacy/existing sessions still load (fields are additive). ✅
- Result: ✅ pass (static + build/lint clean).

### 5. rules-rewrite — target rules shape (FILE ONLY, not deployed)
- [x] Rewritten to require auth; instructor writes require verified `@salesforce.com`; students edit own by uid; upvotes for any signed-in user; deletes instructor-only; legacy docs tolerated. ✅
- [x] Automated tests written in `test/firestore.rules.test.mjs` (14 cases). ✅
- [ ] `npm run test:rules` executed ⛔ blocked: no JDK ≥ 21 for the Firestore emulator on this machine.
- Result: 🟡 partial — rules + tests written and syntax-valid; emulator run pending a JDK (instructions below).

### 6. app-check — env-guarded init (implemented in step 1)
- [x] Key unset → init skipped, app runs. ✅
- [x] Key set → `firebase.appCheck().activate(ReCaptchaV3Provider)` (optional debug provider via `VITE_APPCHECK_DEBUG`). ✅ (needs a real reCAPTCHA v3 key to fully exercise)
- Result: 🟡 partial — code complete; real key required to see a token minted.

### 7. realtime-reads — `onSnapshot` for the student feed, polling removed
- [x] Page 0 is a live `onSnapshot` listener; `setInterval` polling removed (`STUDENT_POLL_MS` no longer imported in `useQuestions.js`). ✅
- [x] Pagination/cache preserved: older pages still fetched via cursor `.get()`; returning to page 0 shows the freshest snapshot and drops stale older pages. ✅
- [x] Listener errors fall back without breaking the feed (cached data left in place). ✅
- [x] Demo mode (no `db`) still works (no listener attached; store drives the board). ✅
- [ ] Live "new question appears without refresh" ⛔ needs a live Firestore session to watch end-to-end.
- Result: 🟡 partial — implemented and build-clean; live visual confirmation needs a running session.

### 8. backfill-script — `scripts/backfill-owner-emails.mjs`
- [x] Defaults to `--dry-run`; prints intended writes and changes nothing. ✅ (ran against prod read-only: 8 sessions listed, `Summary: ... Dry run only — no documents were modified`)
- [x] Resolves `ownerEmail` from `OWNER_EMAIL_MAP` (by code or ownerId); unresolved sessions are reported and skipped (never guessed). ✅ (verified a mapped code produced a correct `set {...}` line)
- [x] Real writes require the explicit `--commit` flag; supports emulator via `FIRESTORE_EMULATOR_HOST`. ✅ (flag gating verified; `--commit` not run)
- Result: ✅ pass (dry-run verified end-to-end; `--commit` intentionally not executed).

## Final gates
- `npm run build`: ✅ clean after every step.
- `ReadLints` on all edited/new files: ✅ no errors introduced.

## How to run the rules tests (needs the emulator)
1. Install a JDK 21+ (e.g. Azul Zulu / Temurin) and ensure `java -version` works.
2. From the repo root:
   ```bash
   npm run test:rules
   ```
   This runs `firebase emulators:exec --only firestore --project demo-session-qa "node --test test/"`,
   which boots the Firestore emulator, runs `test/firestore.rules.test.mjs`
   against it, and shuts the emulator down. No production project is touched
   (throwaway `demo-*` project id).

## `npm run dev` expectations (manual)
- Instructor page: "Continue with Google" opens the Google popup **only if** the
  Google provider is enabled and the domain is authorized in the Firebase
  Console. Until then it shows a clear error ("Google sign-in is not enabled…")
  and demo mode still works.
- Student page: silent anonymous sign-in happens on load **only if** the
  Anonymous provider is enabled. If disabled, writes fall back to the legacy
  localStorage id and still succeed under the *currently-deployed* permissive
  rules.
- Automated confidence comes from the build, lint, dry-run backfill, and the
  (emulator-run) rules tests — not from the popup, which needs console setup.

## Human-only steps still required (for manual testing + deployment)
1. Firebase Console → Authentication → Sign-in method: **enable Google** and
   **enable Anonymous**.
2. Authentication → Settings → **Authorized domains**: add the production domain
   (and `localhost` for local testing).
3. App Check → register the web app with **reCAPTCHA v3**, then set
   `VITE_APPCHECK_SITE_KEY` in `.env`. Keep App Check in *monitor* mode first,
   then *enforce* on Firestore.
4. Run the backfill with real emails, preview then commit:
   ```bash
   OWNER_EMAIL_MAP='{"SQA-XXXX":"owner@salesforce.com", ...}' node scripts/backfill-owner-emails.mjs        # preview
   OWNER_EMAIL_MAP='{...}' node scripts/backfill-owner-emails.mjs --commit                                  # apply
   ```
   (Run before enforcing strict rules, or against the emulator, or with an Admin
   SDK service account.)
5. Deploy in order, only when you say so: **rules first** (`firebase deploy --only firestore:rules`),
   then the app.
6. (Optional, later phases) Upgrade to Blaze for Cloud Functions; create the
   Slack app + IT approval; add an Auth blocking function to hard-reject
   non-salesforce sign-ins.
