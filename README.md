# outgrow

**A Claude Code skill that explains your code to you — and slowly stops, as you learn.**

Every other tool wants you dependent forever. This one is built to become unnecessary.

---

## The problem

You are building something — an app, a site, a script, an automation. The screen fills with words nobody explained to you.

```
npm WARN deprecated inflight@1.0.6: This module is not supported
added 1417 packages, and audited 1418 packages in 34s
12 vulnerabilities (5 moderate, 7 high)
```

Is that bad? Did you break something? Should you stop?

Nobody tells you that this is completely fine. So you either panic, or you learn to ignore all red text — and then miss the one that mattered.

## What it does

**Explains in plain English.** Every technical word gets human words beside it, in place, as it appears.

**Tells you if you are broken.** Every scary output gets one verdict:

- ✅ **Normal** — ignore it
- ⚠️ **Warning** — works now, bites later
- 🛑 **Broken** — fix this first

**Warns before the expensive mistakes.** Three things always get flagged in plain words, forever:

- 💸 costs money
- ⛔ cannot be undone
- 🔑 exposes a secret

**Then it fades.** It counts how many times you have met each term. Seen it twice, you get the full explanation. Seen it five times, a short tag. Seen it six, nothing at all — you know it now.

Your session gets quieter as you get better. That is the whole point.

---

## Before / after

<table>
<tr><th>What the screen says</th><th>What outgrow says</th></tr>
<tr valign="top"><td>

```
Error: listen EADDRINUSE:
address already in use :::3000
```

</td><td>

🛑 **Broken** — but usually good news.

Your app is already running. It cannot start a second copy in the same doorway.

**Check your other tabs — it is probably already open at http://localhost:3000.**

</td></tr>
<tr valign="top"><td>

```
CONFLICT (content): Merge conflict
in src/app/page.tsx
Automatic merge failed
```

</td><td>

🛑 **Broken**, but nothing is lost.

You and someone else changed the same lines, and the computer will not guess which version wins.

Both versions are still in the file, marked. Somebody picks which to keep.

</td></tr>
</table>

More examples: [examples.md](examples.md)

---

## Install

In Claude Code, run these two lines:

```
/plugin marketplace add Rakshit-Droid/outgrow
/plugin install outgrow@outgrow
```

That is it. Build something. It switches itself on.

To turn it off for a session, say `stop outgrow`.

<details>
<summary>Prefer to install by hand?</summary>

```bash
git clone https://github.com/Rakshit-Droid/outgrow /tmp/outgrow
cp -r /tmp/outgrow/skills/outgrow ~/.claude/skills/outgrow
```

The skill is the folder `skills/outgrow`. It needs `SKILL.md` and `glossary.json` sitting together.

</details>

---

## How the fading works

It keeps a small file in your project:

```json
{ "terms": { "npm install": 3, "localhost": 6 } }
```

That is the only state it keeps. Delete the file to start over from full explanations.

Danger flags never fade. Money, deletion, and secrets get called out no matter how much you have learned.

---

## Adding words

Everything lives in one file: [glossary.json](skills/outgrow/glossary.json).

```json
{
  "term": "hydration error",
  "plain": "The page the server built and the page the browser built came out different.",
  "analogy": "Two people drawing the same picture from the same instructions, getting different results.",
  "triage": "warning",
  "danger": null,
  "next": "The page usually still works. Common cause is showing the current time or a random value."
}
```

Rules for a good entry:

- `plain` is **one sentence**, and says what it means *for the thing the reader is building* — not what it means in computer science
- no technical term inside the explanation of a technical term
- `next` is required. A definition with no next step is useless to someone building something
- `analogy` stays fixed forever. Same comparison every time is what makes it stick

**A wrong explanation is worse than jargon**, because people act on it confidently. If you are not sure, do not guess.

Pull requests welcome. Adding a term is a one-file change.

---

## What it deliberately does not do

- **Does not fix things for you.** Explaining and then silently acting removes the learning, and destroys trust the first time it is wrong.
- **Does not reword your commands.** You must be able to retype exactly what you ran.
- **Does not soften security warnings.** Plain words, but never shortened.
- **Does not simplify error text.** Errors are quoted exactly, then explained beside. Simplify the explanation, never the artifact.

---

## Licence

MIT.
