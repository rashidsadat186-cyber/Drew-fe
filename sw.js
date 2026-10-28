/* Service Worker — کهاته سلطان (کار افلاین)
   هر وقت index.html را تغییر دادید، شمارهٔ VERSION را بالا ببرید. */
const VERSION = 'khata-v1';
const CACHE = 'khata-cache-' + VERSION;

const LOCAL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-180.png'];
const FIREBASE = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    const cache = await caches.open(CACHE);
    // فایل‌های خودمان
    await Promise.all(LOCAL.map(function (u) {
      return cache.add(new Request(u, { cache: 'reload' })).catch(function () {});
    }));
    // اسکریپت‌های Firebase (از دامنهٔ دیگر)
    await Promise.all(FIREBASE.map(function (u) {
      return fetch(u, { mode: 'no-cors' }).then(function (r) { return cache.put(u, r); }).catch(function () {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.startsWith('khata-cache-') && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // باز کردن صفحه: اول اینترنت، اگر نبود از کش
  if (req.mode === 'navigate') {
    e.respondWith((async function () {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html', { ignoreSearch: true })) ||
               (await caches.match('./', { ignoreSearch: true })) ||
               new Response('آفلاین هستید و صفحه هنوز ذخیره نشده. یک‌بار با اینترنت باز کنید.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Firebase JS: اول کش
  if (FIREBASE.indexOf(req.url) !== -1) {
    e.respondWith(caches.match(req.url).then(function (hit) {
      return hit || fetch(req.url, { mode: 'no-cors' }).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req.url, copy); });
        return r;
      });
    }));
    return;
  }

  // فایل‌های همین سایت: کش، و در پس‌زمینه تازه می‌شود
  if (url.origin === self.location.origin) {
    e.respondWith((async function () {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(function (r) { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(function () { return null; });
      return hit || (await net) || new Response('', { status: 504 });
    })());
  }
  // بقیه (Firestore، Gemini، Google Drive ...) مستقیم از اینترنت؛ افلاین خودش خطا می‌دهد و برنامه مدیریت می‌کند
});
