# Session Q&A

Live Q&A for trainings and events. Instructors run a session with a short code; students join in the browser, post questions, and upvote. Everything is stored in **Firebase Firestore**.

---

## What’s in the repo

| Path | Role |
|------|------|
| `index.html` | Dev/prod **hub** at `/` with links to student and instructor (the real apps are the two HTML entries below). |
| `student.html` / `instructor.html` | Page shells (markup + Firebase CDN + Fuse). **Run via Vite** in dev; for production, use the **`dist/`** output of `npm run build` (see below). |
| `src/` | App logic split into **`config/`**, **`constants/`**, **`lib/`**, and **`student/`** / **`instructor/`** entry bundles. |
| `vite.config.js`, `package.json` | [Vite](https://vitejs.dev/) multi-page build (`index` + `student` + `instructor`). **`firebase`** (npm): **`firebase/compat/app`** (+ Firestore + Storage) in the runtime bundle. |
| `SETUP.md` | Firebase project, Firestore rules, hosting, and session flow. |
| `CHANGELOG.md` | **Timeline of recent product and doc changes** (newest first). |
| `CLAUDE.md` | Context file for AI-assisted development (Claude Code). Not needed to run the app. |
| `firebase.json` | Firebase CLI configuration for deploying Firestore and Storage rules. |
| `.firebaserc` | Firebase project alias (`tdx-qa` = default project). |
| `storage.rules` | Firebase Storage security rules (deploy via `firebase deploy --only storage`). |

### Develop and deploy

1. **Install:** `npm install`
2. **Local dev:** `npm run dev` — open **`http://localhost:5173/`** for a link hub, or go straight to **`/student.html`** or **`/instructor.html`** (there is no app UI on `/` unless you use this hub).
3. **Production build:** `npm run build` — outputs **`dist/`** with hashed JS/CSS and **relative** `./assets/…` URLs so the folder can be published to a static host.
4. **Deploy:** production is **Firebase Hosting** at **https://session-qa.web.app**, published manually with `npx firebase-tools deploy --only hosting:app --project tdx-qa` (the project id stays `tdx-qa`; `session-qa` is a Hosting site inside it, and `tdx-qa.web.app` now 301-redirects there). Pushing to `main` does **not** deploy, and the old GitHub Pages URL is retired. Build from a clean checkout of committed `HEAD`, never from a dirty working tree. Full sequence in `.claude/skills/deploy-and-verify.md`.
5. **Optional env overrides:** set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc. before `npm run build` (see `src/config/firebase.js`).

`dist/` is listed in `.gitignore`; ship the build artifact to hosting rather than committing it.

---

## Changelog / timeline

For a **dated history** (fixes, UI tweaks, rich text, toolbars), see **`CHANGELOG.md`**.

---

## Students (attendees)

- Join with a session code: **`SQA-`** is a fixed label and you type the last four characters (or paste a full **`SQA-`** / legacy **`TDX-`** code in the field). On desktop, the right column shows session details.
- Optional name, or post as **Anonymous** (non-anonymous names are remembered in this browser).
- **Same browser:** a stable **student id** and your **last session code** are stored locally so a normal page refresh reopens the board without typing the code again (until **Leave**). That id is scoped to the browser.
- Ask questions, **edit your own** questions while in the same browser session, **upvote** any question.
- See session details (title, room, time, description) in the **Session** column on the right, then **Session stats** below that. At the bottom of the sidebar, **Send feedback** opens a short form.
- Questions load in **pages** of 10 with **Load older**; the board **polls** about every 10s (your own submit or edit refreshes immediately). **Refresh** next to Search/Clear runs the same fetch operation.
- The **Format** row above the ask box (and in **Edit**) inserts Slack-style markers: bold, italic, strikethrough, inline code, code blocks, and common emojis; `https://` links still auto-link when rendered.
- **Paste screenshots** into the ask box (students) or answer box (instructors): images are resized and compressed client-side, uploaded to **Firebase Storage**, and shown as attachments in questions and answers.
- See **instructor answers** as they’re saved (including multiple answers per thread when instructors add them).

---

## Instructors

- **Account:** display name + PIN (PIN is stored hashed in Firestore; see `SETUP.md` for limits).
- **Sessions:** create a session (code generated for you) with the same fields as **Session settings** (including OrgClaim and survey), then tweak anytime in the sidebar; copy the code for student sharing.
- **Instructor Notes** (sidebar section title): optional title, message, optional named links (editor), and `https://` image URLs; **Show in student dashboard** checkbox; Slack-style formatting.
- **OrgClaim & survey shortcuts:** **OrgClaim** link (defaults to `http://sfdc.co/OrgClaim` on save) plus **OrgClaim code** — students always see **OrgClaim**; if the code is empty, **OrgClaim Code** is hidden.
- **During class:** answer (including follow-up answers); **Answered verbally** and **Mark pending** are separate controls (always visible—order: Save answer → Answered verbally → Pin → Mark pending).
- **Demo mode:** try the UI with sample data and no Firebase (button on the login screen).

---

## Stack (today)

- **Vite** bundles ES modules from `src/`; markup stays in the two HTML entry files; CSS lives under `src/styles/`. Firebase compat SDK and Fuse stay on CDNs as before.
- Firestore holds instructors, sessions, and questions; **Firebase Storage** holds question and answer image attachments. Static hosting serves the **`dist/`** folder for production.

---

## Roadmap

**Shipped in this repo**

- **Pagination** (10 questions per page) + **Load older** on student and instructor.
- Student **polling** (~10s) instead of a live listener on the full question list; instructor **live listener on the newest page** only.
- **Answer drafts** preserved for instructors when the question list re-renders.
- Question and session-note text: **line breaks**, **Slack-style rich markers** (`*bold*`, code fences, etc.), **linkified** `https://` URLs, **copy-to-clipboard on rendered code**, plus formatting helpers.
- **Image paste** (student ask box and instructor answer box): screenshots resize client-side and upload to Firebase Storage; rendered as attachments in question and answer cards.

**Still to build (when you’re ready)**

- React (or similar) for cleaner UI state, Firebase **App Check** + instructor **Auth**, tighter rules for global URLs.

Details for maintainers may live in a private notes file; this README stays high level.

---

## Privacy & data handling

This section documents what data the app collects and stores, for compliance purposes (e.g. Salesforce data handling policies).

### What is stored in Firebase Firestore

| Data | Where | Notes |
|------|-------|-------|
| Question text | `sessions/{code}/questions/{id}` | Entered by the student |
| `authorName` | same document | The display name the student typed, or `"Anonymous"` if they left it blank or toggled **Post anonymously** |
| `authorId` | same document | A random UUID generated in the student's browser on first visit — no name, email, or device info attached |
| `voters` array | same document | List of `authorId` UUIDs — no PII |
| Session feedback | `sessions/{code}/sessionFeedback/{id}` | Subject + message only; Firestore rules enforce exactly those 3 fields — no name or identity stored |
| Instructor account | `instructors/{id}` | Display name + hashed PIN chosen by the instructor |

### What is NOT stored

- No email addresses, employee IDs, or Salesforce org IDs
- No IP addresses or device fingerprints
- No authentication tokens (the app has no Firebase Auth)
- `authorEmail` field exists in question documents but is always written as an empty string `""`

### How `authorName` works

The student name field is **optional**. If a student types a name, it is:

1. Saved to `localStorage` on their own device (for pre-filling the form on return visits).
2. Written to Firestore as `authorName` on any question they submit — visible to instructors in the dashboard.

If the student leaves the name blank, or enables the **Post anonymously** toggle before submitting, `authorName` is stored as `"Anonymous"` and no real name ever leaves their device.

The `authorId` UUID cannot be linked back to a person without physical access to the device that generated it.

### Summary

The only personal data in Firestore is a self-reported, optional display name attached to questions. It is not collected for any purpose beyond showing instructors who asked what during a session.

---

## Setup

See **`SETUP.md`** for Firebase config, security rules, hosting, and how to run a session end to end (including the Vite build step for production).
