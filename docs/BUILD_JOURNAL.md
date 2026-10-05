# Build Journal — Crowns (Queens puzzle game)

This is a step-by-step log of how the game was built, in the order it happened: every command, what it printed, every problem hit and how it was fixed. You should be able to rebuild the project from scratch by following it.

> Companion documents:
> - `docs/GUIDE.md`: the big picture (concepts, how to test, how to launch, gaps, decisions, open questions).
> - `CLAUDE.md`: the response format Claude follows when you ask questions in this project.

---

## Session 1 — 2 October 2026: from empty folder to a working, tested game

### Step 0. Understand the goal and constraints

| Requirement (from you) | What it means technically |
|---|---|
| Game like LinkedIn "Queens" | N×N grid with N colour regions. Place N queens: one per row, one per column, one per region, and no two touching (diagonals included). |
| Many levels, play any time | No "one per day" limit. All levels are playable at any time. |
| Runs without internet | Everything (code, puzzles, saves) lives on the device. |
| No backend / no running costs | No server, no database, no paid cloud. |
| You want to learn | Simple technology, heavily commented code, and these docs. |

Company policy (organisation instruction): *don't install software or change system configuration without authorisation*. So step 1 was to check what was **already installed**.

### Step 1. Inventory the machine (no installs)

Command (run in Git Bash):

```bash
for c in node npm python python3 py git java code; do printf "%s: " $c; (command -v $c >/dev/null && $c --version 2>&1 | head -1) || echo "not found"; done
```

Output:

```
node: not found
npm: not found
python: Python 3.10.5
python3: Python was not found; run without arguments to install from the Microsoft Store ...
py: Python 3.10.5
git: git version 2.37.0.windows.1
java: not found
code: 1.133.0          <- VS Code
```

Then checked for browsers and the Python imaging library:

```bash
ls "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" "/c/Program Files/Google/Chrome/Application/chrome.exe"
py -c "import PIL; print('PIL', PIL.__version__)"
```

Both browsers were present, and Pillow (PIL) was version 10.4.0.

**Troubleshooting: `python3` "not found".** On Windows, `python3` is often a shortcut to the Microsoft Store installer, not a real Python. Use `py` (the Windows Python launcher) or `python` instead.

### Step 2. Choose the technology

Options considered:

| Option | Needs to install | Runs offline | App-store ready | Learning curve |
|---|---|---|---|---|
| **PWA (plain HTML/CSS/JavaScript)** ✅ | Nothing | Yes (service worker) | Android: yes, via a wrapper (TWA/PWABuilder). iOS: home-screen install only | Lowest |
| React Native / Expo | Node.js, npm packages, Expo account | Yes | Yes (both) | Medium/High |
| Flutter | Flutter SDK, Android Studio, Java | Yes | Yes (both) | High |
| Native Kotlin / Swift | Android Studio / a Mac with Xcode | Yes | Yes (one platform each) | High |

**Decision: a Progressive Web App (PWA) with no build step.**
- It works with only a browser and a text editor, which you already have, so no policy issue.
- The same code runs on Android, iPhone, Windows and Mac.
- It can be published to the Google Play Store later without rewriting.
- Hosting is free (GitHub Pages), and there's no server to pay for.

**Decision: classic `<script>` files, not ES modules (`import`/`export`).** Browsers block ES modules on pages opened by double-clicking (`file://` URLs). Classic scripts work either way, so you can open `app/index.html` straight from Explorer.

### Step 3. Design the puzzle generator (the hard part)

The goal: produce a puzzle with **exactly one solution** that a human can solve **by logic, without guessing**, and the same puzzle every time for a given level number.

Pipeline (in `app/js/engine.js`):

1. **Seeded randomness.** `mulberry32(seed)` is a tiny pseudo-random number generator. The seed comes from the level number, so level 37 is the same puzzle on every phone, and no puzzle file or server is needed.
2. **Random solution first.** `randomSolution(n)` places one queen per row with backtracking:
   - every column is used once;
   - queens in neighbouring rows must be at least 2 columns apart, otherwise they touch diagonally.
3. **Grow regions around the queens.** `growRegions` makes each queen the seed of its own region. Regions then claim random neighbouring empty cells, like paint spreading, until the board is full. So every region is connected and contains exactly one solution queen.
4. **Force uniqueness.** `solveAll` is an exact solver: backtracking with bitmasks, stopping after 2 solutions. If it finds 2, `makeUnique` takes the *other* solution, picks one of its queen cells (never one of ours), and gives that cell to a neighbouring region. That usually breaks the other solution while keeping ours valid. Repeat. If it gets stuck, throw the board away and start again.
5. **Rate the difficulty like a human would.** `logicSolve` uses only human deductions:
   - **Tier 1, Easy:** a row, column or region has only one possible cell left. Or a region's remaining cells all lie in one row or column, which clears the rest of that row or column (and the same in reverse).
   - **Tier 2, Medium:** K regions that fit into exactly K rows or columns claim them (a "pigeonhole" argument).
   - **Tier 3, Hard:** "if a crown went here, some region would have no space left", so that cell is ruled out.
   - If it gets stuck, the puzzle would need guessing, so it is **rejected**.
6. **Shuffle colours** so that a colour never gives away which row its queen is in.

Difficulty curve (the `BANDS` table in engine.js):

| Levels | Board | Allowed tiers |
|---|---|---|
| 1–10 | 5×5 | Easy |
| 11–30 | 6×6 | Easy–Medium |
| 31–60 | 7×7 | Easy–Medium |
| 61–100 | 8×8 | Medium–Hard |
| 101–150 | 9×9 | Medium–Hard |
| 151–1000 | 10×10 | Medium–Hard |

### Step 4. Test the engine before building any UI

Created `tests/engine.test.html`. It generates 55 levels across every board size and checks, for each one:
- the size is right and no region is empty;
- there is exactly 1 solution;
- the stored solution is that solution;
- the logic solver can solve it without guessing;
- the win-detector accepts it.

It also checks determinism and conflict detection.

**Running the tests with no Node.js.** Headless Edge (a browser with no window) runs the page and prints the resulting HTML:

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
  --virtual-time-budget=120000 --dump-dom "file:///D:/Projects/Queens/tests/engine.test.html" \
  2>/dev/null | sed -n '/<pre/,/<\/pre>/p'
```

The easier way: double-click `tests/engine.test.html` and read the page.

Result: **all passed on the first run.** Timings:

```
5x5: avg 1ms    6x6: 1ms    7x7: 3ms    8x8: 7ms    9x9: 30ms
10x10: avg 210ms, worst 725ms (level 151)
```

**Problem: 10×10 boards can take up to ~0.7 s on a laptop, and maybe 2–3 s on a cheap phone.**
Fix in `app.js`: for 9×9 and bigger, show "Preparing puzzle…", then generate after a 30 ms `setTimeout` so the browser can draw the message first. JavaScript runs on the same thread as drawing, so long work freezes the screen unless you yield first. Generated puzzles are also cached in memory (`puzzleCache`).

### Step 5. App icons

Android and Chrome need PNG icons at 192px and 512px, including a "maskable" one with padding for round masks. iOS needs a 180px icon. `tools/make_icons.py` draws them with Pillow.

```bash
py tools/make_icons.py
```

Output: `wrote ...\app\icons\icon-192.png` (and the 512, maskable-512 and apple-touch-icon files).

The script draws at 4× size and shrinks the result, which gives smooth (anti-aliased) edges.

### Step 6. The app files

| File | Role |
|---|---|
| `app/index.html` | Page structure: 3 screens (home, levels, game) and 3 dialogs (win, how-to, settings) |
| `app/css/style.css` | Visuals. Mobile-first, dark mode, region colours `--r0`…`--r9` |
| `app/js/engine.js` | Puzzle logic (above). Contains no screen code, so it can be tested on its own |
| `app/js/storage.js` | Saves progress in `localStorage` on the device |
| `app/js/app.js` | Screens, navigation, touch input, timer, undo, hints, winning |
| `app/manifest.webmanifest` | Tells phones "this is an installable app": name, icons, colours |
| `app/sw.js` | Service worker: caches all files so the app works offline |
| `app/privacy.html` | Privacy policy (required by app stores) |

Key implementation details:
- **Navigation through the URL hash:** `#/`, `#/levels`, `#/play/37`. The phone's Back button works with no extra code, and you can link straight to a level.
- **Touch input with Pointer Events,** which handle mouse, finger and pen with one piece of code. `pointerdown` remembers the cell. If the pointer moves to another cell, it's a drag, which paints ×. If not, it's a tap, which cycles empty → × → crown → empty. `touch-action: none` on the board stops the page from scrolling while you drag.
- **Undo** stores a list of `[cell, oldValue]` per action, so a whole drag is undone in one step.
- **Auto-× (optional)** is not stored. It is recalculated from the crowns every time, so removing a crown automatically removes its ×s.
- **The timer pauses** when the app goes to the background (`visibilitychange` event) or when you leave the game screen.

### Step 7. Visual check at phone size

First attempt: a headless screenshot with `--window-size=412,860`.

**Problem: the screenshot was cut off on the right, and the dialog was off-centre.** Desktop browser windows have a minimum width (around 500px), so the page was laid out wider than the 412px image.

**Fix:** created `tests/phone-preview.html`, which shows the app inside **390×844 iframes**, the size of an iPhone 14. An iframe gets exactly the width you give it. Screenshot command:

```bash
msedge --headless=new --disable-gpu --hide-scrollbars --user-data-dir="<scratch>/edge-prev" \
  --window-size=1700,900 --virtual-time-budget=8000 --screenshot="<scratch>/preview.png" \
  "file:///D:/Projects/Queens/tests/phone-preview.html"
```

Notes:
- `--user-data-dir` points at a throw-away folder, so each run starts with a clean browser profile and no saved progress.
- The screenshots came out in **dark mode** because Windows is set to dark. To force light mode, add `--blink-settings=preferredColorScheme=1`.

You can open `tests/phone-preview.html` yourself any time to see four live phone frames.

### Step 8. Automated gameplay test

`tests/ui.test.html` loads the real app in an iframe and plays it with simulated pointer events:
- tap cycle and auto-×;
- red conflict for touching crowns;
- undo and clear;
- drag-marking, with the whole drag undone in one step;
- progress surviving a reload;
- solving a level, the win dialog, and the saved best time;
- the Next level button;
- hints;
- the level picker showing solved levels;
- the service worker registering and the offline cache being created.

**Problem: the test page could not reach inside the iframe when opened as a file.** Chrome and Edge treat every `file://` page as a separate "origin", for security, so one page can't script another. **Fix:** serve the folder over HTTP from a local web server built into Python:

```bash
cd D:/Projects/Queens
py -m http.server 8765 --bind 127.0.0.1
```

`--bind 127.0.0.1` means only this computer can connect. No firewall prompt, and nothing is exposed to the network. Then open `http://127.0.0.1:8765/tests/ui.test.html`. Stop the server with Ctrl+C.

**Problem (prevented): `setPointerCapture` throws an error for synthetic or unusual pointers.** It is now wrapped in `try/catch` in `app.js`, so a test, or an odd stylus, can't break input.

Result: **21/21 checks passed.**

A light-mode screenshot of a game in progress confirmed:
- red crowns where queens clash;
- red hatching over the clashing row, column or region;
- your own × marks darker than auto-× marks.

### Step 9. Launch scaffolding

- `.github/workflows/pages.yml`: when you push to GitHub, it automatically publishes `app/` to free HTTPS hosting (GitHub Pages).
- `app/privacy.html`: app stores require a privacy policy URL. Add your contact email before publishing.

---

## Troubleshooting reference (problems you are likely to meet)

| Symptom | Cause | Fix |
|---|---|---|
| `python3` opens the Microsoft Store | Windows app-execution alias | Use `py` |
| Changes don't appear after deploying | The service worker serves the old cached files | Bump `CACHE_VERSION` in `app/sw.js` (e.g. `crowns-v2`), deploy, then reopen the app twice. In desktop Chrome: DevTools → Application → Service Workers → "Update on reload" |
| No offline support when opened by double-click | Service workers only run on `https://` or `http://localhost`/`127.0.0.1` | Use the local server, or the GitHub Pages URL |
| Phone on Wi-Fi can open `http://<pc-ip>:8000` but offline doesn't work | Plain `http` on a LAN IP isn't a "secure context" | Test offline support through GitHub Pages (HTTPS), or with USB port-forwarding (see GUIDE.md) |
| Windows Firewall pops up when starting the server | Server bound to all network interfaces | Use `--bind 127.0.0.1`. Allowing LAN access is a system change: ask IT first |
| "Port already in use" | An old server is still running | Use a different port (`8766`), or close the old terminal |
| Progress disappeared | Browser data was cleared, or iOS evicted storage of a non-installed site after a period of no use | Install to the home screen. A future export/import feature is listed in GUIDE.md |
| Headless screenshot cropped | Desktop window minimum width | Use `tests/phone-preview.html` |
| Levels changed after editing engine.js | Puzzles are generated from code, so different code gives different puzzles | Don't change generation code after launch, or bump `GENERATOR_VERSION` on purpose (see GUIDE.md) |

---

## How to add to this journal

For every future change, add a dated section with:
1. the goal;
2. the files changed;
3. the commands run and their key output;
4. problems hit and their fixes;
5. test results.
