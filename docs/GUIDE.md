# Crowns — The Complete Guide

Everything you need to understand the game, test it, and launch it, plus the known gaps and the decisions still waiting for you.

**Contents**
1. What was built
2. Concepts you need (beginner level)
3. Project map
4. How the puzzle generator works
5. How to test it (step by step)
6. How to launch it to other people
7. Releasing an update
8. Costs
9. Gaps, risks and future ideas
10. Decisions log and your answers to open questions

---

## 1. What was built

**Crowns** is a queens logic puzzle in the style of LinkedIn's "Queens", with **1000 levels** that can be played in any order, at any time.

- **Rules:** place one crown in each row, each column and each colour region. No two crowns may touch, even diagonally.
- **Levels:**
  - Levels 1–10 are 5×5 Easy. Boards grow to 10×10 Medium/Hard from level 151.
  - Each level is generated on the phone from its number, so everyone gets the same level 37.
  - Every puzzle has exactly **one** solution and can be solved **without guessing**.
- **Features:**
  - tap cycles ×/crown;
  - drag to mark many ×s;
  - auto-× around crowns;
  - mistake highlighting;
  - undo and clear;
  - hints;
  - timer with best times;
  - progress saved automatically;
  - a level picker with solved ticks;
  - dark mode;
  - an installable app icon;
  - fully offline.
- **No backend, no account, no running cost.** All data stays on the player's device.

The working name is "Crowns", chosen to stay clear of LinkedIn's "Queens" brand. See Open question Q1.

---

## 2. Concepts you need

| Term | Plain-English meaning |
|---|---|
| **HTML** | The page's structure (buttons, headings, the board container). `index.html`. |
| **CSS** | The looks (colours, sizes, layout). `style.css`. |
| **JavaScript (JS)** | The behaviour (what happens when you tap). `*.js`. |
| **Browser engine** | The program that runs HTML/CSS/JS. Every phone has one (Chrome on Android, Safari on iPhone). |
| **Native app** | An app written for one platform (Kotlin for Android, Swift for iOS), installed from a store. |
| **PWA (Progressive Web App)** | A website that behaves like an app: installable to the home screen, full-screen, works offline. **That is what Crowns is.** |
| **Manifest** (`manifest.webmanifest`) | A small file telling the phone the app's name, icon and colours, and that it can be installed. |
| **Service worker** (`sw.js`) | A background script that saves the app's files on the device and serves them when there's no internet. |
| **localStorage** | A small key→value store the browser keeps per website. Holds your progress. |
| **Hosting** | Putting files on a public web address. **GitHub Pages** does this free, over HTTPS. |
| **HTTPS** | Encrypted web address. Required for service workers and app installs. |
| **TWA (Trusted Web Activity)** | An Android app that is a thin shell showing your PWA full-screen. This is how a PWA gets into the Play Store. |
| **PWABuilder** | A free website by Microsoft that turns a PWA URL into a Play Store package. |
| **Backtracking** | A search method: try an option, go deeper, undo it if it leads to a dead end, try the next one. |
| **Seed / PRNG** | A pseudo-random number generator produces "random-looking" numbers from a starting number (the seed). Same seed → same numbers. |

**How a mobile app usually gets built (the big picture).**
1. **Write the code:** native, cross-platform (Flutter/React Native), or web (PWA).
2. **Test it** on emulators and real phones.
3. **Package it:** an `.aab` file for Android, an `.ipa` file for iOS.
4. **Sign it** with a private key that proves you are the author.
5. **Upload it to a store** with screenshots, a description and a privacy policy.
6. **Pass review,** then release.
7. **Ship updates:** new version, re-upload.

**A PWA lets you skip steps 3–7 entirely** if you're happy to share a link. Step 3 becomes a few clicks on PWABuilder if you want the Play Store.

---

## 3. Project map

```
D:\Projects\Queens
├── app\                      <- THE GAME (this folder is what gets published)
│   ├── index.html            screens and dialogs
│   ├── css\style.css         visuals
│   ├── js\engine.js          puzzle generator, solvers, rules (no UI)
│   ├── js\storage.js         save/load progress on the device
│   ├── js\app.js             screens, touch input, timer, hints, winning
│   ├── manifest.webmanifest  install info (name, icons)
│   ├── sw.js                 offline support
│   ├── privacy.html          privacy policy for app stores
│   └── icons\                app icons (made by tools\make_icons.py)
├── tests\
│   ├── engine.test.html      checks 55 generated levels (double-click to run)
│   ├── ui.test.html          plays the game automatically (needs the local server)
│   └── phone-preview.html    4 phone-sized live previews side by side
├── tools\make_icons.py       draws the icons
├── .github\workflows\pages.yml  auto-publish to GitHub Pages
├── docs\GUIDE.md             this file
├── docs\BUILD_JOURNAL.md     step-by-step build log and troubleshooting
└── CLAUDE.md                 instructions/response format for Claude
```

**How the code fits together:** `index.html` loads `engine.js`, then `storage.js`, then `app.js`. `app.js` reads the URL (`#/play/37`) and asks `engine.generateLevel(37)` for the puzzle. It draws the board and listens for taps. After each tap it asks `engine.analyze()` "any conflicts? solved?", and saves through `storage.js`.

---

## 4. How the puzzle generator works

All of this lives in `app/js/engine.js`. Read the comments there alongside this section.

1. **Seed:** level number → seed → `mulberry32` random generator. The same level number always gives the same sequence of "random" numbers.
2. **Place a secret solution:** one queen per row and per column, with neighbouring rows ≥ 2 columns apart (backtracking).
3. **Grow regions:** each queen starts a region, and regions expand into random neighbouring cells until the board is full.
4. **Make it unique:** an exact solver looks for a second solution. If it finds one, a cell used by that other solution is handed to a neighbouring region, which breaks it. Repeat until only our solution is left.
5. **Rate it like a human:** a solver that only uses human logic (tiers Easy/Medium/Hard; see BUILD_JOURNAL Step 3). If it can't finish, the puzzle needs guessing and is thrown away.
6. **Match the level's difficulty band.** If the puzzle is too easy or too hard for its level, try again (up to 500 tries; usually 1–40).

**Why generate rather than store puzzles?** No puzzle files to manage, unlimited levels, and a tiny download (the whole app is about 125 KB including icons).

**The trade-off:** if you change the generation code, every level changes. See Gap G3.

**Exercise for learning:** in `engine.js`, change level 1–10's size from 5 to 4 in `BANDS`, then open `tests/engine.test.html`. What happens? (Hint: can 4 queens avoid touching on a 4×4 board?) Undo the change afterwards.

---

## 5. How to test it

### 5.1 Quickest: on your laptop
1. Open `D:\Projects\Queens\app\` in File Explorer.
2. Double-click `index.html`. It opens in your browser and is fully playable.
3. Offline caching doesn't run in this mode; everything else does.

### 5.2 Phone-sized view on the laptop
- Double-click `tests\phone-preview.html` to see 4 live phone screens.
- Or, in Chrome/Edge on `index.html`: press **F12**, then the phone/tablet icon (**Ctrl+Shift+M**), and pick a device like "Pixel 7".

### 5.3 Automated tests
- **Engine:** double-click `tests\engine.test.html`. It should end with `RESULT: ALL PASSED`.
- **Gameplay (needs the local server):**
  1. Open a terminal (VS Code → Terminal → New Terminal) in `D:\Projects\Queens`.
  2. Run: `py -m http.server 8765 --bind 127.0.0.1`
  3. In the browser, open `http://127.0.0.1:8765/tests/ui.test.html`. Expect `RESULT: ALL PASSED` (21 checks).
  4. You can also play with offline mode active at `http://127.0.0.1:8765/app/`.
  5. Stop the server with **Ctrl+C** in the terminal.

### 5.4 Test offline mode on the laptop
1. With the server running, open `http://127.0.0.1:8765/app/` and wait a few seconds.
2. Press F12 → **Application** tab → **Service Workers**. It should show `sw.js` as "activated and is running".
3. Tick **Offline** (in the same panel), then reload. The game still loads.
4. Or stop the server and reload: it still works.

### 5.5 Test on your own phone
Pick one option:

- **A. Through GitHub Pages (recommended).** Needs a GitHub account: see 6.1, about 15 minutes. You get a real `https://` link, so install and offline both work exactly as they will for players.
- **B. USB cable plus Chrome port forwarding, Android only.** No network exposure.
  1. On the phone: Settings → About phone → tap "Build number" 7 times → Developer options → enable **USB debugging**.
  2. Connect the phone by USB, and run the server on the PC (5.3).
  3. In Chrome on the PC, open `chrome://inspect/#devices` → **Port forwarding** → add `8765` → `127.0.0.1:8765` → tick "Enable port forwarding".
  4. On the phone's Chrome, open `http://localhost:8765/app/`. Install and offline both work because the address is "localhost".
- **C. Same Wi-Fi.** Run `py -m http.server 8765` (all interfaces) and open `http://<your-PC-IP>:8765/app/` on the phone.
  - Windows Firewall will ask for permission. That's a system configuration change, so **check with IT first**, as your company policy requires.
  - Offline mode won't activate over plain `http` on an IP address.

### 5.6 What to check before you're convinced (manual test checklist)
- [ ] Levels 1, 11, 31, 61, 101 and 151 load; 10×10 shows "Preparing puzzle…" briefly.
- [ ] Tap: × → crown → empty. Drag marks ×s. Dragging from an × erases ×s.
- [ ] Touching crowns and two crowns in one row, column or region turn red.
- [ ] Undo, Clear and Hint behave sensibly.
- [ ] Solving shows the win dialog. Next level works. The level picker shows a tick and your time.
- [ ] Leave mid-level, close the browser, reopen: the board and timer are restored.
- [ ] The timer pauses when you switch apps.
- [ ] Phone Back button: game → levels → home.
- [ ] Settings toggles work; Reset clears everything.
- [ ] Install to the home screen (Chrome menu → "Install app", or Safari → Share → "Add to Home Screen"). Then turn on flight mode and play.
- [ ] Try it on a cheap or old phone and note how long 10×10 levels take to load.
- [ ] Ask 3–5 friends to play 10 levels each and note where they get stuck or confused.

---

## 6. How to launch it to other users

Launch in stages. Each stage is optional and builds on the one before.

### 6.1 Stage 1: a free public link (GitHub Pages). Cost: ₹0.

> ⚠️ **Do this from a personal GitHub account, and check Gap G1 (company device/IP) first.** Publishing makes the code and app public.

1. Create a free account at https://github.com.
2. Click **New repository**. Name it e.g. `crowns` and make it **Public** (free Pages needs public repositories). Don't add a README.
3. In a terminal in `D:\Projects\Queens`:
   ```bash
   git init
   git add .
   git commit -m "Crowns v1.0"
   git branch -M main
   git remote add origin https://github.com/<your-username>/crowns.git
   git push -u origin main
   ```
   The first push opens a browser window to sign in to GitHub.
4. On GitHub: repo → **Settings → Pages → Source: GitHub Actions**.
5. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to turn green (about 1 minute).
6. Your game is live at `https://<your-username>.github.io/crowns/`. Share this link.
7. Players on Android tap Chrome menu → **Install app**. On iPhone they use Safari → Share → **Add to Home Screen**. After that it works offline.

### 6.2 Stage 2: Google Play Store (Android). Cost: US$25 once.

1. **Domain prerequisite.**
   - For the Play Store version to hide the browser address bar, Android must verify that you own the website. It does this through a file at `https://<domain>/.well-known/assetlinks.json`, at the **root** of the domain.
   - A project site (`username.github.io/crowns`) can't put files at the root. So either:
     - (a) rename the repo to `<username>.github.io`, so the app lives at the root; or
     - (b) buy a domain (about ₹800–1,500 a year) and point it at GitHub Pages.
2. Go to https://www.pwabuilder.com → enter your game URL → **Package for stores → Android**.
   - It produces an `.aab` file (the app), a **signing key** and an `assetlinks.json`.
   - **Back up the signing key and its passwords in two safe places. If you lose it, you can never update the app.**
3. Put `assetlinks.json` in `app/.well-known/` and redeploy.
4. Create a Google Play Console developer account: https://play.google.com/console. It needs the US$25 fee and identity verification.
5. Create the app listing:
   - name, short and full description;
   - icon (512px, use `app/icons/icon-512.png`);
   - feature graphic 1024×500;
   - at least 2 phone screenshots;
   - category Games → Puzzle;
   - content rating questionnaire;
   - **Data safety** form: "no data collected";
   - privacy policy URL: `.../privacy.html` (add your email to it first).
6. **Closed testing first.** Google requires new *personal* developer accounts to run a closed test with a minimum number of testers (12 when last checked) for 14 days before a public release. Recruit friends early. *Rules change, so check the current requirement in Play Console.*
7. Apply for production access, then release. Review usually takes from a few days to about a week.

### 6.3 Stage 3 (optional): iPhone App Store. Cost: US$99 a year plus a Mac.
- iPhone users can already install the PWA from Safari (6.1) at no cost.
- A real App Store app needs an Apple Developer account (US$99 a year), a Mac with Xcode, and a native wrapper such as Capacitor, which needs Node.js installed (an IT approval item).
- Apple also sometimes rejects apps that are "just a website", so you'd need to add value with native features.
- **Recommendation:** skip this until Android shows real demand.

### 6.4 Other optional channels
- **Microsoft Store:** PWABuilder can also package for Windows.
- **itch.io:** free hosting for web games, with a built-in gamer audience.

---

## 7. Releasing an update

1. Make the change and test it (section 5).
2. **Bump `CACHE_VERSION` in `app/sw.js`** (`crowns-v1` → `crowns-v2`), otherwise players keep running the old cached version.
3. If you added a new file to `app/`, add it to the `ASSETS` list in `sw.js`.
4. Commit and push; GitHub Pages redeploys automatically.
5. Players get the new version the next time they open the app while online (it may take two launches).
6. Play Store: the TWA loads your website, so most updates need **no** new store upload. Only changes to the name, icon or package need a new `.aab` (with an increased version code) uploaded through PWABuilder.
7. **Never change puzzle-generation code** (anything in `engine.js` above the "board analysis" section) after launch unless you mean to. It changes every level for everyone. If you must, bump `GENERATOR_VERSION`. See G3.

---

## 8. Costs

| Item | Cost | Needed? |
|---|---|---|
| Development tools (browser, VS Code, Python, Git) | ₹0 (already installed) | Yes |
| Hosting (GitHub Pages) | ₹0 | Yes, for sharing |
| Backend / database | ₹0 (none exists) | No |
| Custom domain | ~₹800–1,500 a year | Only for the Play Store route 6.2(b) |
| Google Play developer account | US$25 once | Only for the Play Store |
| Apple Developer Program | US$99 a year, plus a Mac | Only for the App Store |

---

## 9. Gaps, risks and future ideas

### Gaps and risks (please read)

| # | Gap / risk | Why it matters | Suggested action |
|---|---|---|---|
| **G1** | **Built on a company laptop with a company account** | Employment agreements often claim IP created on company equipment, and publishing code from a company device may break IT policy | Check with your manager or IT (help.cis@tallysolutions.com) before publishing. Publish from a personal GitHub account |
| **G2** | **Name and look vs LinkedIn** | "Queens" is LinkedIn's game name. Copying their exact branding or colours risks a store takedown. Puzzle *rules* are generally not protected (this genre is known as "Star Battle"), but this is not legal advice | Keep a distinct name (Q1). Don't mention LinkedIn in store listings |
| **G3** | **Levels come from the code** | Changing `engine.js` changes every level and confuses players' saved progress | Freeze the generator after launch. A future option is to export the levels once into a fixed `levels.json` |
| **G4** | **Progress lives only on one device** | Clearing browser data or changing phone loses it. iOS may delete storage of non-installed web apps after weeks of no use | Add an "Export/Import progress code" feature (no backend needed) |
| **G5** | **10×10 generation speed on slow phones** | Up to 0.7 s on a laptop, possibly 2–3 s on a budget phone | Generate the next level in the background, or pre-compute levels |
| **G6** | **Colour-blind players** | Regions are told apart by colour (thick borders help) | Add an option that draws a pattern or letter per region |
| **G7** | **The difficulty rating is a heuristic** | "Hard" may feel easy or hard to real players | Playtest; adjust `BANDS` *before* launch (it changes levels; see G3) |
| **G8** | **No usage insight** | No analytics, by design. You won't know how many people play | The Play Console shows installs. Privacy-friendly analytics would need a service and a privacy-policy update |
| **G9** | **Hints only reveal, they don't teach** | Players learn more from "why" | Use `logicSolve` to explain the next logical step ("Purple fits only in row 3…") |
| **G10** | **Undo history isn't saved** | After a reload, Undo starts empty | Minor; could save it with the progress |
| **G11** | **Play Store new-account testing rule** | You need a number of testers for 14 days before going public | Line up friends early (6.2 step 6) |
| **G12** | **No source control yet** | No history or backups of changes | Run `git init` (6.1) even before publishing. Commit after every working change |

### Future feature ideas (none need a backend)
- **Daily puzzle:** seed from today's date, so everyone gets the same one. No server needed.
- **Streaks and achievements:** stored locally.
- **Sound effects and vibration** on placing a crown or winning (`navigator.vibrate`).
- **Share result:** e.g. "Crowns #37 solved in 1:42 👑", via the Web Share API.
- **"Teach me" hints** (G9) and a **colour-blind mode** (G6).
- **Bigger boards** (11×11) for experts.

---

## 10. Decisions log and your answers to open questions

### Decisions made (defaults chosen so work could continue; tell Claude to change any of them)

| # | Decision | Reason | Date |
|---|---|---|---|
| D1 | PWA with plain HTML/CSS/JS, no build tools | Nothing to install (company policy), runs everywhere, free, easiest to learn | 2026-10-02 |
| D2 | Puzzles generated on the device from the level number | Unlimited levels, no server, tiny app | 2026-10-02 |
| D3 | 1000 levels, all unlocked | You asked that players can play any level at any time | 2026-10-02 |
| D4 | Difficulty bands: 5×5 → 10×10 (see engine.js `BANDS`) | Gentle learning curve similar to LinkedIn Queens | 2026-10-02 |
| D5 | Working name "Crowns" with a crown icon | Avoids LinkedIn's "Queens" brand | 2026-10-02 |
| D6 | Controls copy LinkedIn's: tap = ×, tap again = crown, drag = many × | Familiar to the target players | 2026-10-02 |
| D7 | Hints reveal a wrong crown, a wrong ×, or one correct crown, and are counted | Simple, always helpful | 2026-10-02 |

### Open questions: please answer (edit this file, or just tell Claude)

| # | Question | Your answer |
|---|---|---|
| Q1 | Is **"Crowns"** OK as the app name? If not, what? | _pending_ |
| Q2 | Should all levels stay **unlocked**, or must players unlock them in order? | _pending_ |
| Q3 | Which launch targets: link only / **Play Store** / App Store? | _pending_ |
| Q4 | Is this a **personal** project? Have you checked side-project and IP rules with your employer? (G1) | _pending_ |
| Q5 | Any plan to **make money** (ads, paid app, tip jar)? Note: ads need internet and an SDK, which conflicts with offline-only and needs a privacy-policy change | _pending_ |
| Q6 | After playing: is the difficulty curve right (too easy or too hard early on)? | _pending_ |
| Q7 | Which future features (section 9) would you like next? | _pending_ |
