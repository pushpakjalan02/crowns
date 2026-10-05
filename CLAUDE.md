# CLAUDE.md — Crowns (queens puzzle PWA)

## Who I'm working with
The owner is new to app development, and **learning is a primary goal**, equal to shipping the game. Explain the "why" as well as the "what", define jargon the first time it appears, and keep the docs up to date.

## Project facts
- Offline-only PWA. Plain HTML/CSS/JS, **no build step, no backend**. The game is in `app/`.
- `app/js/engine.js` holds the pure puzzle logic. **Changing generation code changes every level** (see docs/GUIDE.md G3).
- When any file in `app/` changes, bump `CACHE_VERSION` in `app/sw.js`. Add new files to its `ASSETS` list.
- Tests: `tests/engine.test.html` (double-click) and `tests/ui.test.html` (needs `py -m http.server 8765 --bind 127.0.0.1`). To run them headless, see docs/BUILD_JOURNAL.md.
- Available tools: Python (`py`, not `python3`), Git, VS Code, Edge/Chrome. **No Node.js.**
- Company policy: don't install software or change system configuration (firewall etc.) without the owner confirming IT authorisation. Never publish or push anything without asking.

## Documentation duties (every task)
1. Append a dated section to `docs/BUILD_JOURNAL.md`: goal, files changed, exact commands and key output, problems and fixes, test results.
2. Update `docs/GUIDE.md` if concepts, testing, launch steps, gaps or costs changed.
3. Record the owner's answers and decisions in GUIDE.md section 10, with the date. Move answered questions from "pending" to an answer.

## Response format
Use these sections, in this order. Drop any that genuinely don't apply. For a quick factual question, answer in a few lines with the TL;DR and a "Learn" note only.

**1. TL;DR**: 1–3 sentences: the answer, or what was done and whether it works (tested or not).

**2. What I did / the answer**: the substance. For code changes, list files and what changed in each, plus `file:line` references.

**3. How it works**: plain-language explanation of the concept or mechanism, with an analogy if it helps. Assume no prior knowledge; define new terms.

**4. How to verify it yourself**: exact clicks or commands, and what you should see.

**5. Decisions & trade-offs**: what was chosen, the main alternative, and why. Flag anything that's hard to undo.

**6. Beyond the code**: only the aspects that apply: cost, legal/licensing/trademark, privacy, company policy, app-store rules, user experience, accessibility, maintenance burden, risk to players' saved progress.

**7. Learn**: one or two concepts worth understanding next, with a small hands-on exercise in this codebase.

**8. Questions for you**: decisions only the owner can make, each with a recommended default. Mirror them in GUIDE.md section 10.

**9. Docs updated**: which sections of BUILD_JOURNAL.md / GUIDE.md were updated.

Style: short sentences, tables for comparisons, no unexplained acronyms, and an honest statement of what was **not** tested.
