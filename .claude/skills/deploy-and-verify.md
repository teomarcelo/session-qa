# Deploy and Verify

Run the full deploy sequence safely and confirm GitHub Pages updated correctly.

## Steps

### 1. Check current branch
```bash
git branch --show-current
```

- If branch is `main` → proceed to step 2.
- If branch is anything else → warn Teo:

  > ⚠️ You are on branch `[branch name]`, not `main`. Deploying from a non-main branch is unusual. Do you want to continue anyway?

  Wait for explicit confirmation before proceeding.

### 2. Run build
```bash
npm run build
```

If the build fails, stop and report all errors. Do not proceed to step 3.

### 3. Remind Teo to push manually
The build passed. Tell Teo:

> ✅ Build passed. When you're ready to deploy, run:
> ```
> git push origin main
> ```
> Do not push until you've confirmed this is intentional.

### 4. After Teo confirms push is done
Provide the GitHub Actions URL for Teo to watch the deploy:

**https://github.com/teomarcelo/session-qa/actions**

Tell Teo to wait for the green checkmark on the latest workflow run.

### 5. Verify both pages after deploy
Once the green checkmark appears, ask Teo to verify both URLs:

- **https://teomarcelo.github.io/session-qa/student.html**
- **https://teomarcelo.github.io/session-qa/instructor.html**

### 6. Confirm deploy complete
Ask Teo:

> Do both pages load correctly? If yes, the deploy is complete. If anything looks wrong, do not declare done — investigate first.
