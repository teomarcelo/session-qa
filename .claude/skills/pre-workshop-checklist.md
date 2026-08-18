# Pre-Workshop Checklist

Run this before every Salesforce workshop to confirm everything is working.

## Steps

### 1. Confirm Firebase project
Read `.firebaserc` and confirm the default project is `tdx-qa`.

```bash
cat .firebaserc
```

Report the project name. If it's not `tdx-qa`, flag it as a blocker.

### 2. Confirm storage rules are deployed
Check that `firebase.json` exists and `storage.rules` exists.

```bash
ls firebase.json storage.rules 2>&1
```

If either file is missing, flag it as a blocker.

### 3. Run build
```bash
npm run build
```

If the build fails, flag it as a blocker and show the error output.

### 4. Confirm CLAUDE.md production warning
```bash
grep -c "ACTIVE production" CLAUDE.md
```

If the count is 0, flag it — CLAUDE.md may have been modified.

### 5. Remind Teo to verify live URL manually
Ask Teo to open this URL in a browser and confirm it loads:
**https://session-qa.web.app/student.html**

Production is Firebase Hosting. The old GitHub Pages URL
(`teomarcelo.github.io/session-qa/`) is retired and returns 404.
`tdx-qa.web.app` still resolves but only as a 301 to the address above.

### 6. Remind Teo to confirm Firebase spending limit
Ask Teo to verify the $1 Firebase Storage spending limit is still active at:
**https://console.firebase.google.com/project/tdx-qa/usage/details**

### 7. Print GO / NO-GO
Based on steps 1–4:
- If all pass → print **✅ GO — all automated checks passed. Verify steps 5–6 manually before starting.**
- If any fail → print **❌ NO-GO — [list the failing checks]**
