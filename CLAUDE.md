# Session Q&A — Claude Code Context

You are working on Session Q&A, a live Q&A tool built for Salesforce training
workshops and events. Instructors create a session with a short code; students
join in the browser, post questions, and upvote. Used in production at TDX26
and ongoing Salesforce training sessions.

## ⚠️ Production rules — read before doing anything
- This app is in ACTIVE production use for live Salesforce workshops.
- NEVER push to GitHub or deploy without Teo explicitly saying "push" or "deploy."
- Build and test locally only until instructed otherwise.
- Do not modify firestore.rules or storage-cors.json without confirming first.
- firestore.rules changes are NOT live until reviewed and deployed with
  `firebase deploy --only firestore:rules`. Editing the file locally never
  affects production on its own.
- Do not migrate Firebase compat SDK to modular — keep existing SDK as-is.
- Always run `npm run dev` to test — never assume changes work without verifying locally.

## What this app is
Two-page static app deployed on Firebase Hosting at **https://session-qa.web.app**:
- **student.html** — students join with a session code, post questions, upvote
- **instructor.html** — instructors create/manage sessions, answer questions,
  pin, filter, view stats, add instructor notes, receive session feedback
- **index.html** — dev/prod hub linking to both pages

Used for live Salesforce training events including TDX26. Co-instructors can
join the same session. Scales to large event audiences.

## Tech stack
- **Bundler:** Vite (multi-page: index + student + instructor)
- **Database:** Firebase Firestore (compat SDK via firebaseCompat.js)
- **File storage:** Firebase Storage (compat SDK — image paste is shipped)
- **Search:** Fuse.js (fuzzy search on questions)
- **Hosting:** Firebase Hosting, deployed **manually** with the Firebase CLI.
  Project id is `tdx-qa`; `session-qa` is a Hosting *site* inside it. Pushing to
  `main` deploys nothing. `tdx-qa.web.app` 301-redirects to `session-qa.web.app`.
- **Auth:** Firebase Auth. Instructors sign in with Google and writes require a
  verified `@salesforce.com` address; students get a silent anonymous identity.
  App Check (reCAPTCHA v3) is initialised but **not enforced**.
- **Language:** React (`.jsx`) on Vite, ES modules under `src/`, HTML, CSS

## Project structure
```
session-qa/
├── index.html                  ← hub page
├── student.html                ← student entry shell
├── instructor.html             ← instructor entry shell
├── src/
│   ├── config/
│   │   └── firebase.js         ← Firebase config (env var overrides)
│   ├── constants/              ← shared constants
│   ├── lib/
│   │   └── firebaseCompat.js   ← Firebase Firestore + Storage init
│   ├── styles/                 ← all CSS
│   ├── student/                ← student app logic + entry bundle
│   └── instructor/             ← instructor app logic + entry bundle
├── scripts/                    ← build/deploy scripts
├── redirect-site/              ← tiny public dir for the tdx-qa.web.app redirect
├── firestore.rules             ← Firestore security rules (do not modify without asking)
├── storage.rules               ← Firebase Storage security rules
├── storage-cors.json           ← Firebase Storage CORS config (do not modify without asking)
├── firebase.json               ← multi-site hosting (app + legacy targets), rules, emulators
├── vite.config.js              ← multi-page Vite build config
└── package.json
```

## Current build state
MVP is complete and production-stable. All features below are shipped and working:
- Session creation, join, and code system (SQA- prefix)
- Live question feed with polling (~10s) on student side
- Real-time listener on newest page for instructors
- Pagination (10 questions per page) + Load older
- Upvoting, pinning, answering, marking pending, deleting
- Slack-style rich text formatting (bold, italic, code, fenced blocks, links)
- Format toolbars on ask box and answer box
- Instructor notes (optional, shown to students as separate feed)
- Session feedback (anonymous, stored in Firestore)
- Session stats (total, answered, pending, pinned)
- Multi-session management (create, join, hide)
- Co-instructor support
- Demo mode (no Firebase required)
- Student view toggle for instructors
- Resizable sidebar with collapse/expand
- Image paste for questions and answers, uploaded to Firebase Storage
- Firebase Auth: Google sign-in for instructors, anonymous identities for students
- React rewrite of both the student and instructor apps

## Known gaps / next up
- **App Check is registered but UNENFORCED** on Firestore, Storage and Identity
  Toolkit. The client mints reCAPTCHA v3 tokens, the backend ignores them. Enable
  enforcement only after the App Check console shows real workshop traffic minting
  valid tokens — turning it on early rejects every client write instantly.
- **The emoji picker ships ~310 KB gzipped (1.2 MB parsed) of `emojilib` keyword
  data**, eagerly preloaded on both student.html and instructor.html. Every
  attendee downloads it before the app is interactive. Loading it on demand is the
  single biggest win available on first paint.

### Scale requirement (important)
This app is used at large Salesforce events — potentially hundreds of students
in a single session. Firebase Storage free tier is 5GB storage + 1GB/day
download. For most workshops this is fine. For very large events (TDX-scale)
the Firebase plan may need a temporary upgrade. Design uploads to be efficient:
- Resize/compress images client-side before uploading
- Use reasonable max dimensions (e.g. 1200px wide max)
- Store images under sessions/{code}/images/ path in Storage

## How sessions work
- Session codes: SQA-XXXX format (legacy TDX- codes also supported)
- Instructors create a session → get a code → share with students
- Students join with the code — no account needed
- Student identity stored in localStorage (stable studentId + last session code),
  plus an anonymous Firebase Auth uid that `firestore.rules` binds writes to
- Instructor identity: verified Google `@salesforce.com` account; `ownerEmail` /
  `instructorEmails` on the session drive access in `firestore.rules`
- Questions stored under: sessions/{code}/questions/{questionId}
- Session feedback stored under: sessions/{code}/sessionFeedback

## Development workflow
```bash
npm install          # first time only
npm run dev          # local dev server at http://localhost:5173
npm run build        # production build → dist/
```

There is no CI deploy. Production is published by hand from a clean checkout of
`origin/main`, never from the working tree — full sequence in
`.claude/skills/deploy-and-verify.md`:

```bash
npx firebase-tools deploy --only hosting:app --project tdx-qa
```

**Never commit dist/ — it is in .gitignore and rebuilt for every deploy.**

## Rules
- Before writing any code, state what you are about to build, what decisions
  you made and why, and flag anything that needs input before proceeding.
- Write complete working files — not snippets.
- Always specify which file you are creating or editing.
- Use async/await — no callback hell.
- Handle errors gracefully — never let a failure crash silently.
- Comment code clearly, especially Firebase operations.
- Never hardcode real secrets (service accounts, API secrets, tokens). The
  Firebase web config and the App Check reCAPTCHA *site* key are not secrets —
  they are public by design and ship in the client bundle, so they live as
  committed defaults in `src/config/firebase.js` with `VITE_*` overrides. They
  must stay committed: production builds from a clean checkout that has no
  `.env.local`, and an env-only value silently resolves empty there.
- Do not push to GitHub or deploy unless Teo explicitly says to.
- Test locally with npm run dev before declaring anything done.
