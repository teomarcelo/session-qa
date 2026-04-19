# TDX Q&A

Live Q&A for trainings and events. Instructors run a session with a short code; students join in the browser, post questions, and upvote. Answers and pins show up in real time over **Firebase Firestore**. No app store—just two static pages you can host anywhere (e.g. GitHub Pages).

---

## What’s in the repo

| File | Role |
|------|------|
| `student.html` | Join screen + board for **students** (share this URL widely). |
| `instructor.html` | Login, sessions, moderation for **instructors** (treat as internal). |
| `SETUP.md` | Firebase project, Firestore rules, hosting, and session flow. |

---

## Students (attendees)

- Join with a session code (e.g. `TDX-XXXX`).
- Optional name, or post as **Anonymous**.
- Ask questions, **edit your own** questions while in the same browser session, **upvote** any question.
- See session details (title, room, time, description), filters (all / pinned / answered / unanswered), and **sort by newest or by votes**.
- See **instructor answers** as they’re saved (including multiple answers per thread when instructors add them).

---

## Instructors

- **Account:** display name + PIN (PIN is stored hashed in Firestore; see `SETUP.md` for limits).
- **Sessions:** create a session (code generated for you), edit session info, copy the code for students. Co-instructors can **join an existing session** with the same code.
- **During class:** answer (including follow-up answers), **pin** questions, mark answered/pending, **delete** questions. Stats and filters mirror what students care about.
- **Demo mode:** try the UI with sample data and no Firebase (button on the login screen).

---

## Stack (today)

- Plain HTML + CSS + JS in each file; Firebase compat SDK from CDN.
- Firestore holds instructors, sessions, and questions. GitHub Pages works fine for the static files.

---

## Roadmap (planned)

Rough order of what we want next—not all implemented yet:

1. **Stability:** stop full-page list redraws from wiping text people are typing (likely a component-style UI, e.g. React).
2. **Bulletin:** one **live notice** per session (agenda, room change, links) above the question list.
3. **Scale:** **paginated** question loads instead of pulling the entire list at once; optional slower refresh for students (e.g. polling) where realtime isn’t required.
4. **Files:** image paste / upload via a small **Heroku** API into **Salesforce Files**, with Firestore storing links/ids only.
5. **Hardening:** Firebase App Check, instructor authentication, tighter rules—before advertising student URLs globally.

Details for maintainers may live in a private notes file; this README stays high level.

---

## Setup

See **`SETUP.md`** for Firebase config, security rules, hosting, and how to run a session end to end.
