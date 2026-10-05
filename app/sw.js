/*
 * sw.js — Service Worker. This is what makes the app work with no internet.
 *
 * The browser runs this file in the background, separate from the page.
 *  - install:  download every file of the app into a cache on the device.
 *  - activate: delete caches from older versions.
 *  - fetch:    whenever the page asks for a file, answer from the cache first.
 *
 * IMPORTANT: every time you change ANY app file, bump CACHE_VERSION, otherwise
 * players keep the old cached copy. (See docs/GUIDE.md -> "Releasing an update".)
 */
var CACHE_VERSION = 'crowns-v1';

var ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './css/style.css',
  './js/engine.js',
  './js/storage.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(event.request).catch(function () {
        // Offline and not cached: for page loads, fall back to the app shell.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
