// ダイスアカデミー サービスワーカー
// ページ類はネットワーク優先（ブラウザの保存分を使わずに取る）。つながらないときだけ保存分を使う
const CACHE = 'diceacademy-v3';
const CORE = ['./', 'index.html', 'css/style.css', 'js/version.js', 'js/data.js', 'js/avatar.js', 'js/battle.js', 'js/app.js', 'icon.svg', 'icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});
// 同じドメイン（arata-a3.github.io）のほかのアプリや PPP と保存場所を共有しているので、自分の名前で始まる古い保存だけを消す
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('diceacademy-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    // navigate のリクエストは init 付きで作り直せないので、URL から作る
    const fresh = req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
    e.respondWith(fetch(fresh).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
