# Test Image Upload

Validate the full Firebase Storage image pipeline is working before a live event.

## Steps

### 1. Check upload function exists in firebaseCompat.js
```bash
grep -n "upload" src/lib/firebaseCompat.js
```

Look for an upload function (e.g. `uploadImage`, `uploadFile`, or a reference to `storage.ref(...).put(...)`). Report what was found. Flag as missing if no upload function is present.

### 2. Check storage.rules allows writes under sessions/*/images/
Read `storage.rules` and look for a rule that allows writes matching the path `sessions/{code}/images/{filename}` or equivalent.

```bash
cat storage.rules
```

Report whether write access to `sessions/*/images/` is present. Flag if missing.

### 3. Check storage-cors.json for the production origin
```bash
cat storage-cors.json
```

Confirm `https://session-qa.web.app` is in the `origin` array — that is the live
Firebase Hosting origin, and Storage CORS is exact-origin. Flag if missing.

### 4. Check IMG_MAX_EDGE and IMG_JPEG_Q constants
```bash
grep -n "IMG_MAX_EDGE\|IMG_JPEG_Q" src/constants/app.js
```

Confirm both constants exist. Flag either one that is missing.

### 5. Print summary
Report what was found for each step — present, missing, or needs attention.

### 6. Remind Teo to do a manual live test
Ask Teo to complete this manual verification:

1. Open **https://session-qa.web.app/student.html**
2. Join a session with a valid SQA- code
3. Paste a screenshot into the ask box
4. Confirm image preview appears before submit
5. Submit the question
6. Confirm the image renders correctly in the question card

Report back once manual test is complete.
