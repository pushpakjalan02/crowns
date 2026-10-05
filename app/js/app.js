/*
 * app.js — everything the player sees and touches.
 *
 * Navigation uses the URL "hash" (the part after #), so the phone's Back button
 * works and any level can be linked directly:
 *   #/            home
 *   #/levels      level picker
 *   #/play/37     play level 37
 */
(function () {
  'use strict';

  var E = window.QueensEngine;
  var Store = window.QueensStorage;

  var EMPTY = 0, MARK = 1, QUEEN = 2;
  var TIER_NAMES = ['', 'Easy', 'Medium', 'Hard'];
  var PAGE_SIZE = 40;

  var QUEEN_SVG = '<svg class="ic q" viewBox="0 0 24 24"><use href="#crown"/></svg>';
  var MARK_SVG = '<svg class="ic x" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  var AUTO_SVG = '<svg class="ic x auto" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';

  var data = Store.load();
  var game = null;      // the level currently on the board (see startLevel)
  var timerId = null;
  var levelPage = 0;
  var drag = null;      // finger/mouse drag in progress
  var puzzleCache = {}; // level -> puzzle, so revisiting is instant

  function $(id) { return document.getElementById(id); }
  var board = $('board');

  // ------------------------------------------------------------ helpers

  function pad(x) { return x < 10 ? '0' + x : '' + x; }
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s %= 60; m %= 60;
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  function persist() { Store.save(data); }
  function getPuzzle(level) {
    if (!puzzleCache[level]) puzzleCache[level] = E.generateLevel(level);
    return puzzleCache[level];
  }
  function nextUnsolved(from) {
    var l = Math.max(1, from);
    while (data.solved[l] && l < E.MAX_LEVEL) l++;
    return l;
  }
  function setMessage(text) { $('message').textContent = text || ''; }

  // ------------------------------------------------------------ navigation

  function showScreen(name) {
    if (name !== 'game') leaveGame();
    ['home', 'levels', 'game'].forEach(function (s) {
      $('screen-' + s).classList.toggle('active', s === name);
    });
    window.scrollTo(0, 0);
  }

  function route() {
    var m = /^#\/play\/(\d+)$/.exec(location.hash);
    if (m) {
      var level = Math.min(E.MAX_LEVEL, Math.max(1, parseInt(m[1], 10)));
      showScreen('game');
      startLevel(level);
    } else if (location.hash === '#/levels') {
      levelPage = Math.floor((data.lastLevel - 1) / PAGE_SIZE);
      renderLevels();
      showScreen('levels');
    } else {
      renderHome();
      showScreen('home');
    }
  }

  // ------------------------------------------------------------ home

  function renderHome() {
    var next = nextUnsolved(data.lastLevel);
    var btn = $('btn-continue');
    btn.textContent = (data.progress[next] ? 'Continue level ' : 'Play level ') + next;
    btn.onclick = function () { location.hash = '#/play/' + next; };
    var count = Object.keys(data.solved).length;
    $('home-stats').textContent = count
      ? count + ' level' + (count === 1 ? '' : 's') + ' solved'
      : E.MAX_LEVEL + ' levels · works offline';
  }

  // ------------------------------------------------------------ level select

  function renderLevels() {
    var start = levelPage * PAGE_SIZE + 1;
    var end = Math.min(E.MAX_LEVEL, start + PAGE_SIZE - 1);
    var grid = $('level-grid');
    grid.innerHTML = '';
    for (var l = start; l <= end; l++) {
      var a = document.createElement('a');
      var solved = data.solved[l];
      var n = E.levelInfo(l).size;
      a.href = '#/play/' + l;
      a.className = 'level-tile' + (solved ? ' solved' : '') + (data.progress[l] ? ' started' : '');
      a.innerHTML = '<span class="num">' + l + '</span><span class="meta">' +
        (solved ? '&#10003; ' + fmtTime(solved.best) : n + '&times;' + n) + '</span>';
      grid.appendChild(a);
    }
    $('pg-label').textContent = start + '–' + end;
    $('pg-prev').disabled = levelPage === 0;
    $('pg-next').disabled = end >= E.MAX_LEVEL;
  }

  $('pg-prev').onclick = function () { levelPage--; renderLevels(); };
  $('pg-next').onclick = function () { levelPage++; renderLevels(); };

  // ------------------------------------------------------------ game: lifecycle

  function startLevel(level) {
    if (game && game.level === level && !game.won) { resumeTimer(); return; }
    leaveGame();

    $('game-title').textContent = 'Level ' + level;
    if (!puzzleCache[level] && E.levelInfo(level).size >= 9) {
      // Big boards take a moment to generate: show a message, then let the browser paint it.
      board.innerHTML = '';
      setMessage('Preparing puzzle…');
      setTimeout(function () { if (location.hash === '#/play/' + level) loadLevel(level); }, 30);
    } else {
      loadLevel(level);
    }
  }

  function loadLevel(level) {
    var puzzle = getPuzzle(level);
    var n = puzzle.size;
    var cells = new Uint8Array(n * n);
    var saved = data.progress[level];
    if (saved && saved.cells && saved.cells.length === n * n) {
      for (var i = 0; i < n * n; i++) cells[i] = +saved.cells[i];
    }
    game = {
      level: level,
      puzzle: puzzle,
      n: n,
      cells: cells,
      history: [],                       // each entry: list of [cellIndex, previousValue]
      elapsed: saved ? saved.elapsed || 0 : 0,
      startedAt: null,
      hints: saved ? saved.hints || 0 : 0,
      won: false
    };
    data.lastLevel = level;
    persist();

    $('game-sub').textContent = n + '×' + n + ' · ' + TIER_NAMES[puzzle.tier] +
      (data.solved[level] ? ' · best ' + fmtTime(data.solved[level].best) : '');
    setMessage('');
    buildBoard();
    updateBoard();
    resumeTimer();
  }

  function leaveGame() {
    if (!game) return;
    pauseTimer();
    saveProgress();
  }

  function saveProgress() {
    if (!game || game.won) return;
    var used = false;
    for (var i = 0; i < game.cells.length; i++) if (game.cells[i]) { used = true; break; }
    if (used) {
      data.progress[game.level] = {
        cells: Array.prototype.join.call(game.cells, ''),
        elapsed: elapsedNow(),
        hints: game.hints
      };
    } else {
      delete data.progress[game.level];
    }
    persist();
  }

  // ------------------------------------------------------------ game: timer

  function elapsedNow() {
    return game.elapsed + (game.startedAt !== null ? Date.now() - game.startedAt : 0);
  }
  function renderTimer() {
    $('timer').textContent = game && data.settings.showTimer ? fmtTime(elapsedNow()) : '';
  }
  function resumeTimer() {
    if (!game || game.won || game.startedAt !== null) return;
    game.startedAt = Date.now();
    clearInterval(timerId);
    timerId = setInterval(renderTimer, 500);
    renderTimer();
  }
  function pauseTimer() {
    clearInterval(timerId);
    if (!game || game.startedAt === null) return;
    game.elapsed += Date.now() - game.startedAt;
    game.startedAt = null;
  }

  // Pause when the app goes to the background (phone locked, app switched).
  document.addEventListener('visibilitychange', function () {
    if (!$('screen-game').classList.contains('active')) return;
    if (document.hidden) { pauseTimer(); saveProgress(); } else { resumeTimer(); }
  });

  // ------------------------------------------------------------ game: drawing the board

  function buildBoard() {
    var n = game.n, R = game.puzzle.regions;
    board.style.setProperty('--n', n);
    board.classList.remove('won');
    board.innerHTML = '';
    for (var i = 0; i < n * n; i++) {
      var r = (i / n) | 0, c = i % n;
      var el = document.createElement('div');
      el.className = 'cell';
      el.dataset.i = i;
      el.style.background = 'var(--r' + R[i] + ')';
      if (c === n - 1) el.classList.add('lc');
      else if (R[i + 1] !== R[i]) el.classList.add('br');
      if (r === n - 1) el.classList.add('lr');
      else if (R[i + n] !== R[i]) el.classList.add('bb');
      el.setAttribute('role', 'gridcell');
      el.setAttribute('aria-label', 'Row ' + (r + 1) + ' column ' + (c + 1));
      board.appendChild(el);
    }
  }

  function updateBoard() {
    var n = game.n;
    var a = E.analyze(n, game.puzzle.regions, game.cells);
    var showBad = data.settings.showConflicts;
    for (var i = 0; i < n * n; i++) {
      var el = board.children[i], v = game.cells[i];
      var html = v === QUEEN ? QUEEN_SVG
        : v === MARK ? MARK_SVG
        : data.settings.autoX && a.attacked[i] ? AUTO_SVG : '';
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.classList.toggle('conflict', showBad && a.conflictQueen[i] === 1);
      el.classList.toggle('bad', showBad && a.badCell[i] === 1);
    }
    if (a.solved) win();
  }

  // ------------------------------------------------------------ game: input

  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== board) {
      if (el.dataset && el.dataset.i !== undefined) return +el.dataset.i;
      el = el.parentElement;
    }
    return -1;
  }

  board.addEventListener('pointerdown', function (e) {
    if (!game || game.won || e.button > 0) return;
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/odd pointers */ }
    drag = { start: i, last: i, moved: false, mode: null, changes: [] };
  });

  board.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === drag.last) return;
    if (!drag.moved) {
      // First move decides the drag's meaning: starting on an × erases ×s, otherwise marks.
      drag.moved = true;
      drag.mode = game.cells[drag.start] === MARK ? 'erase' : 'mark';
      paint(drag.start);
    }
    paint(i);
    drag.last = i;
    updateBoard();
  });

  function endDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.moved) tap(d.start);
    else if (d.changes.length) { game.history.push(d.changes); afterChange(); }
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);

  function paint(i) {
    var v = game.cells[i];
    var nv = drag.mode === 'mark' ? (v === EMPTY ? MARK : v) : (v === MARK ? EMPTY : v);
    if (nv !== v) { drag.changes.push([i, v]); game.cells[i] = nv; }
  }

  function tap(i) {
    var v = game.cells[i];
    game.history.push([[i, v]]);
    game.cells[i] = (v + 1) % 3; // empty -> × -> crown -> empty
    afterChange();
  }

  function afterChange() {
    setMessage('');
    updateBoard();
    saveProgress();
  }

  // ------------------------------------------------------------ game: buttons

  $('btn-undo').onclick = function () {
    if (!game || game.won) return;
    var changes = game.history.pop();
    if (!changes) return;
    for (var k = changes.length - 1; k >= 0; k--) game.cells[changes[k][0]] = changes[k][1];
    afterChange();
  };

  $('btn-clear').onclick = function () {
    if (!game || game.won) return;
    var changes = [];
    for (var i = 0; i < game.cells.length; i++) {
      if (game.cells[i]) { changes.push([i, game.cells[i]]); game.cells[i] = EMPTY; }
    }
    if (changes.length) { game.history.push(changes); afterChange(); }
  };

  $('btn-hint').onclick = function () {
    if (!game || game.won) return;
    var n = game.n, sol = game.puzzle.solution, cells = game.cells, i, r;
    game.hints++;
    for (i = 0; i < n * n; i++) {
      if (cells[i] === QUEEN && sol[(i / n) | 0] !== i % n) {
        return flash(i, 'This crown is in the wrong place.');
      }
    }
    for (r = 0; r < n; r++) {
      i = r * n + sol[r];
      if (cells[i] === MARK) return flash(i, 'This × is hiding a crown.');
    }
    for (r = 0; r < n; r++) {
      i = r * n + sol[r];
      if (cells[i] !== QUEEN) {
        game.history.push([[i, cells[i]]]);
        cells[i] = QUEEN;
        afterChange();
        if (!game.won) flash(i, 'Here is one crown.');
        return;
      }
    }
  };

  function flash(i, text) {
    var el = board.children[i];
    el.classList.remove('flash');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('flash');
    setMessage(text);
    saveProgress();
  }

  // ------------------------------------------------------------ game: winning

  function win() {
    if (game.won) return;
    pauseTimer();
    game.won = true;
    var t = game.elapsed;
    var prev = data.solved[game.level];
    data.solved[game.level] = {
      best: prev ? Math.min(prev.best, t) : t,
      hints: prev ? Math.min(prev.hints, game.hints) : game.hints,
      at: Date.now()
    };
    delete data.progress[game.level];
    persist();
    renderTimer();
    board.classList.add('won');

    $('win-time').textContent = fmtTime(t);
    $('win-extra').textContent =
      (prev && prev.best < t ? 'Best: ' + fmtTime(prev.best) : prev ? 'New best time!' : 'Level ' + game.level + ' complete') +
      (game.hints ? ' · ' + game.hints + ' hint' + (game.hints > 1 ? 's' : '') : '');
    $('win-next').style.display = game.level < E.MAX_LEVEL ? '' : 'none';
    setTimeout(function () { if (game && game.won) $('dlg-win').showModal(); }, 700);
  }

  $('win-next').onclick = function () {
    $('dlg-win').close();
    location.hash = '#/play/' + (game.level + 1);
  };
  $('win-levels').onclick = function () {
    $('dlg-win').close();
    location.hash = '#/levels';
  };

  // ------------------------------------------------------------ dialogs & settings

  $('btn-howto').onclick = function () { $('dlg-howto').showModal(); };
  $('btn-settings').onclick = function () {
    ['autoX', 'showConflicts', 'showTimer'].forEach(function (k) { $('set-' + k).checked = !!data.settings[k]; });
    $('about').textContent = 'Version 1.0 · puzzle set v' + E.GENERATOR_VERSION + ' · all data stays on this device.';
    $('dlg-settings').showModal();
  };
  ['autoX', 'showConflicts', 'showTimer'].forEach(function (k) {
    $('set-' + k).onchange = function (e) {
      data.settings[k] = e.target.checked;
      persist();
      if (game) { updateBoard(); renderTimer(); }
    };
  });
  $('btn-reset').onclick = function () {
    if (!confirm('Erase all solved levels, times and settings?')) return;
    data = Store.reset();
    game = null;
    $('dlg-settings').close();
    route();
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.onclick = function () { b.closest('dialog').close(); };
  });

  // ------------------------------------------------------------ start up

  window.addEventListener('hashchange', route);
  route();
  try {
    if (!localStorage.getItem('crowns.seenHowTo')) {
      localStorage.setItem('crowns.seenHowTo', '1');
      $('dlg-howto').showModal();
    }
  } catch (e) { /* storage blocked: skip the first-run tutorial */ }

  // Offline support. Service workers only run on http(s), not on file:// pages.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker failed to register', err);
      });
    });
  }
})();
