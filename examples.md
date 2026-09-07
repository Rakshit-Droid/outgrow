# Examples

The outputs that scare people most, and what outgrow says instead.

**Read these as a test.** If any explanation still leaves you confused, that wording is wrong and should be changed in [glossary.json](skills/outgrow/glossary.json). Confusion is the only measure that matters here.

---

## 1. Install finished with a wall of yellow

```
npm WARN deprecated inflight@1.0.6: This module is not supported
npm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
added 1417 packages, and audited 1418 packages in 34s
12 vulnerabilities (5 moderate, 7 high)
```

✅ **Normal.** Two separate things happened.

The yellow `WARN deprecated` lines mean some borrowed code pieces are old and no longer looked after by the people who made them. They still work.

`12 vulnerabilities` sounds alarming but is not, today — those are known weaknesses in pieces buried deep inside, and your app is only running on your own computer where nobody else can reach it. Worth handling before you put the app on the internet.

The line that matters is `added 1417 packages` — that worked.

**Carry on.**

---

## 2. App will not start

```
Error: listen EADDRINUSE: address already in use :::3000
```

🛑 **Broken** — but this one is usually good news.

Your app is already running somewhere. It cannot start a second copy in the same doorway (port 3000 — the numbered door your app sits behind).

**Check your other browser tabs and terminal windows first.** It is probably already open at http://localhost:3000. If it is, nothing is wrong at all.

---

## 3. Page says 404

```
GET /dashbord 404 in 82ms
```

🛑 **Broken.** The address you asked for does not exist.

Look at the address: `/dashbord`. Missing an `a`. It should be `/dashboard`.

**Check the address in the browser bar for a typo before anything else.** That is the cause most of the time.

---

## 4. Red text mentioning "hydration"

```
Error: Text content does not match server-rendered HTML.
Warning: Expected server HTML to contain a matching <div> in <div>.
```

⚠️ **Warning.** Your page probably still works.

The page your server built and the page your browser built came out slightly different, so the browser complained. Two people drawing the same picture from the same instructions, getting different results.

The usual cause is showing something that changes every moment — the current time, or a random number.

**Refresh the page. If it looks right, you can leave this for later.**

---

## 5. Everything froze, then crashed

```
FATAL ERROR: Reached heap limit Allocation failed -
JavaScript heap out of memory
```

🛑 **Broken.** Your app asked for more of the computer's short-term memory than exists. A desk too small for the pile of paper on it.

Two usual causes: a loop with no end that keeps piling things up, or a file too big to open all at once.

**Tell me what you changed just before this started.** That is almost always where it is.

---

## 6. Cannot save or delete a file

```
EACCES: permission denied, open 'C:\Users\you\project\data.json'
```

🛑 **Broken.** Your computer refused. A door needing a key you are not carrying.

On Windows this is usually not a permissions problem at all — the file is open in another program, and that program is holding it.

**Close the file in your editor or Excel, then try again.** Check that before anything else.

---

## 7. About to put your app on the internet

```
vercel deploy --prod
```

💸 **Costs money.**

This puts your app live on the internet where anyone can open it. Small apps are free on Vercel, but you get charged if a lot of people visit, or if something in your code calls a paid service in a loop.

⛔ **Cannot be undone easily.** This is the real version. Mistakes are visible to everyone immediately.

**Worth checking your plan's free limit first. Ready when you say so.**

---

## 8. About to upload your code

```
git push origin main
```

🔑 **Check for secrets first.**

This uploads your code to GitHub. If the repository is public, strangers can read every file you send — and people run automated tools that hunt for passwords and keys in public repositories.

Your `.env` file holds your keys. It should be listed in `.gitignore`, which is the "do not upload" list.

**Confirm `.env` is in your `.gitignore` before this goes up.** If a key gets uploaded, deleting it later does not help — it stays in the history, and it must be replaced with a new one.

---

## 9. The same term, four weeks apart

**Week one:**

> Running `npm install` — getting the pre-made code pieces your app borrows from other people. Like going to the shop for ingredients before cooking.

**Week two:**

> Running `npm install` (getting the borrowed code pieces).

**Week four:**

> Running `npm install`.

Nobody told it to stop. It counted.
