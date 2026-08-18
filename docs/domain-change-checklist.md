# Domain Change Checklist

Steps required any time the production domain changes (e.g. moving from
`tmarcelo.github.io` to a custom domain or Firebase Hosting URL).

## 1. Firebase Console — Authentication

Authentication → Settings → **Authorized domains**

- Remove the old domain
- Add the new domain
- `localhost` stays permanently (dev)

## 2. Google reCAPTCHA Admin

[https://www.google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)

- Find the `session-qa` site key
- Under Domains, remove the old domain and add the new one
- Save

## 3. Firebase Console — App Check

App Check → your web app → reCAPTCHA provider

- No change needed here (the site key itself is domain-scoped via reCAPTCHA admin above)
- If you registered a new site key, update `VITE_APPCHECK_SITE_KEY` in your environment

## 4. Firebase Hosting

Currently hosted at `session-qa.web.app` via Firebase Hosting
(`firebase deploy --only hosting:app --project tdx-qa`). No domain config to change
in code — just update Auth authorized domains and reCAPTCHA above.

A new `.web.app` domain does not need a new Firebase project: create a Hosting
*site* in the existing one and point a deploy target at it.

```bash
firebase hosting:sites:create <site-id> --project tdx-qa
firebase target:apply hosting app <site-id> --project tdx-qa
```

Retiring an old domain is a redirect-only site (`legacy` target in `firebase.json`),
not a deletion. Keep it serving 301s so links already handed out keep working.

If moving to a custom domain: Firebase Console → Hosting → Add custom domain.

## 5. GitHub Actions workflow

`.github/workflows/` — the old GitHub Pages deploy workflow may still exist.
If Firebase Hosting is now the only deploy target, the GH Actions workflow can be disabled
or updated to run `firebase deploy --only hosting` instead.

## 6. Google OAuth (if the Next.js gateway is ever reintroduced)

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 client

- Authorized JavaScript origins: add new domain
- Authorized redirect URIs: add new domain + `/api/auth/callback`

This does NOT apply currently — the app uses Firebase Auth directly, not the
custom OAuth gateway.

## 7. Environment variables

If hosting on Vercel or any platform with env var config, no domain-specific
vars exist in the codebase today. `VITE_FIREBASE_*` keys are project-scoped,
not domain-scoped.

## What does NOT need to change

- Any code in `src/` — no hardcoded domain anywhere
- `firestore.rules` — domain-agnostic
- Firebase project config (`VITE_FIREBASE_*`) — scoped to project ID, not domain
- `vite.config.js` — uses relative `base: './'`
