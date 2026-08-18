# Deploy and Verify

Run the full deploy sequence safely and confirm Firebase Hosting updated correctly.

## How this app actually deploys (read first)

Production is **Firebase Hosting** at **https://session-qa.web.app**, published by
running the Firebase CLI by hand. There is no CI deploy.

- The Firebase **project id is still `tdx-qa`** and every `--project` flag keeps
  that value. Only the public domain changed. `session-qa` is a Hosting *site*
  inside the `tdx-qa` project, not a project of its own — a `.web.app` domain
  comes from the site id. Renaming the project in these commands breaks them all.
- Hosting has two targets: `app` (site `session-qa`, serves `dist/`) and `legacy`
  (site `tdx-qa`, 301-redirects everything to `session-qa.web.app`).
- `https://tdx-qa.web.app` now redirects, preserving path and query string, so
  older links carrying a session code still work.
- Pushing to `main` deploys **nothing**. The old `.github/workflows/deploy-pages.yml`
  no longer exists in the repo.
- GitHub Pages is **retired**. `https://teomarcelo.github.io/session-qa/` returns 404.
- Never deploy the working tree. It routinely holds unfinished work. Always build
  from a clean checkout of committed `HEAD`.

## Steps

### 1. Check current branch
```bash
git branch --show-current
```

- If branch is `main` → proceed to step 2.
- If branch is anything else → warn Teo:

  > ⚠️ You are on branch `[branch name]`, not `main`. Deploying from a non-main branch is unusual. Do you want to continue anyway?

  Wait for explicit confirmation before proceeding.

### 2. Confirm what is about to ship
```bash
git log --oneline origin/main -5
curl -sI https://session-qa.web.app/student.html | grep -i last-modified
```

List every commit made since that `last-modified` date. Deploys have lagged by
weeks before, so a single-line fix can carry a month of unshipped work with it.
Show Teo that list and get confirmation before continuing.

### 3. Build from a clean checkout, never the working tree
```bash
git worktree add --detach /tmp/sqa-deploy origin/main
ln -s "$(pwd)/node_modules" /tmp/sqa-deploy/node_modules
cd /tmp/sqa-deploy && npm run build
```

If the build fails, stop and report all errors. Do not proceed.

### 4. Deploy
Deploy the app target first and verify it before touching the redirect, so a bad
build never becomes the only thing every old link points at:

```bash
cd /tmp/sqa-deploy && npx firebase-tools deploy --only hosting:app --project tdx-qa
```

The `legacy` redirect target rarely changes; redeploy it only when its config in
`firebase.json` changed, and only after the step below passes:

```bash
cd /tmp/sqa-deploy && npx firebase-tools deploy --only hosting:legacy --project tdx-qa
```

Only `hosting`. Deploying rules requires a separate explicit decision:

```bash
npx firebase-tools deploy --only firestore:rules --project tdx-qa
npx firebase-tools deploy --only storage --project tdx-qa
```

### 5. Verify the new bundle is actually serving
```bash
curl -s https://session-qa.web.app/student.html | grep -o 'assets/student-[A-Za-z0-9_-]*\.js'
```

Compare against the hash in `/tmp/sqa-deploy/dist/`. They must match. A 200 alone
proves nothing, the old build also returns 200.

If the `legacy` target was redeployed, confirm the redirect still carries path and
query, or links with a session code silently lose it:

```bash
curl -sI "https://tdx-qa.web.app/student.html?code=SQA-TEST" | grep -i '^location'
# expect: https://session-qa.web.app/student.html?code=SQA-TEST
```

### 6. Clean up
```bash
git worktree remove /tmp/sqa-deploy --force
```

### 7. Confirm with Teo
Ask Teo to open both pages and confirm they load and behave correctly:

- **https://session-qa.web.app/student.html**
- **https://session-qa.web.app/instructor.html**

> Do both pages load correctly? If yes, the deploy is complete. If anything looks wrong, do not declare done — investigate first.

### 8. Watch cost for 24 hours after any student-side change
Student code runs in every attendee's browser, so a render or polling regression
bills real money. Check the Firestore read count the next day:

**https://console.firebase.google.com/project/tdx-qa/usage**
