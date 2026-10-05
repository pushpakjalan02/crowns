/*
 * engine.js — the "brain" of the game. Pure logic, no screen/DOM code.
 *
 * Responsibilities:
 *   1. Seeded random numbers   -> the same level number always gives the same puzzle.
 *   2. Puzzle generation       -> random queen layout, grow coloured regions around it.
 *   3. Uniqueness check        -> a backtracking solver proves there is exactly 1 solution.
 *   4. Difficulty rating       -> a "human-style" logic solver decides Easy/Medium/Hard,
 *                                 and rejects puzzles that need guessing.
 *   5. Board analysis          -> conflicts, auto-X cells and win detection for the UI.
 *
 * Board representation: an N×N board is a flat array of length N*N.
 *   cell index i  <->  row = floor(i / N), col = i % N
 *   regions[i]    =   colour/region id (0..N-1) of cell i
 *   solution[r]   =   column of the queen in row r
 *
 * Written as a classic script (not an ES module) so index.html works even when
 * opened by double-clicking (file://). It exposes window.QueensEngine, and also
 * module.exports so it could be reused by Node tools later.
 */
(function (root) {
  'use strict';

  // Bump ONLY if you accept that every level's puzzle will change for everyone.
  var GENERATOR_VERSION = 1;
  var MAX_LEVEL = 1000;

  // Level ranges -> board size and allowed difficulty tiers (1 Easy, 2 Medium, 3 Hard).
  var BANDS = [
    { upTo: 10, size: 5, minTier: 1, maxTier: 1 },
    { upTo: 30, size: 6, minTier: 1, maxTier: 2 },
    { upTo: 60, size: 7, minTier: 1, maxTier: 2 },
    { upTo: 100, size: 8, minTier: 2, maxTier: 3 },
    { upTo: 150, size: 9, minTier: 2, maxTier: 3 },
    { upTo: Infinity, size: 10, minTier: 2, maxTier: 3 }
  ];

  // ---------------------------------------------------------------- random

  // mulberry32: tiny, fast, deterministic pseudo-random generator.
  // Same seed => same sequence of numbers on every device.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, n) { return Math.floor(rng() * n); }

  function shuffle(rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function range(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    return a;
  }

  function popcount(x) {
    var c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  // ---------------------------------------------------------------- levels

  function levelInfo(level) {
    for (var b = 0; b < BANDS.length; b++) {
      if (level <= BANDS[b].upTo) {
        return { level: level, size: BANDS[b].size, minTier: BANDS[b].minTier, maxTier: BANDS[b].maxTier };
      }
    }
  }

  function seedFor(level) {
    return (Math.imul(level, 2654435761) ^ Math.imul(GENERATOR_VERSION, 40503) ^ 0x5bd1e995) >>> 0;
  }

  // ---------------------------------------------------------------- geometry

  // Orthogonal neighbours (used for growing regions, which must stay connected).
  function neighbors4(n, i) {
    var r = (i / n) | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  // All 8 surrounding cells (queens may not touch, even diagonally).
  function neighbors8(n, i) {
    var r = (i / n) | 0, c = i % n, out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- generation

  // Step 1: a random valid queen layout. One queen per row and column, and queens
  // in consecutive rows must be at least 2 columns apart (so they don't touch).
  function randomSolution(n, rng) {
    var cols = new Array(n), used = new Array(n).fill(false);
    function place(r) {
      if (r === n) return true;
      var order = shuffle(rng, range(n));
      for (var k = 0; k < n; k++) {
        var c = order[k];
        if (used[c]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) < 2) continue;
        used[c] = true; cols[r] = c;
        if (place(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    place(0);
    return cols;
  }

  // Step 2: every queen seeds one region; regions then grab neighbouring empty
  // cells at random until the board is full. Regions are always connected.
  function growRegions(n, solution, rng) {
    var size = n * n;
    var regions = new Array(size).fill(-1);
    for (var r = 0; r < n; r++) regions[r * n + solution[r]] = r;
    var remaining = size - n;

    while (remaining > 0) {
      var frontier = []; // [cell, regionThatCanTakeIt]
      for (var i = 0; i < size; i++) {
        if (regions[i] !== -1) continue;
        var nb = neighbors4(n, i);
        for (var k = 0; k < nb.length; k++) {
          if (regions[nb[k]] !== -1) frontier.push([i, regions[nb[k]]]);
        }
      }
      var pick;
      if (rng() < 0.5) {
        // Any frontier pair: big regions tend to keep growing (varied sizes).
        pick = frontier[randInt(rng, frontier.length)];
      } else {
        // Choose a region first: gives small regions a chance to grow too.
        var regs = [];
        for (var f = 0; f < frontier.length; f++) {
          if (regs.indexOf(frontier[f][1]) < 0) regs.push(frontier[f][1]);
        }
        var g = regs[randInt(rng, regs.length)];
        var opts = frontier.filter(function (p) { return p[1] === g; });
        pick = opts[randInt(rng, opts.length)];
      }
      regions[pick[0]] = pick[1];
      remaining--;
    }
    return regions;
  }

  // Exact solver: returns up to `limit` solutions (each = array row -> column).
  // Bitmasks track which columns/regions already hold a queen.
  function solveAll(n, regions, limit) {
    var sols = [], cols = new Array(n), colUsed = 0, regUsed = 0;
    function rec(r, prev) {
      if (r === n) { sols.push(cols.slice()); return sols.length >= limit; }
      for (var c = 0; c < n; c++) {
        if ((colUsed >> c) & 1) continue;
        if (Math.abs(c - prev) < 2) continue;
        var g = regions[r * n + c];
        if ((regUsed >> g) & 1) continue;
        colUsed |= 1 << c; regUsed |= 1 << g; cols[r] = c;
        if (rec(r + 1, c)) return true;
        colUsed &= ~(1 << c); regUsed &= ~(1 << g);
      }
      return false;
    }
    rec(0, -10);
    return sols;
  }

  function countSolutions(n, regions, limit) {
    return solveAll(n, regions, limit || 2).length;
  }

  // Would region g still be one connected piece if `removed` were taken away?
  function connectedWithout(n, regions, g, removed) {
    var size = n * n, start = -1, total = 0;
    for (var i = 0; i < size; i++) {
      if (regions[i] === g && i !== removed) { total++; if (start < 0) start = i; }
    }
    if (!total) return false;
    var seen = new Uint8Array(size), stack = [start], count = 0;
    seen[start] = 1;
    while (stack.length) {
      var cur = stack.pop(); count++;
      var nb = neighbors4(n, cur);
      for (var k = 0; k < nb.length; k++) {
        var x = nb[k];
        if (!seen[x] && x !== removed && regions[x] === g) { seen[x] = 1; stack.push(x); }
      }
    }
    return count === total;
  }

  // Step 3: random regions usually allow several solutions. Repair loop:
  // find an alternative solution, and hand one of its queen cells to a
  // neighbouring region. Our intended solution stays valid (we never move its
  // queen cells) while the alternative usually breaks. Repeat until unique.
  function makeUnique(n, regions, solution, rng) {
    for (var iter = 0; iter < n * 20; iter++) {
      var sols = solveAll(n, regions, 2);
      if (sols.length === 1) return true;
      var alt = sols[0].join() === solution.join() ? sols[1] : sols[0];

      var cells = [];
      for (var r = 0; r < n; r++) if (alt[r] !== solution[r]) cells.push(r * n + alt[r]);
      shuffle(rng, cells);

      var moved = false;
      for (var k = 0; k < cells.length && !moved; k++) {
        var cell = cells[k], g = regions[cell], opts = [];
        var nb = neighbors4(n, cell);
        for (var j = 0; j < nb.length; j++) {
          var h = regions[nb[j]];
          if (h !== g && opts.indexOf(h) < 0) opts.push(h);
        }
        if (!opts.length || !connectedWithout(n, regions, g, cell)) continue;
        regions[cell] = opts[randInt(rng, opts.length)];
        moved = true;
      }
      if (!moved) return false;
    }
    return false;
  }

  // ---------------------------------------------------------------- logic solver (difficulty)
  //
  // Solves the way a person would, using only deductions - never guessing.
  //   Tier 1 (Easy):   a row/column/region has one possible cell left; or a
  //                    region's options all sit in one row/column (or vice versa).
  //   Tier 2 (Medium): K regions squeezed into exactly K rows/columns (and vice versa).
  //   Tier 3 (Hard):   "if I put a crown here, some region would have no room left".
  // If it gets stuck, the puzzle would need guessing, and we throw it away.

  function logicSolve(n, regions) {
    var size = n * n;
    var OPEN = 0, X = 1, Q = 2;
    var st = new Uint8Array(size);

    // unit types: 0 = row, 1 = column, 2 = region. key(t, i) = which unit of type t holds cell i.
    var cells = [[], [], []];
    for (var t = 0; t < 3; t++) for (var u = 0; u < n; u++) cells[t].push([]);
    for (var i = 0; i < size; i++) {
      cells[0][(i / n) | 0].push(i);
      cells[1][i % n].push(i);
      cells[2][regions[i]].push(i);
    }
    function key(t, i) { return t === 0 ? (i / n) | 0 : t === 1 ? i % n : regions[i]; }

    function hasQueen(t, u) {
      var list = cells[t][u];
      for (var k = 0; k < list.length; k++) if (st[list[k]] === Q) return true;
      return false;
    }
    function openCount(t, u) {
      var list = cells[t][u], c = 0;
      for (var k = 0; k < list.length; k++) if (st[list[k]] === OPEN) c++;
      return c;
    }
    function place(i) {
      st[i] = Q;
      for (var t = 0; t < 3; t++) {
        var list = cells[t][key(t, i)];
        for (var k = 0; k < list.length; k++) if (st[list[k]] === OPEN) st[list[k]] = X;
      }
      var nb = neighbors8(n, i);
      for (var j = 0; j < nb.length; j++) if (st[nb[j]] === OPEN) st[nb[j]] = X;
    }
    function contradiction() {
      for (var t = 0; t < 3; t++) {
        for (var u = 0; u < n; u++) if (!hasQueen(t, u) && !openCount(t, u)) return true;
      }
      return false;
    }

    // Returns 1 if progress, 0 if none, -1 if a contradiction was found.
    function singles() {
      for (var t = 0; t < 3; t++) {
        for (var u = 0; u < n; u++) {
          if (hasQueen(t, u)) continue;
          var list = cells[t][u], only = -1, c = 0;
          for (var k = 0; k < list.length; k++) if (st[list[k]] === OPEN) { c++; only = list[k]; }
          if (c === 0) return -1;
          if (c === 1) { place(only); return 1; }
        }
      }
      return 0;
    }

    // K units of type a whose open cells all lie inside exactly K units of type b:
    // those b-units are "reserved", so clear every other cell in them.
    function sets(kMin, kMax) {
      for (var a = 0; a < 3; a++) {
        for (var b = 0; b < 3; b++) {
          if (a === b) continue;
          var open = [], masks = [];
          for (var u = 0; u < n; u++) {
            if (hasQueen(a, u)) continue;
            var m = 0, list = cells[a][u];
            for (var k = 0; k < list.length; k++) if (st[list[k]] === OPEN) m |= 1 << key(b, list[k]);
            open.push(u); masks.push(m);
          }
          var M = open.length;
          for (var sub = 1; sub < (1 << M); sub++) {
            var size_ = popcount(sub);
            if (size_ < kMin || size_ > kMax || size_ >= M) continue;
            var union = 0, inS = 0;
            for (var j = 0; j < M; j++) {
              if ((sub >> j) & 1) { union |= masks[j]; inS |= 1 << open[j]; }
            }
            if (popcount(union) !== size_) continue;
            var changed = false;
            for (var v = 0; v < n; v++) {
              if (!((union >> v) & 1)) continue;
              var bl = cells[b][v];
              for (var q = 0; q < bl.length; q++) {
                var cell = bl[q];
                if (st[cell] === OPEN && !((inS >> key(a, cell)) & 1)) { st[cell] = X; changed = true; }
              }
            }
            if (changed) return true;
          }
        }
      }
      return false;
    }

    function lookahead() {
      for (var i = 0; i < size; i++) {
        if (st[i] !== OPEN) continue;
        var saved = st.slice();
        place(i);
        var bad = contradiction();
        st.set(saved);
        if (bad) { st[i] = X; return true; }
      }
      return false;
    }

    var tier = 1;
    for (;;) {
      var s = singles();
      if (s < 0) return { solved: false, tier: tier };
      if (s > 0) continue;
      if (sets(1, 1)) continue;
      if (sets(2, n)) { tier = Math.max(tier, 2); continue; }
      if (lookahead()) { tier = 3; continue; }
      break;
    }
    var queens = 0;
    for (var z = 0; z < size; z++) if (st[z] === Q) queens++;
    return { solved: queens === n, tier: tier };
  }

  // ---------------------------------------------------------------- public: build a level

  function generateLevel(level) {
    var info = levelInfo(level);
    var n = info.size;
    var rng = mulberry32(seedFor(level));
    var fallback = null;

    for (var attempt = 1; attempt <= 500 || !fallback; attempt++) {
      var solution = randomSolution(n, rng);
      var regions = growRegions(n, solution, rng);
      if (!makeUnique(n, regions, solution, rng)) continue;
      var rating = logicSolve(n, regions);
      if (!rating.solved) continue;

      // Shuffle colour ids so a colour never hints at which row holds its queen.
      var perm = shuffle(rng, range(n));
      var puzzle = {
        level: level,
        size: n,
        regions: regions.map(function (g) { return perm[g]; }),
        solution: solution,
        tier: rating.tier,
        attempts: attempt
      };
      if (rating.tier >= info.minTier && rating.tier <= info.maxTier) return puzzle;
      if (!fallback) fallback = puzzle;
    }
    return fallback;
  }

  // ---------------------------------------------------------------- public: board analysis for the UI
  // cells[i]: 0 empty, 1 X mark, 2 queen

  function analyze(n, regions, cells) {
    var size = n * n;
    var conflictQueen = new Uint8Array(size);
    var badCell = new Uint8Array(size);
    var attacked = new Uint8Array(size);
    var queens = [];
    var byRow = [], byCol = [], byReg = [];
    for (var u = 0; u < n; u++) { byRow.push([]); byCol.push([]); byReg.push([]); }

    for (var i = 0; i < size; i++) {
      if (cells[i] !== 2) continue;
      queens.push(i);
      byRow[(i / n) | 0].push(i); byCol[i % n].push(i); byReg[regions[i]].push(i);
    }

    function inUnit(type, u, j) {
      return type === 0 ? ((j / n) | 0) === u : type === 1 ? j % n === u : regions[j] === u;
    }
    var groups = [byRow, byCol, byReg];
    for (var t = 0; t < 3; t++) {
      for (var v = 0; v < n; v++) {
        if (groups[t][v].length < 2) continue;
        groups[t][v].forEach(function (q) { conflictQueen[q] = 1; });
        for (var j = 0; j < size; j++) if (inUnit(t, v, j)) badCell[j] = 1;
      }
    }

    queens.forEach(function (q) {
      var r = (q / n) | 0, c = q % n, g = regions[q];
      neighbors8(n, q).forEach(function (k) {
        if (cells[k] === 2) { conflictQueen[q] = 1; conflictQueen[k] = 1; }
        attacked[k] = 1;
      });
      for (var j = 0; j < size; j++) {
        if (((j / n) | 0) === r || j % n === c || regions[j] === g) attacked[j] = 1;
      }
    });
    queens.forEach(function (q) { attacked[q] = 0; });

    var anyConflict = false;
    for (var z = 0; z < size; z++) if (conflictQueen[z]) { anyConflict = true; break; }

    return {
      queenCount: queens.length,
      conflictQueen: conflictQueen,
      badCell: badCell,
      attacked: attacked,
      solved: queens.length === n && !anyConflict
    };
  }

  var api = {
    GENERATOR_VERSION: GENERATOR_VERSION,
    MAX_LEVEL: MAX_LEVEL,
    levelInfo: levelInfo,
    generateLevel: generateLevel,
    analyze: analyze,
    // exported for tests / learning
    mulberry32: mulberry32,
    randomSolution: randomSolution,
    growRegions: growRegions,
    solveAll: solveAll,
    countSolutions: countSolutions,
    logicSolve: logicSolve
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QueensEngine = api;
})(this);
