# TDX Q&A App — Setup Guide

## What you got
- `student.html` — Student-facing Q&A board (share this URL with students)
- `instructor.html` — Instructor dashboard (keep this URL private or share only with instructors)

---

## Step 1: Firebase Setup (~15 minutes, free)

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `tdx-qa` → Create
3. Go to **Firestore Database** → Create database → Start in **test mode** → Choose a region → Done
4. Go to **Project Settings** (gear icon) → **Your apps** → click `</>` (Web)
5. Register the app (name: "TDX QA"), skip Firebase Hosting
6. Copy the config object — it looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "tdx-qa.firebaseapp.com",
     projectId: "tdx-qa",
   };
   ```
7. Paste those values into **both** `student.html` and `instructor.html` where you see:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
   };
   ```

---

## Step 2: Firestore Security Rules

In Firebase Console → Firestore → **Rules**, paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Instructors self-register — PIN is stored hashed (SHA-256), never plain text
    match /instructors/{instructorId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }

    // Sessions and questions
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if false;
      match /questions/{questionId} {
        allow read: if true;
        allow create: if true;
        allow update: if resource.data.authorId == request.resource.data.authorId;
        allow delete: if false;
      }
    }
  }
}
```

> **Note:** Instructor writes (creating sessions, answering questions, deleting) bypass these
> rules because the app calls Firestore directly from the browser. This is fine for internal use.
> For a public-facing production app, consider adding Firebase Authentication.

---

## Step 3: Host it (free options)

### Option A — Netlify (easiest, ~2 minutes)
1. Go to https://netlify.com → sign up free
2. Drag and drop your folder (containing both HTML files) onto the Netlify dashboard
3. You'll instantly get URLs like:
   - `https://your-app.netlify.app/student.html` ← share with students
   - `https://your-app.netlify.app/instructor.html` ← instructors only

### Option B — GitHub Pages
1. Push your files to a GitHub repo
2. Go to repo Settings → Pages → Deploy from main branch
3. Your URLs: `https://username.github.io/repo-name/student.html`

---

## How to run a session

1. Open `instructor.html`
2. First time: click **Create an account** → enter your name and choose a PIN
3. Return visits: sign in with your name and PIN
4. Click **+ New session** — a unique code like `TDX-A7K2` is generated automatically
5. Fill in session details (name, room, date/time, description) → **Save session info**
6. Share the session code with students — they go to `student.html` and enter the code
7. Students ask questions, upvote, and see your answers update in real time

### Demo mode
Not ready to connect Firebase yet? Click **Try the demo** on the login screen.
Demo mode loads 5 sample Agentforce questions and lets you try every instructor action
(answer, pin, delete, filter) without touching the database. Use **Reset demo** to
restore the original questions at any time.

---

## Firebase free tier — will it be enough?

**Short answer: yes, easily.**

Firebase's free Spark plan gives you:
- 1 GB storage
- 50,000 reads / day
- 20,000 writes / day

A busy TDX day with 10 sessions and 300 questions uses roughly **1,400 writes** —
about 7% of the daily free limit. Storage for thousands of questions is well under 10 MB.

**The one thing to watch:** Each connected student counts as a read every time any question
is updated. With 300 students connected at once, a busy session could approach the 50k
read limit. If you see a quota warning in the Firebase console, upgrade to the **Blaze
(pay-as-you-go) plan** — 100,000 reads costs $0.06, so a full TDX day would run under $1.

---

## Instructor accounts

Each instructor creates their own account directly on `instructor.html` — no admin needed.

- Name + PIN (min 4 characters)
- PIN is stored as a SHA-256 hash in Firestore — never plain text
- Multiple instructors can have separate accounts independently
- Name is the unique identifier — "Alex Rivera" and "alex rivera" are the same account

---

## Future: Salesforce OAuth (optional upgrade)

To restrict instructor access to @salesforce.com accounts only:

1. In Salesforce Setup → **App Manager** → New Connected App
2. Enable OAuth, set callback URL to your hosted instructor page
3. Add scopes: `openid`, `profile`, `email`
4. In Firebase Console → Authentication → Add provider → SAML / OpenID Connect
5. In `instructor.html`, replace the PIN check with:
   ```js
   if (!user.email.endsWith('@salesforce.com')) { signOut(); }
   ```

This is approximately a 1-hour upgrade once the Connected App is configured in your Salesforce org.

---

## Session code format
Codes are always `TDX-XXXX` (4 alphanumeric characters).
Ambiguous characters like 0/O and 1/I are excluded to avoid confusion.
Students enter them on the join screen — input is automatically uppercased.
