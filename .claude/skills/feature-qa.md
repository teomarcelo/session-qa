# Feature QA

After any code change, verify core features still work. Call this after every phase of the React refactor.

## Steps

### 1. Run build
```bash
npm run build
```

If the build fails, stop and report errors. Do not proceed.

### 2. Start dev server
```bash
npm run dev &
```

Confirm the dev server starts successfully and is available at `http://localhost:5173`.

### 3. Print manual testing checklist

Tell Teo to work through the following checklist. Ask them to check off each item.

---

**STUDENT APP** — http://localhost:5173/student.html

- [ ] Page loads without console errors
- [ ] Session code join works (SQA- prefix)
- [ ] Can post a question
- [ ] Can upvote a question
- [ ] Image paste shows preview
- [ ] Image uploads and renders in question card
- [ ] Pagination works (Load older)
- [ ] Rich text formatting renders correctly
- [ ] Session details sidebar shows correctly
- [ ] Sidebar resize works

---

**INSTRUCTOR APP** — http://localhost:5173/instructor.html

- [ ] Page loads without console errors
- [ ] Login works
- [ ] Can create a new session
- [ ] Can join existing session
- [ ] Questions appear in real time
- [ ] Can answer a question
- [ ] Answer draft persists across re-renders
- [ ] Can pin, delete, mark pending
- [ ] Can mark answered verbally
- [ ] Filters work (all / pinned / pending / answered)
- [ ] Sort works (recent / most voted)
- [ ] Search works
- [ ] Instructor notes save and show to students
- [ ] Session settings save correctly
- [ ] Stats update correctly
- [ ] Demo mode works
- [ ] Student view toggle works
- [ ] Sidebar resize works

---

### 4. Wait for Teo to confirm

Ask Teo to confirm all checklist items before declaring the phase done.

> Please check off all items above and confirm everything is passing before we move on.
