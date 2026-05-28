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
- Do not migrate Firebase compat SDK to modular — keep existing SDK as-is.
- Always run `npm run dev` to test — never assume changes work without verifying locally.

## What this app is
Two-page static app deployed on GitHub Pages:
- **student.html** — students join with a session code, post questions, upvote
- **instructor.html** — instructors create/manage sessions, answer questions,
  pin, filter, view stats, add instructor notes, receive session feedback
- **index.html** — dev/prod hub linking to both pages

Used for live Salesforce training events including TDX26. Co-instructors can
join the same session. Scales to large event audiences.

## Tech stack
- **Bundler:** Vite (multi-page: index + student + instructor)
- **Database:** Firebase Firestore (compat SDK via firebaseCompat.js)
- **File storage:** Firebase Storage (compat SDK — partially wired, needs completion)
- **Search:** Fuse.js (fuzzy search on questions)
- **Hosting:** GitHub Pages (deploys via GitHub Actions on push to main)
- **Auth:** None — instructor PIN stored hashed in Firestore
- **Language:** Vanilla JavaScript ES modules (src/), HTML, CSS

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
├── .github/workflows/          ← GitHub Actions deploy pipeline
├── firestore.rules             ← Firestore security rules (do not modify without asking)
├── storage-cors.json           ← Firebase Storage CORS config (do not modify without asking)
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
- Image paste for questions and answers (wired to Firebase Storage — needs completion)
- GitHub Actions auto-deploy to GitHub Pages on push to main

## Next feature to build: Firebase Storage image uploads
The groundwork is already in place:
- Firebase Storage is imported in firebaseCompat.js
- storage-cors.json exists at root
- The README documents image paste as a planned feature requiring Storage + rules
- Student ask box and instructor answer box already have paste event handlers

What needs to be completed:
1. Wire up the actual upload function in firebaseCompat.js
2. Handle image resize before upload (keep file sizes reasonable for event scale)
3. Store the download URL in Firestore alongside the question/answer
4. Render images as attachments in the question and answer UI
5. Update firestore.rules and storage-cors.json to allow uploads
6. Test locally at `npm run dev` before any push

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
- Student identity stored in localStorage (stable studentId + last session code)
- Instructor identity: display name + hashed PIN stored in Firestore
- Questions stored under: sessions/{code}/questions/{questionId}
- Session feedback stored under: sessions/{code}/sessionFeedback

## Development workflow
```bash
npm install          # first time only
npm run dev          # local dev server at http://localhost:5173
npm run build        # production build → dist/
```

For production, GitHub Actions runs npm ci + npm run build and publishes
dist/ to GitHub Pages automatically on push to main.

**Never commit dist/ — it is in .gitignore and built by CI.**

## Rules
- Before writing any code, state what you are about to build, what decisions
  you made and why, and flag anything that needs input before proceeding.
- Write complete working files — not snippets.
- Always specify which file you are creating or editing.
- Use async/await — no callback hell.
- Handle errors gracefully — never let a failure crash silently.
- Comment code clearly, especially Firebase operations.
- Use environment variables for all secrets — never hardcode Firebase config.
- Do not push to GitHub or deploy unless Teo explicitly says to.
- Test locally with npm run dev before declaring anything done.
