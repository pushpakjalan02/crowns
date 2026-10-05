/*
 * storage.js — saves progress on the device using localStorage
 * (a small key/value store each browser keeps per website). No server involved.
 *
 * Saved shape:
 * {
 *   version: 1,
 *   lastLevel: 7,
 *   solved:   { "3": { best: 41234, hints: 0, at: 1727850000000 } },   // times in ms
 *   progress: { "7": { cells: "0012000...", elapsed: 15000, hints: 1 } }, // unfinished boards
 *   settings: { autoX: true, showConflicts: true, showTimer: true }
 * }
 */
(function (root) {
  'use strict';

  var KEY = 'crowns.save.v1';

  function defaults() {
    return {
      version: 1,
      lastLevel: 1,
      solved: {},
      progress: {},
      settings: { autoX: true, showConflicts: true, showTimer: true }
    };
  }

  function load() {
    var def = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return def;
      var saved = JSON.parse(raw);
      return {
        version: 1,
        lastLevel: saved.lastLevel || 1,
        solved: saved.solved || {},
        progress: saved.progress || {},
        settings: Object.assign(def.settings, saved.settings || {})
      };
    } catch (e) {
      return def; // storage blocked or corrupted: play without saving
    }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return defaults();
  }

  root.QueensStorage = { load: load, save: save, reset: reset };
})(this);
