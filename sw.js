// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com>
 * Gorit - Offline PWA Service Worker
 */

const CACHE_NAME = 'gorit-v1.0.0';

const BASE_PATH = self.registration && self.registration.scope 
  ? new URL(self.registration.scope).pathname.replace(/\/$/, '') 
  : '';

const RAW_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/js/i18n.js',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/icon-maskable.svg',
  '/logo.svg',
  '/logo.png'
];

const ASSETS_TO_CACHE = RAW_ASSETS.map(p => p === '/' ? (BASE_PATH || '/') : `${BASE_PATH}${p}`);

const ALLOWED_CDN_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            await cache.add(url);
          } catch (e) {
            console.warn(`[SW] Warning while caching ${url}:`, e);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Never cache dynamic backend API calls or files explorer
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/files')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Cache-First for whitelisted CDNs (Google Fonts, Material Symbols, Canvas Confetti)
  if (ALLOWED_CDN_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. Stale-While-Revalidate / Network-First with Offline Cache Fallback for Local Assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH ? `${BASE_PATH}/index.html` : '/index.html');
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // Default: Network only
  event.respondWith(fetch(event.request));
});
