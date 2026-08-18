# Session Q&A — Prioritized Backlog

Captured for the Dreamforce bootcamp. Ordered by value/effort. File pointers are
starting points, not exhaustive.

## Operational

### P1 — Enable App Check enforcement (deliberately deferred)
App Check is registered and the client now mints reCAPTCHA v3 tokens, but
`firestore`, `firebasestorage` and `identitytoolkit` are all **UNENFORCED**, so
the backend accepts requests carrying no token. Until this is on, App Check
protects nothing — see the vote-integrity note in [`firestore.rules`](firestore.rules),
which correctly identifies App Check as the only lever against a sockpuppet
upvote campaign, since anonymous identities are unlimited and rules cannot tell
500 scripted voters from 500 real ones.
- Do **not** enable it from the console on a hunch. Let one real workshop run,
  then check the verified vs. unverified split in Firebase Console → App Check.
- Enforce only when essentially all traffic shows verified. Never on event day:
  the failure mode is total, not degraded — unverified clients cannot write at all.
- Token TTL is 24h and the score threshold is reCAPTCHA's default `0.5`. A
  stricter score also catches real attendees on VPNs and privacy blockers.

### P2 — Stop shipping 310 KB of emoji keywords on first paint
`emojilib` lands in a chunk that is **1.2 MB raw / ~310 KB gzipped** and is
eagerly `modulepreload`ed on *both* `student.html` and `instructor.html`, so every
attendee downloads and parses it before the app is interactive. It exists only to
power keyword search in the emoji picker.
- Load it on demand when the picker first opens, via a cached dynamic `import()`
  in [`emojiData.js`](src/lib/emojiData.js).
- Both format toolbars consume it synchronously today
  ([student](src/student/components/FormatToolbar.jsx),
  [instructor](src/instructor/components/FormatToolbar.jsx)), so this needs the
  picker to tolerate an async index — the glyph grid itself is a plain string and
  can render immediately while keywords are still loading.
- Verify with `npm run build`: the emoji chunk should stop appearing as a
  `modulepreload` in `dist/student.html` and `dist/instructor.html`.

## Features

### P1 — QR-code join (biggest in-person win)
Students join by scanning instead of typing `SQA-XXXX`.
- Add a QR that encodes the student URL with the code prefilled, e.g.
  `https://<host>/student.html?code=SQA-XXXX`.
- Show it on the instructor dashboard header and optionally the hub.
- Have the student join flow read `?code=` and auto-fill/auto-join
  ([`JoinScreen.jsx`](src/student/components/JoinScreen.jsx),
  [`useStudentSession.js`](src/student/hooks/useStudentSession.js)).
- Library: `qrcode` (render to canvas/img) — small, offline.

### P1 — Presenter / kiosk view (projector mode)
Full-screen, large-type view for the room showing pinned + top-voted unanswered
questions, auto-refreshing.
- New route/component reusing the instructor question store
  ([`useInstructorStore.js`](src/instructor/store/useInstructorStore.js),
  [`QuestionsList.jsx`](src/instructor/components/QuestionsList.jsx)).
- Sort by votes desc, hide answered, minimal chrome, high contrast.

### P2 — Export session
Download questions + answers after class (Markdown and/or CSV).
- Iterate the questions collection for a session and serialize client-side.
- Add an "Export" control in the instructor sidebar
  ([`InstructorSidebar.jsx`](src/instructor/components/sidebar/InstructorSidebar.jsx)).

### P2 — Instructor live-Q&A keyboard shortcuts
Answer / pin / mark-answered / next without the mouse during live Q&A
([`QuestionCard.jsx`](src/instructor/components/QuestionCard.jsx),
[`AnswerBox.jsx`](src/instructor/components/AnswerBox.jsx)).

### P2 — Finish or remove image upload
Firebase Storage image paste is half-wired (flagged in [`CLAUDE.md`](CLAUDE.md)).
Either complete it end-to-end (upload fn, resize, store URL, render, Storage rules
+ CORS) or hide the paste affordance so it can't fail silently mid-class
([`AskBox.jsx`](src/student/components/AskBox.jsx),
[`storage.rules`](storage.rules), [`storage-cors.json`](storage-cors.json)).

### P3 — Scale / read-budget for large events
Student board polls ~10s ([`useQuestions.js`](src/student/hooks/useQuestions.js),
`STUDENT_POLL_MS` in [`app.js`](src/constants/app.js)).
- Consider a lightweight "new questions available" indicator + manual refresh to
  cut reads when hundreds are connected.
- Confirm Firestore read budget / plan for TDX-scale audiences.

## Design / UX / Accessibility

### P1 — Replace instructor PIN UI after OAuth ships
Once the Next.js gate is live, retire the PIN form and the "Future upgrade…
Salesforce OAuth" footer note; show the authenticated Google identity instead
([`LoginScreen.jsx`](src/instructor/components/LoginScreen.jsx)).

### P2 — Consolidate inline styles into CSS tokens
Components mix heavy inline styles with the stylesheets, making theming
inconsistent (e.g. [`LoginScreen.jsx`](src/instructor/components/LoginScreen.jsx),
[`AskBox.jsx`](src/student/components/AskBox.jsx) anon toggle). Move to the
existing design tokens (`var(--accent)`, `var(--border)`, …) in
[`src/styles/`](src/styles).

### P2 — Accessibility pass
- `aria-label`s on icon-only buttons (reactions, delete `×`, feedback).
- Visible focus states on all interactive controls.
- Color-contrast check on muted text (`--text-light`/`--text-muted`).

### P3 — Consistent empty / loading states
Skeletons or clear placeholders for the question list and stats while data loads
([`QuestionsList.jsx`](src/student/components/QuestionsList.jsx),
[`useSessionStats.js`](src/student/hooks/useSessionStats.js)).

## Done (this pass)
- Removed the live chat (student + instructor), its CSS, Firestore chat rules,
  and the `leo-profanity` dependency.
- Scoped the Next.js middleware so only `/instructor` requires auth (students
  are no longer locked out).
- Brought `next-app/` into source control (secrets still ignored).
- Hardened `firestore.rules` with create-time validation + documented the
  Phase 2 Admin SDK write-lockdown.
- Added the OAuth/deploy runbook ([`next-app/README.md`](next-app/README.md)).
